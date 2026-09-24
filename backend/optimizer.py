import logging
from typing import Dict, List, Any, Optional
from ortools.linear_solver import pywraplp
from backend.data_loader import DataLoader

logger = logging.getLogger(__name__)

class RedistributionEngine:
    def __init__(self, data_loader: DataLoader, max_distance_km: float = 145.0, planning_horizon_days: int = 14):
        self.loader = data_loader
        self.max_distance_km = max_distance_km
        self.horizon = planning_horizon_days

    def _prepare_node_data(self, medicine_id: str, scenario_id: Optional[str]):
        """Computes stock, effective demand, surplus, shortage, and limits for each PHC."""
        scenario = self.loader.get_scenario(scenario_id)
        affected_dists = scenario.get("affected_districts", []) if scenario else []
        affected_meds = scenario.get("affected_medicines", []) if scenario else []
        multiplier = scenario.get("demand_multiplier", 1.0) if scenario else 1.0

        nodes = {}
        for phc in self.loader.phcs:
            p_id = phc["phc_id"]
            d_id = phc["district_id"]
            vuln = phc.get("vulnerability_weight", 1.0)
            rec_cap = phc.get("receiver_capacity", 5000)

            inv = self.loader.get_inventory_item(p_id, medicine_id)
            if not inv:
                continue

            stock = float(inv["current_stock"])
            safety = float(inv["safety_stock"])
            base_daily = float(inv["avg_daily_demand"])

            # Check if this node/med gets surge
            is_dist_aff = "ALL" in affected_dists or d_id in affected_dists
            is_med_aff = "ALL" in affected_meds or medicine_id in affected_meds
            eff_mult = multiplier if (is_dist_aff and is_med_aff) else 1.0

            total_demand = base_daily * eff_mult * self.horizon
            required_safe = total_demand + safety

            if stock > required_safe:
                surplus = stock - required_safe
                shortage = 0.0
            else:
                surplus = 0.0
                shortage = required_safe - stock

            avail_storage = max(0.0, float(rec_cap) - stock)

            nodes[p_id] = {
                "phc_id": p_id,
                "phc_name": phc.get("phc_name", p_id),
                "district_id": d_id,
                "stock": stock,
                "safety_stock": safety,
                "total_demand": total_demand,
                "required_safe": required_safe,
                "surplus": surplus,
                "shortage": shortage,
                "avail_storage": avail_storage,
                "vulnerability_weight": vuln
            }
        return nodes

    def _prepare_route_data(self):
        """Builds lookup table of route distance and capacity between PHC pairs."""
        route_map = {}
        for r in self.loader.get_all_routes():
            u = r["from_phc"]
            v = r["to_phc"]
            dist = float(r["distance_km"])
            cap = float(r["route_capacity"])
            if dist <= self.max_distance_km:
                route_map[(u, v)] = {"distance_km": dist, "capacity": cap}
        return route_map

    def solve_lp(self, medicine_id: str, scenario_id: Optional[str] = "BASELINE") -> Dict[str, Any]:
        """Solves optimal redistribution using OR-Tools GLOP solver."""
        nodes = self._prepare_node_data(medicine_id, scenario_id)
        route_map = self._prepare_route_data()

        solver = pywraplp.Solver.CreateSolver("GLOP")
        if not solver:
            logger.error("Failed to initialize OR-Tools GLOP solver.")
            return self._solve_greedy(medicine_id, scenario_id)

        # Decision variables: X_ij = units shipped from i to j
        x_vars = {}
        for (u, v), r_info in route_map.items():
            if u in nodes and v in nodes and nodes[u]["surplus"] > 0 and nodes[v]["shortage"] > 0:
                # Upper bound by route capacity and receiver storage
                ub = min(r_info["capacity"], nodes[v]["avail_storage"], nodes[u]["surplus"])
                if ub > 0:
                    x_vars[(u, v)] = solver.NumVar(0.0, ub, f"x_{u}_{v}")

        # Unmet shortage variables U_j >= 0 for each node with shortage
        u_vars = {}
        for p_id, node in nodes.items():
            if node["shortage"] > 0:
                u_vars[p_id] = solver.NumVar(0.0, node["shortage"], f"u_{p_id}")

        # Constraint 1: Donor Surplus Capacity
        # Sum of outgoing transfers <= Surplus_i (Preserves Demand + Safety Stock)
        for p_id, node in nodes.items():
            if node["surplus"] > 0:
                outgoing = [x_vars[(p_id, v)] for (u, v) in x_vars if u == p_id]
                if outgoing:
                    solver.Add(solver.Sum(outgoing) <= node["surplus"])

        # Constraint 2: Receiver Storage Capacity & Shortage Fulfillment
        for p_id, node in nodes.items():
            incoming = [x_vars[(u, p_id)] for (u, v) in x_vars if v == p_id]
            if incoming:
                # Can't exceed physical receiver warehouse capacity
                solver.Add(solver.Sum(incoming) <= node["avail_storage"])
                # Can't exceed actual shortage need
                solver.Add(solver.Sum(incoming) <= node["shortage"])

                # Unmet shortage relation: U_j >= Shortage_j - incoming
                if p_id in u_vars:
                    solver.Add(u_vars[p_id] >= node["shortage"] - solver.Sum(incoming))
            else:
                if p_id in u_vars:
                    solver.Add(u_vars[p_id] >= node["shortage"])

        # Objective Function:
        # Min Sum( Vuln_j * U_j ) + 0.0001 * Sum( Dist_ij * X_ij )
        objective = solver.Objective()
        for p_id, u_var in u_vars.items():
            vuln = nodes[p_id]["vulnerability_weight"]
            objective.SetCoefficient(u_var, vuln)

        for (u, v), x_var in x_vars.items():
            dist = route_map[(u, v)]["distance_km"]
            # Small penalty on distance as a tie-breaker
            objective.SetCoefficient(x_var, 0.0001 * dist)

        objective.SetMinimization()

        status = solver.Solve()

        transfers = []
        units_moved = 0
        transport_cost = 0.0

        if status in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
            for (u, v), x_var in x_vars.items():
                qty = int(round(x_var.solution_value()))
                if qty > 0:
                    dist = route_map[(u, v)]["distance_km"]
                    transfers.append({
                        "from_phc": u,
                        "to_phc": v,
                        "medicine_id": medicine_id,
                        "quantity": qty,
                        "distance_km": dist
                    })
                    units_moved += qty
                    transport_cost += qty * dist

        # Calculate final unmet demand after transfers
        unmet_demand = 0
        weighted_unmet = 0.0
        critical_shortages = 0

        for p_id, node in nodes.items():
            if node["shortage"] > 0:
                received = sum(t["quantity"] for t in transfers if t["to_phc"] == p_id)
                rem = max(0, int(round(node["shortage"] - received)))
                if rem > 0:
                    unmet_demand += rem
                    weighted_unmet += rem * node["vulnerability_weight"]
                    critical_shortages += 1

        optimized_summary = {
            "unmet_demand": unmet_demand,
            "critical_shortages": critical_shortages,
            "units_moved": units_moved,
            "transport_cost_km": round(transport_cost, 1),
            "vulnerability_weighted_unmet": round(weighted_unmet, 1)
        }

        # Solve greedy baseline to compare
        baseline_res = self._solve_greedy(medicine_id, scenario_id)

        # Improvement calculation: based on vulnerability-weighted reduction, or transport cost reduction if demand is supply-limited
        base_weighted = baseline_res["baseline_summary"]["vulnerability_weighted_unmet"]
        base_cost = baseline_res["baseline_summary"]["transport_cost_km"]
        base_unmet = baseline_res["baseline_summary"]["unmet_demand"]

        if base_weighted > weighted_unmet and base_weighted > 0:
            imp_pct = round((base_weighted - weighted_unmet) / base_weighted * 100.0, 1)
        elif base_cost > transport_cost and base_cost > 0:
            imp_pct = round((base_cost - transport_cost) / base_cost * 100.0, 1)
        elif base_unmet > unmet_demand and base_unmet > 0:
            imp_pct = round((base_unmet - unmet_demand) / base_unmet * 100.0, 1)
        else:
            imp_pct = 0.0

        optimized_summary["improvement_pct"] = imp_pct

        return {
            "transfers": transfers,
            "baseline_summary": baseline_res["baseline_summary"],
            "optimized_summary": optimized_summary,
            "constraints_respected": (
                "Hard Constraints Enforced: Donor safety stock preserved (no donor dispatched below demand + safety buffer); "
                "route transit throughput capacities maintained; receiver warehouse storage limits respected; "
                f"maximum operational radius cutoff ≤ {self.max_distance_km} km."
            )
        }

    def _solve_greedy(self, medicine_id: str, scenario_id: Optional[str]) -> Dict[str, Any]:
        """Implements Nearest-Donor-First heuristic baseline under identical constraints."""
        nodes = self._prepare_node_data(medicine_id, scenario_id)
        route_map = self._prepare_route_data()

        # Track remaining capacities
        rem_surplus = {p_id: n["surplus"] for p_id, n in nodes.items()}
        rem_shortage = {p_id: n["shortage"] for p_id, n in nodes.items()}
        rem_storage = {p_id: n["avail_storage"] for p_id, n in nodes.items()}
        rem_route = {pair: r["capacity"] for pair, r in route_map.items()}

        # Sort shortage nodes by vulnerability * shortage descending
        shortage_nodes = sorted(
            [p for p, n in nodes.items() if n["shortage"] > 0],
            key=lambda p: nodes[p]["vulnerability_weight"] * nodes[p]["shortage"],
            reverse=True
        )

        transfers = []
        units_moved = 0
        transport_cost = 0.0

        for to_p in shortage_nodes:
            if rem_shortage[to_p] <= 0:
                continue

            # Find candidate donors sorted purely by nearest distance
            candidates = []
            for (from_p, v), r_info in route_map.items():
                if v == to_p and rem_surplus.get(from_p, 0) > 0 and r_info["distance_km"] <= self.max_distance_km:
                    candidates.append((from_p, r_info["distance_km"], rem_route.get((from_p, to_p), 0)))

            candidates.sort(key=lambda c: c[1])  # Nearest distance first

            for from_p, dist, route_cap in candidates:
                if rem_shortage[to_p] <= 0:
                    break
                max_alloc = min(
                    rem_shortage[to_p],
                    rem_surplus[from_p],
                    rem_storage[to_p],
                    route_cap
                )
                qty = int(max_alloc)
                if qty > 0:
                    transfers.append({
                        "from_phc": from_p,
                        "to_phc": to_p,
                        "medicine_id": medicine_id,
                        "quantity": qty,
                        "distance_km": dist
                    })
                    rem_shortage[to_p] -= qty
                    rem_surplus[from_p] -= qty
                    rem_storage[to_p] -= qty
                    rem_route[(from_p, to_p)] -= qty
                    units_moved += qty
                    transport_cost += qty * dist

        unmet_demand = 0
        weighted_unmet = 0.0
        critical_shortages = 0

        for p_id, node in nodes.items():
            rem = int(round(rem_shortage.get(p_id, 0)))
            if rem > 0:
                unmet_demand += rem
                weighted_unmet += rem * node["vulnerability_weight"]
                critical_shortages += 1

        baseline_summary = {
            "unmet_demand": unmet_demand,
            "critical_shortages": critical_shortages,
            "units_moved": units_moved,
            "transport_cost_km": round(transport_cost, 1),
            "vulnerability_weighted_unmet": round(weighted_unmet, 1)
        }

        return {
            "transfers": transfers,
            "baseline_summary": baseline_summary
        }
