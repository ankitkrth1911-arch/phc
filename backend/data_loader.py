import csv
import os
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class DataLoader:
    def __init__(self, config):
        self.config = config
        self.phcs: List[Dict[str, Any]] = []
        self.phc_lookup: Dict[str, Dict[str, Any]] = {}
        self.medicines: List[str] = []
        self.inventory: List[Dict[str, Any]] = []
        self.inventory_lookup: Dict[str, Dict[str, Any]] = {}  # key: (phc_id, medicine_id)
        self.routes: List[Dict[str, Any]] = []
        self.scenarios: List[Dict[str, Any]] = []
        self.scenarios_lookup: Dict[str, Dict[str, Any]] = {}
        self.forecast: List[Dict[str, Any]] = []
        self.risk_drivers: List[Dict[str, Any]] = []
        self.federated: List[Dict[str, Any]] = []
        self.model_perf: List[Dict[str, Any]] = []

    def load_all(self):
        """Loads all CSV files from disk into memory cache."""
        self._load_districts()
        self._load_inventory()
        self._load_routes()
        self._load_scenarios()
        self._load_forecast()
        self._load_risk_drivers()
        self._load_federated()
        self._load_model_perf()
        logger.info(
            f"Loaded {len(self.phcs)} PHCs, {len(self.medicines)} medicines, "
            f"{len(self.inventory)} inventory records, {len(self.routes)} routes, "
            f"{len(self.scenarios)} scenarios."
        )

    def _safe_float(self, val: Any, default: float = 0.0) -> float:
        try:
            return float(val) if val not in (None, "", "null") else default
        except (ValueError, TypeError):
            return default

    def _safe_int(self, val: Any, default: int = 0) -> int:
        try:
            return int(float(val)) if val not in (None, "", "null") else default
        except (ValueError, TypeError):
            return default

    def _load_districts(self):
        self.phcs = []
        self.phc_lookup = {}
        path = self.config.DISTRICTS_CSV
        if not os.path.exists(path):
            logger.warning(f"Districts CSV not found at {path}")
            return

        with open(path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                p_id = row.get("phc_id", "").strip()
                if not p_id:
                    continue
                record = {
                    "state": row.get("state", "Unknown").strip(),
                    "district_id": row.get("district_id", "Unknown").strip(),
                    "phc_id": p_id,
                    "phc_name": row.get("phc_name", p_id).strip(),
                    "lat": self._safe_float(row.get("lat")),
                    "lon": self._safe_float(row.get("lon")),
                    "vulnerability_weight": self._safe_float(row.get("vulnerability_weight"), 1.0),
                    "receiver_capacity": self._safe_int(row.get("receiver_capacity"), 5000)
                }
                self.phcs.append(record)
                self.phc_lookup[p_id] = record

    def _load_inventory(self):
        self.inventory = []
        self.inventory_lookup = {}
        meds_set = set()
        path = self.config.INVENTORY_CSV
        if not os.path.exists(path):
            logger.warning(f"Inventory CSV not found at {path}")
            return

        with open(path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                p_id = row.get("phc_id", "").strip()
                med_id = row.get("medicine_id", "").strip()
                if not p_id or not med_id:
                    continue
                meds_set.add(med_id)
                record = {
                    "phc_id": p_id,
                    "medicine_id": med_id,
                    "current_stock": self._safe_int(row.get("current_stock")),
                    "safety_stock": self._safe_int(row.get("safety_stock")),
                    "avg_daily_demand": self._safe_int(row.get("avg_daily_demand"), 10),
                    "lead_time_days": self._safe_int(row.get("lead_time_days"), 7)
                }
                self.inventory.append(record)
                self.inventory_lookup[(p_id, med_id)] = record

        self.medicines = sorted(list(meds_set))

    def _load_routes(self):
        self.routes = []
        path = self.config.ROUTES_CSV
        if not os.path.exists(path):
            logger.warning(f"Routes CSV not found at {path}")
            return

        with open(path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                from_p = row.get("from_phc", "").strip()
                to_p = row.get("to_phc", "").strip()
                if not from_p or not to_p:
                    continue
                record = {
                    "from_phc": from_p,
                    "to_phc": to_p,
                    "distance_km": self._safe_float(row.get("distance_km")),
                    "route_capacity": self._safe_int(row.get("route_capacity"), 1000)
                }
                self.routes.append(record)

    def _load_scenarios(self):
        self.scenarios = []
        self.scenarios_lookup = {}
        path = self.config.SCENARIOS_CSV
        if not os.path.exists(path):
            logger.warning(f"Scenarios CSV not found at {path}")
            return

        with open(path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                s_id = row.get("scenario_id", "").strip()
                if not s_id:
                    continue
                record = {
                    "scenario_id": s_id,
                    "name": row.get("name", s_id).strip(),
                    "description": row.get("description", "").strip(),
                    "demand_multiplier": self._safe_float(row.get("demand_multiplier"), 1.0),
                    "affected_districts": [d.strip() for d in row.get("affected_districts", "").split(",") if d.strip()],
                    "affected_medicines": [m.strip() for m in row.get("affected_medicines", "").split(",") if m.strip()]
                }
                self.scenarios.append(record)
                self.scenarios_lookup[s_id] = record

    def _load_forecast(self):
        self.forecast = []
        path = self.config.FORECAST_CSV
        if not os.path.exists(path):
            return
        with open(path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                p_id = row.get("phc_id", "").strip()
                med_id = row.get("medicine_id", "").strip()
                week = row.get("week", "").strip()
                if not p_id or not med_id or not week:
                    continue
                act = row.get("actual", "")
                yhat = row.get("yhat", "")
                yhat_lo = row.get("yhat_lo", "")
                yhat_hi = row.get("yhat_hi", "")
                self.forecast.append({
                    "phc_id": p_id,
                    "medicine_id": med_id,
                    "week": week,
                    "actual": self._safe_float(act) if act != "" else None,
                    "yhat": self._safe_float(yhat) if yhat != "" else None,
                    "yhat_lo": self._safe_float(yhat_lo) if yhat_lo != "" else None,
                    "yhat_hi": self._safe_float(yhat_hi) if yhat_hi != "" else None
                })

    def _load_risk_drivers(self):
        self.risk_drivers = []
        path = self.config.DRIVERS_CSV
        if not os.path.exists(path):
            return
        with open(path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                p_id = row.get("phc_id", "").strip()
                med_id = row.get("medicine_id", "").strip()
                feature = row.get("feature", "").strip()
                if not p_id or not med_id or not feature:
                    continue
                self.risk_drivers.append({
                    "phc_id": p_id,
                    "medicine_id": med_id,
                    "feature": feature,
                    "importance": self._safe_float(row.get("importance"), 0.0)
                })

    def _load_federated(self):
        self.federated = []
        path = self.config.FEDERATED_CSV
        if not os.path.exists(path):
            return
        with open(path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rnd = self._safe_int(row.get("round"))
                if rnd == 0:
                    continue
                self.federated.append({
                    "round": rnd,
                    "local_only_mae": self._safe_float(row.get("local_only_mae")),
                    "federated_mae": self._safe_float(row.get("federated_mae")),
                    "centralized_mae": self._safe_float(row.get("centralized_mae"))
                })

    def _load_model_perf(self):
        self.model_perf = []
        path = self.config.MODEL_PERF_CSV
        if not os.path.exists(path):
            return
        with open(path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                model_name = row.get("model", "").strip()
                if not model_name:
                    continue
                self.model_perf.append({
                    "model": model_name,
                    "MAE": self._safe_float(row.get("MAE")),
                    "MASE": self._safe_float(row.get("MASE"))
                })

    def get_phcs(self) -> List[Dict[str, Any]]:
        return self.phcs

    def get_medicines(self) -> List[str]:
        return self.medicines

    def get_scenarios(self) -> List[Dict[str, Any]]:
        return self.scenarios

    def get_scenario(self, scenario_id: Optional[str]) -> Optional[Dict[str, Any]]:
        if not scenario_id:
            return self.scenarios[0] if self.scenarios else None
        return self.scenarios_lookup.get(scenario_id) or (self.scenarios[0] if self.scenarios else None)

    def get_inventory_item(self, phc_id: str, medicine_id: str) -> Optional[Dict[str, Any]]:
        return self.inventory_lookup.get((phc_id, medicine_id))

    def get_all_routes(self) -> List[Dict[str, Any]]:
        return self.routes
