import math
from typing import Dict, List, Any, Optional
from backend.data_loader import DataLoader

class RiskEngine:
    def __init__(self, data_loader: DataLoader):
        self.loader = data_loader

    def calculate_risk(
        self,
        phc_id: str,
        medicine_id: str,
        scenario_id: Optional[str] = "BASELINE"
    ) -> Dict[str, Any]:
        """Calculates dynamic stockout risk score, risk level, and days to stockout."""
        phc = self.loader.phc_lookup.get(phc_id)
        vuln_weight = phc["vulnerability_weight"] if phc else 1.0
        district_id = phc["district_id"] if phc else ""

        inv = self.loader.get_inventory_item(phc_id, medicine_id)
        if not inv:
            # Fallback if no inventory record
            return {"risk_score": 15.0, "risk_level": "Secure", "days_to_stockout": 45}

        curr_stock = float(inv["current_stock"])
        safety_stock = float(inv["safety_stock"])
        base_daily_demand = float(inv["avg_daily_demand"])
        lead_time = float(inv["lead_time_days"])

        # Determine multiplier from scenario
        scenario = self.loader.get_scenario(scenario_id)
        multiplier = 1.0
        if scenario:
            affected_dists = scenario.get("affected_districts", [])
            affected_meds = scenario.get("affected_medicines", [])

            is_dist_affected = "ALL" in affected_dists or district_id in affected_dists
            is_med_affected = "ALL" in affected_meds or medicine_id in affected_meds

            if is_dist_affected and is_med_affected:
                multiplier = scenario.get("demand_multiplier", 1.0)

        eff_daily_demand = max(0.5, base_daily_demand * multiplier)
        days_to_stockout = max(0, int(curr_stock / eff_daily_demand))

        # Required buffer to safely bridge lead time + safety stock
        safe_threshold = safety_stock + (eff_daily_demand * lead_time)
        coverage_ratio = curr_stock / max(1.0, safe_threshold)

        if coverage_ratio <= 0.35:
            # Severely depleted
            score = 85.0 + 14.0 * (1.0 - (coverage_ratio / 0.35))
        elif coverage_ratio < 1.0:
            # Below safety buffer
            score = 45.0 + 40.0 * (1.0 - coverage_ratio)
        else:
            # Healthy stock
            surplus_ratio = min(3.0, coverage_ratio)
            score = max(5.0, 45.0 * math.exp(-1.1 * (surplus_ratio - 1.0)))

        # Adjust slightly for local district vulnerability
        score = score * (0.85 + 0.15 * min(2.0, vuln_weight))
        score = round(min(99.0, max(5.0, score)), 1)

        if score >= 70.0:
            level = "Critical"
        elif score >= 35.0:
            level = "Caution"
        else:
            level = "Secure"

        return {
            "risk_score": score,
            "risk_level": level,
            "days_to_stockout": days_to_stockout
        }

    def get_risk_drivers(self, phc_id: str, medicine_id: str) -> List[Dict[str, Any]]:
        """Returns feature importance ranking for the selected PHC and medicine."""
        # Check cached CSV first
        matched = [
            {"feature": r["feature"], "importance": r["importance"]}
            for r in self.loader.risk_drivers
            if r["phc_id"] == phc_id and r["medicine_id"] == medicine_id
        ]
        if matched:
            matched.sort(key=lambda x: x["importance"], reverse=True)
            return matched

        # Dynamic fallback if not present in CSV
        inv = self.loader.get_inventory_item(phc_id, medicine_id)
        if inv and inv["current_stock"] < inv["safety_stock"]:
            return [
                {"feature": "Inventory Run-Rate Deficit", "importance": 0.42},
                {"feature": "Emergency Surge Multiplier", "importance": 0.28},
                {"feature": "Supplier Lead-time Lag", "importance": 0.14},
                {"feature": "Road Accessibility / Inundation", "importance": 0.10},
                {"feature": "Recent Patient Footfall Drift", "importance": 0.06},
            ]
        return [
            {"feature": "Inventory Run-Rate Coverage", "importance": 0.36},
            {"feature": "Baseline Patient Footfall", "importance": 0.24},
            {"feature": "Supplier Lead-time Buffer", "importance": 0.18},
            {"feature": "Seasonal Weather Vulnerability", "importance": 0.12},
            {"feature": "Prescription Pattern Stability", "importance": 0.10},
        ]

    def get_alerts(self, scenario_id: Optional[str] = "BASELINE") -> Dict[str, Any]:
        """Identifies districts under stress and formats the anomaly banner and affected table."""
        scenario = self.loader.get_scenario(scenario_id)
        if not scenario or scenario["scenario_id"] == "BASELINE":
            # Check baseline criticals
            critical_map: Dict[str, set] = {}
            for phc in self.loader.phcs:
                p_id = phc["phc_id"]
                d_id = phc["district_id"]
                for med in self.loader.medicines:
                    risk_info = self.calculate_risk(p_id, med, "BASELINE")
                    if risk_info["risk_level"] == "Critical":
                        critical_map.setdefault(d_id, set()).add(med)

            if not critical_map:
                return {
                    "alerts": [],
                    "banner": "Operational Stability: All district inventory reserves remain within nominal safety buffers."
                }
            alerts = [
                {"district_id": d, "medicines_affected": sorted(list(meds))}
                for d, meds in critical_map.items()
            ]
            banner = f"Nominal Baseline: Minor isolated stock constraints noted in {len(alerts)} district(s)."
            return {"alerts": alerts, "banner": banner}

        # Active emergency scenario
        affected_dists = scenario.get("affected_districts", [])
        affected_meds = scenario.get("affected_medicines", [])
        scen_name = scenario.get("name", scenario["scenario_id"])

        district_med_map: Dict[str, set] = {}
        for phc in self.loader.phcs:
            d_id = phc["district_id"]
            if "ALL" not in affected_dists and d_id not in affected_dists:
                continue
            for med in self.loader.medicines:
                if "ALL" not in affected_meds and med not in affected_meds:
                    continue
                risk_info = self.calculate_risk(phc["phc_id"], med, scenario["scenario_id"])
                if risk_info["risk_level"] in ("Critical", "Caution"):
                    district_med_map.setdefault(d_id, set()).add(med)

        alerts = [
            {"district_id": d, "medicines_affected": sorted(list(meds))}
            for d, meds in district_med_map.items()
        ]

        if alerts:
            d_names = [a["district_id"].replace("DIST_", "").title() for a in alerts]
            all_affected_meds = set()
            for a in alerts:
                all_affected_meds.update(a["medicines_affected"])
            med_count = len(all_affected_meds)
            dist_str = ", ".join(d_names[:3])
            banner = (
                f"Emergency Alert [{scen_name}]: Unusual demand surge in {dist_str} — "
                f"{med_count} critical medicine{'s' if med_count != 1 else ''} threatened with impending stockouts."
            )
        else:
            banner = f"Alert [{scen_name}]: Monitoring heightened surveillance across border corridors."

        return {"alerts": alerts, "banner": banner}

    def get_map_points(
        self,
        scenario_id: Optional[str] = "BASELINE",
        medicine_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Computes current risk coordinates for all PHCs."""
        chosen_med = medicine_id or (self.loader.medicines[0] if self.loader.medicines else "ORS_ZINC")
        points = []
        for phc in self.loader.phcs:
            risk_info = self.calculate_risk(phc["phc_id"], chosen_med, scenario_id)
            points.append({
                "phc_id": phc["phc_id"],
                "phc_name": phc.get("phc_name", phc["phc_id"]),
                "district_id": phc.get("district_id", ""),
                "lat": phc["lat"],
                "lon": phc["lon"],
                "risk_score": risk_info["risk_score"],
                "risk_level": risk_info["risk_level"],
                "days_to_stockout": risk_info["days_to_stockout"]
            })
        return points
