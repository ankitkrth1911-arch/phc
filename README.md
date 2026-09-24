# PHC Supply Resilience — Rural Healthcare Redistribution Engine

A calm, high-trust operational dashboard for predicting medicine stockouts at rural Primary Health Centres (PHCs) and computing emergency redistribution across districts during public health crises.

---

## 1. System Architecture & Tech Stack

- **Backend:** Python 3.10+, **FastAPI**, with **CORS** enabled.
- **Redistribution Optimization:** **Google OR-Tools (`pywraplp` with GLOP solver)** solving a constrained linear program live per API request, alongside a Nearest-Donor-First greedy benchmark.
- **Frontend:** Single-page application, modern Vanilla HTML5/CSS/JavaScript (zero build step overhead, instant load).
- **Cartography:** **Leaflet** with OpenStreetMap Voyager tiles, custom SVG risk-level pins, and animated pulse rings for emergency zones.
- **Visual Analytics:** **Chart.js** custom-styled to the Hospitality editorial palette.
- **LLM Synthesis:** Server-side **Gemini API** integration via environment variable `GEMINI_API_KEY`, with a strict factual fallback template built from verified metrics.

---

## 2. Navigation Architecture & Justification

> **Design Choice:** *Command palette entry point (keyboard shortcut `"/"` or top context capsule click) paired with an unobtrusive slim floating dock at the bottom-center.*
>
> **Justification:** The command-palette entry point combined with a floating dock eliminates visual clutter on screen, allowing operational coordinators during a rural crisis to rapidly query any district, health centre, or medicine via a single keystroke (`/`) while maintaining maximum viewport focus on spatial maps and live redistribution trade-offs without top or side chrome.

---

## 3. Hospitality Design System

Evoking a calm, reassuring boutique hotel / wellness retreat atmosphere rather than sterile hospital white or generic blue SaaS:
- **Base Canvas:** `#F7F4EE` (warm linen / cream)
- **Primary Ink:** `#211B17` (deep espresso ink)
- **Surfaces & Cards:** `#FFFDF9` with soft borders `#E7E0D5`
- **Primary Accent (Brass/Gold):** `#C59B4B` (warm brass for stats, highlights, focus rings)
- **Secondary Accent (Terracotta/Clay):** `#BD5D38` (warm earth for secondary alerts and drivers)
- **Universal Semantic Risk Indicators:**
  - Secure / Low Risk (&lt;35%): `#2A7E48` (forest green)
  - Caution / Moderate Risk (35–69%): `#D97706` (amber gold)
  - Critical / Severe Stockout (≥70%): `#C53030` (crimson red)
- **Typography:**
  - Headings & Editorial Labels: *Newsreader / Cormorant Garamond* (editorial serif)
  - Data & Metrics: *Plus Jakarta Sans* with `tabular-nums` for precise alignment.

---

## 4. Run Instructions

### A. Prerequisites
- Python 3.10 or higher.
- `pip` package manager.

### B. Backend Installation & Startup
1. Open a terminal in the project directory:
   ```bash
   cd e:\PHC\pro
   ```
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI application with Uvicorn:
   ```bash
   python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
   The backend server will launch and display:
   ```
   INFO: Application startup complete.
   INFO: Uvicorn running on http://0.0.0.0:8000
   ```

### C. Accessing the Frontend
The single-page application is served directly by the FastAPI backend at:
👉 **[http://localhost:8000/](http://localhost:8000/)**

*(Optional)* If you prefer to serve the frontend via an independent static file server on a separate port:
```bash
cd frontend
python -m http.server 3000
```
Then visit `http://localhost:3000/`. Full CORS support is enabled on the backend.

### D. Configuring the LLM API Key (Where to put the API Key)
- The backend reads the API key from the server environment variable `GEMINI_API_KEY`.
- An example template is provided in [`.env.example`](file:///e:/PHC/pro/.env.example).
- Open or create [`.env`](file:///e:/PHC/pro/.env) in the project root:
  ```ini
  GEMINI_API_KEY=AIzaSy...YourActualGeminiKeyHere
  PORT=8000
  HOST=0.0.0.0
  ```
- **Security & Privacy:** The API key is **only read on the server side** and is **never** sent to the client, exposed in browser network requests, or stored in frontend bundles.
- **Graceful Fallback:** If `GEMINI_API_KEY` is not provided or the network call fails, the server automatically produces an immediate, factual situational briefing using a grounded template constructed exclusively from verified numbers.

---

## 5. Provenance of Data: Live Computed vs. Benchmark Sample Data

Every section in the UI includes a clear provenance badge identifying how its values are derived:

| # | Section / Feature | Endpoint | Data Provenance | Status in UI |
|---|---|---|---|---|
| **1** | Context Selector & Breadcrumb Capsule | `GET /api/phcs` | Reads underlying CSVs & user inputs | **Interactive Context** |
| **2** | Temporal Demand Forecast | `GET /api/forecast` | Benchmark Sample (`forecast_sample.csv`) | `[Model Benchmark / Synthetic Sample Data until CSV upload]` |
| **3** | Stockout Risk Gauge & Runway Counters | `GET /api/risk` | **Live Computed** (Dynamic formula based on inventory run-rate, lead times & scenario multipliers) | `[Live Computed]` |
| **4** | Risk Factor Attribution Bar Chart | `GET /api/risk-drivers` | Benchmark Sample (`risk_drivers_sample.csv`) | `[Model Benchmark / Synthetic Sample Data until CSV upload]` |
| **5** | Emergency / Anomaly Alert Banner & Table | `GET /api/alerts` | **Live Computed** (Evaluates network surges across affected districts) | `[Live Computed]` |
| **6** | Spatial Map with Risk Hotspots | `GET /api/map` | **Live Computed** (Dynamic geocoded risk scores & pulsing pins) | `[Live Computed]` |
| **7** | Constrained Redistribution Transfer Table | `GET /api/transfers` | **Live Computed** (OR-Tools GLOP Linear Program vs Nearest-Donor Greedy) | `[Live Computed]` |
| **8** | Logistics Situational Briefing | `GET /api/explanation` | **Live Computed** (Server Gemini LLM or verified grounded template) | `[Live Computed]` |
| **9** | Federated Model Convergence | `GET /api/federated` | Benchmark Sample (`federated_sample.csv`) | `[Model Benchmark / Synthetic Sample Data until CSV upload]` |
| **10**| Model Performance Comparison Table | `GET /api/model-performance`| Benchmark Sample (`model_perf_sample.csv`) | `[Model Benchmark / Synthetic Sample Data until CSV upload]` |

---

## 6. How the Constrained Optimization Engine Works

For the active medicine and emergency scenario:
1. **Mathematical Formulation (OR-Tools GLOP):**
   - **Decision Variables:** $X_{ij} \ge 0$ (medicine units dispatched from donor $i$ to recipient $j$).
   - **Donor Safety Buffer Constraint:** $\sum_j X_{ij} \le \max(0, \text{Stock}_i - \text{Demand}_i - \text{SafetyStock}_i)$. *A donor can never be dispatched below its own emergency demand plus safety buffer.*
   - **Route Capacity Constraint:** $X_{ij} \le \text{RouteCapacity}_{ij}$.
   - **Receiver Warehouse Limit:** $\sum_i X_{ij} \le \text{StorageCapacity}_j - \text{Stock}_j$.
   - **Maximum Distance Cutoff:** $X_{ij} = 0$ if $\text{Distance}_{ij} > 145.0 \text{ km}$.
   - **Unmet Shortage Minimization:**
     $$\min \sum_j (w_j \cdot U_j) + 0.0001 \cdot \sum_{(i,j)} (d_{ij} \cdot X_{ij})$$
     where $w_j$ is the district vulnerability weight and $d_{ij}$ is road distance in kilometers.
2. **Nearest-Donor Greedy Baseline:**
   - Under identical constraints, sorts shortage nodes by severity and selects closest donor with remaining surplus.
3. **Comparative Evaluation:**
   - The UI displays both methods side-by-side: Unmet Demand, Critical Shortages Averted, Units Moved, Total Transport Burden, and the % Efficiency Advantage.

---

## 7. Swapping in Custom Datasets (Zero Code Changes)

The system is architected to ingest arbitrary CSV files. To connect your own real-world data:
1. Replace or update the files in `data/`:
   - `districts.csv`: `state,district_id,phc_id,phc_name,lat,lon,vulnerability_weight,receiver_capacity`
   - `inventory.csv`: `phc_id,medicine_id,current_stock,safety_stock,avg_daily_demand,lead_time_days`
   - `routes.csv`: `from_phc,to_phc,distance_km,route_capacity`
   - `scenarios.csv`: `scenario_id,name,description,demand_multiplier,affected_districts,affected_medicines`
   - `forecast_sample.csv`: `phc_id,medicine_id,week,actual,yhat,yhat_lo,yhat_hi`
   - `risk_drivers_sample.csv`: `phc_id,medicine_id,feature,importance`
   - `federated_sample.csv`: `round,local_only_mae,federated_mae,centralized_mae`
   - `model_perf_sample.csv`: `model,MAE,MASE`
2. Or point to custom file paths in `.env` (e.g. `DISTRICTS_CSV=/path/to/my_districts.csv`).
3. Restart the server. The data loader automatically parses all new health centres, states, routes, and medicines without modifying code.
