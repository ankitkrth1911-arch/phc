import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

load_dotenv(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")

# CSV File paths
DISTRICTS_CSV = os.getenv("DISTRICTS_CSV", str(DATA_DIR / "districts.csv"))
INVENTORY_CSV = os.getenv("INVENTORY_CSV", str(DATA_DIR / "inventory.csv"))
ROUTES_CSV = os.getenv("ROUTES_CSV", str(DATA_DIR / "routes.csv"))
SCENARIOS_CSV = os.getenv("SCENARIOS_CSV", str(DATA_DIR / "scenarios.csv"))
FORECAST_CSV = os.getenv("FORECAST_CSV", str(DATA_DIR / "forecast_sample.csv"))
DRIVERS_CSV = os.getenv("DRIVERS_CSV", str(DATA_DIR / "risk_drivers_sample.csv"))
FEDERATED_CSV = os.getenv("FEDERATED_CSV", str(DATA_DIR / "federated_sample.csv"))
MODEL_PERF_CSV = os.getenv("MODEL_PERF_CSV", str(DATA_DIR / "model_perf_sample.csv"))
