/**
 * PHC Supply Resilience — API Client
 * Connects to FastAPI backend with automatic offline fallback to realistic sample data.
 */

const API_BASE = window.location.port === "8000" 
  ? "" 
  : "http://localhost:8000";

let isBackendLive = false;

// Mock Fallback Data (matching exact backend JSON schema)
const MOCK_DATA = {
  phcs: [
    { state: "Odisha", district_id: "DIST_KALAHANDI", phc_id: "PHC_THUAMUL_RAMPUR", phc_name: "Thuamul Rampur Remote Ridge PHC", lat: 19.578, lon: 82.998, vulnerability_weight: 1.85 },
    { state: "Odisha", district_id: "DIST_KALAHANDI", phc_id: "PHC_BHAWANIPATNA", phc_name: "Bhawanipatna Central Reserve PHC", lat: 19.907, lon: 83.164, vulnerability_weight: 1.10 },
    { state: "Odisha", district_id: "DIST_KALAHANDI", phc_id: "PHC_DHARAMGARH", phc_name: "Dharamgarh Model Health Unit", lat: 19.866, lon: 82.778, vulnerability_weight: 1.20 },
    { state: "Odisha", district_id: "DIST_KORAPUT", phc_id: "PHC_BORIGUMMA", phc_name: "Borigumma Sub-District Hospital", lat: 18.966, lon: 82.556, vulnerability_weight: 1.20 },
    { state: "Odisha", district_id: "DIST_KORAPUT", phc_id: "PHC_KOTPAD", phc_name: "Kotpad Block PHC", lat: 19.141, lon: 82.327, vulnerability_weight: 1.40 },
    { state: "Odisha", district_id: "DIST_KORAPUT", phc_id: "PHC_LAMTAPUT", phc_name: "Lamtaput High-Altitude PHC", lat: 18.665, lon: 82.684, vulnerability_weight: 1.65 },
    { state: "Odisha", district_id: "DIST_RAYAGADA", phc_id: "PHC_BISSAM_CUTTACK", phc_name: "Bissam Cuttack Community Health Centre", lat: 19.516, lon: 83.518, vulnerability_weight: 1.25 },
    { state: "Odisha", district_id: "DIST_RAYAGADA", phc_id: "PHC_MUNIGUDA", phc_name: "Muniguda Rural Centre", lat: 19.627, lon: 83.488, vulnerability_weight: 1.45 },
    { state: "Odisha", district_id: "DIST_RAYAGADA", phc_id: "PHC_KALYANSINGHPUR", phc_name: "Kalyansinghpur Tribal Valley PHC", lat: 19.349, lon: 83.332, vulnerability_weight: 1.70 },
    { state: "Odisha", district_id: "DIST_NABARANGPUR", phc_id: "PHC_UMERKOTE", phc_name: "Umerkote Sub-Divisional PHC", lat: 19.670, lon: 82.208, vulnerability_weight: 1.15 },
    { state: "Odisha", district_id: "DIST_NABARANGPUR", phc_id: "PHC_PAPADAHANDI", phc_name: "Papadahandi Riverbank PHC", lat: 19.383, lon: 82.597, vulnerability_weight: 1.35 },
    { state: "Odisha", district_id: "DIST_NABARANGPUR", phc_id: "PHC_JHARIGAON", phc_name: "Jharigaon Forest Border PHC", lat: 19.821, lon: 82.389, vulnerability_weight: 1.75 }
  ],
  medicines: [
    "ORS_ZINC",
    "ARTESUNATE",
    "AMOXICILLIN",
    "OXYTOCIN",
    "RABIES_VACCINE",
    "PARACETAMOL",
    "SNAKE_ANTIVENOM"
  ],
  scenarios: [
    { scenario_id: "BASELINE", name: "Normal Operational Baseline", description: "Standard seasonal demand with routine supply cycles and no active disaster alerts.", demand_multiplier: 1.0 },
    { scenario_id: "MONSOON_FLOOD", name: "Monsoon Flooding & Waterborne Surge", description: "Flash floods in Rayagada and Kalahandi river basins. Severe surge in diarrheal cases and snakebites.", demand_multiplier: 2.9 },
    { scenario_id: "MALARIA_EPIDEMIC", name: "Post-Monsoon Vector Outbreak", description: "Stagnant floodwater triggers falciparum malaria epidemic in forested tribal belts.", demand_multiplier: 2.5 },
    { scenario_id: "HEATWAVE_SURGE", name: "Pre-Monsoon Extreme Heat Emergency", description: "Peak temperatures exceeding 45.8°C causing acute dehydration and heatstroke.", demand_multiplier: 2.2 },
    { scenario_id: "RESPIRATORY_SPIKE", name: "Winter Viral Respiratory Cluster", description: "Severe cold spell on high-altitude ridges causing acute lower respiratory infections.", demand_multiplier: 2.4 }
  ]
};

async function safeFetch(url, fallbackGenerator) {
  try {
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    isBackendLive = true;
    updateStatusIndicator(true);
    return data;
  } catch (err) {
    console.warn(`Backend fetch failed for ${url}. Using realistic fallback.`, err);
    isBackendLive = false;
    updateStatusIndicator(false);
    return fallbackGenerator();
  }
}

function updateStatusIndicator(live) {
  const el = document.getElementById("systemStatusPill");
  if (!el) return;
  if (live) {
    el.className = "system-status-indicator";
    el.innerHTML = `<span class="status-pulsing-dot"></span> Backend Live`;
  } else {
    el.className = "system-status-indicator offline";
    el.innerHTML = `<span class="status-pulsing-dot"></span> Demo Mode (Offline)`;
  }
}

export const ApiService = {
  async getPhcs() {
    return safeFetch(`${API_BASE}/api/phcs`, () => ({
      phcs: MOCK_DATA.phcs,
      medicines: MOCK_DATA.medicines,
      scenarios: MOCK_DATA.scenarios
    }));
  },

  async getForecast(phcId, medicineId, horizon = 6) {
    return safeFetch(
      `${API_BASE}/api/forecast?phc_id=${encodeURIComponent(phcId)}&medicine_id=${encodeURIComponent(medicineId)}&horizon=${horizon}`,
      () => {
        const weeks = ["W-08", "W-07", "W-06", "W-05", "W-04", "W-03", "W-02", "W-01", "W+01", "W+02", "W+03", "W+04", "W+05", "W+06"];
        const actual = [210, 235, 220, 255, 270, 265, 290, 315, null, null, null, null, null, null];
        const yhat = [null, null, null, null, null, null, null, null, 340, 365, 390, 420, 445, 470];
        const yhat_lo = [null, null, null, null, null, null, null, null, 295, 315, 330, 350, 370, 390];
        const yhat_hi = [null, null, null, null, null, null, null, null, 385, 415, 450, 490, 520, 550];
        return { week: weeks, actual, yhat, yhat_lo, yhat_hi };
      }
    );
  },

  async getRisk(phcId, medicineId, scenario = "BASELINE") {
    return safeFetch(
      `${API_BASE}/api/risk?phc_id=${encodeURIComponent(phcId)}&medicine_id=${encodeURIComponent(medicineId)}&scenario=${encodeURIComponent(scenario)}`,
      () => {
        const isSurge = scenario !== "BASELINE";
        const isRemote = phcId.includes("THUAMUL") || phcId.includes("LAMTAPUT") || phcId.includes("KALYANSINGHPUR");
        if (isSurge && isRemote) {
          return { risk_score: 87.5, risk_level: "Critical", days_to_stockout: 3 };
        } else if (isSurge) {
          return { risk_score: 54.0, risk_level: "Caution", days_to_stockout: 9 };
        } else {
          return { risk_score: 22.0, risk_level: "Secure", days_to_stockout: 28 };
        }
      }
    );
  },

  async getRiskDrivers(phcId, medicineId) {
    return safeFetch(
      `${API_BASE}/api/risk-drivers?phc_id=${encodeURIComponent(phcId)}&medicine_id=${encodeURIComponent(medicineId)}`,
      () => ({
        drivers: [
          { feature: "Inventory Run-Rate Coverage", importance: 0.38 },
          { feature: "Emergency Surge Multiplier", importance: 0.26 },
          { feature: "Supplier Resupply Lead-Time", importance: 0.16 },
          { feature: "Monsoon Road Inundation Index", importance: 0.12 },
          { feature: "Weekly Outpatient Velocity", importance: 0.08 }
        ]
      })
    );
  },

  async getAlerts(scenario = "BASELINE") {
    return safeFetch(
      `${API_BASE}/api/alerts?scenario=${encodeURIComponent(scenario)}`,
      () => {
        if (scenario === "MONSOON_FLOOD") {
          return {
            alerts: [
              { district_id: "DIST_RAYAGADA", medicines_affected: ["AMOXICILLIN", "ORS_ZINC", "SNAKE_ANTIVENOM"] },
              { district_id: "DIST_KALAHANDI", medicines_affected: ["ORS_ZINC", "SNAKE_ANTIVENOM"] },
              { district_id: "DIST_KORAPUT", medicines_affected: ["AMOXICILLIN", "ORS_ZINC"] }
            ],
            banner: "Emergency Alert [Monsoon Flooding & Waterborne Surge]: Unusual demand surge in Rayagada, Kalahandi, Koraput — 3 critical medicines threatened with impending stockouts."
          };
        }
        return {
          alerts: [],
          banner: "Operational Stability: All district inventory reserves remain within nominal safety buffers."
        };
      }
    );
  },

  async getMap(scenario = "BASELINE", medicineId = "ORS_ZINC") {
    return safeFetch(
      `${API_BASE}/api/map?scenario=${encodeURIComponent(scenario)}&medicine_id=${encodeURIComponent(medicineId)}`,
      () => ({
        points: MOCK_DATA.phcs.map(p => {
          const isCrit = (scenario !== "BASELINE") && (p.phc_id.includes("THUAMUL") || p.phc_id.includes("KALYANSINGHPUR") || p.phc_id.includes("LAMTAPUT"));
          const isCaution = (scenario !== "BASELINE") && (p.phc_id.includes("KOTPAD") || p.phc_id.includes("MUNIGUDA"));
          return {
            phc_id: p.phc_id,
            phc_name: p.phc_name,
            district_id: p.district_id,
            lat: p.lat,
            lon: p.lon,
            risk_score: isCrit ? 88.0 : (isCaution ? 52.0 : 18.0),
            risk_level: isCrit ? "Critical" : (isCaution ? "Caution" : "Secure"),
            days_to_stockout: isCrit ? 3 : (isCaution ? 8 : 32)
          };
        })
      })
    );
  },

  async getTransfers(scenario = "BASELINE", medicineId = "ORS_ZINC") {
    return safeFetch(
      `${API_BASE}/api/transfers?scenario=${encodeURIComponent(scenario)}&medicine_id=${encodeURIComponent(medicineId)}`,
      () => ({
        transfers: [
          { from_phc: "PHC_BHAWANIPATNA", to_phc: "PHC_THUAMUL_RAMPUR", medicine_id: medicineId, quantity: 380, distance_km: 48.2 },
          { from_phc: "PHC_BORIGUMMA", to_phc: "PHC_LAMTAPUT", medicine_id: medicineId, quantity: 240, distance_km: 42.6 },
          { from_phc: "PHC_BISSAM_CUTTACK", to_phc: "PHC_KALYANSINGHPUR", medicine_id: medicineId, quantity: 290, distance_km: 35.8 },
          { from_phc: "PHC_UMERKOTE", to_phc: "PHC_JHARIGAON", medicine_id: medicineId, quantity: 180, distance_km: 28.4 }
        ],
        baseline_summary: {
          unmet_demand: 1240,
          critical_shortages: 4,
          units_moved: 860,
          transport_cost_km: 46200.0,
          vulnerability_weighted_unmet: 2180.0
        },
        optimized_summary: {
          unmet_demand: 150,
          critical_shortages: 1,
          units_moved: 1090,
          transport_cost_km: 42100.0,
          vulnerability_weighted_unmet: 270.0,
          improvement_pct: 87.6
        },
        constraints_respected: "Hard Constraints Enforced: Donor safety stock preserved (no donor dispatched below demand + safety buffer); route transit throughput capacities maintained; receiver warehouse storage limits respected; maximum operational radius cutoff ≤ 145 km."
      })
    );
  },

  async getExplanation(phcId, medicineId, scenario = "BASELINE") {
    return safeFetch(
      `${API_BASE}/api/explanation?phc_id=${encodeURIComponent(phcId)}&medicine_id=${encodeURIComponent(medicineId)}&scenario=${encodeURIComponent(scenario)}`,
      () => {
        const isCrit = (scenario !== "BASELINE") && (phcId.includes("THUAMUL") || phcId.includes("LAMTAPUT") || phcId.includes("KALYANSINGHPUR"));
        if (isCrit) {
          return {
            text: `Under the ${scenario} alert, ${phcId.replace("PHC_", "").replace("_", " ")} faces critical supply depletion with under 4 days of ${medicineId.replace("_", " ")} remaining. The constrained optimization engine scheduled an emergency consignment from regional surplus hubs (380 units), mitigating stockout risk by 87% while preserving donor reserve buffers.`,
            source: "template"
          };
        }
        return {
          text: `Under the ${scenario} operational protocol, inventory levels for ${medicineId.replace("_", " ")} at this health centre remain securely within nominal parameters (28 days of runway). Nearby district corridors remain balanced with no emergency redistribution required.`,
          source: "template"
        };
      }
    );
  },

  async getFederated() {
    return safeFetch(
      `${API_BASE}/api/federated`,
      () => {
        const rounds = Array.from({ length: 25 }, (_, i) => i + 1);
        return {
          rounds,
          local_only_mae: [18.2, 16.5, 15.1, 14.2, 13.5, 12.9, 12.4, 12.1, 11.8, 11.6, 11.4, 11.3, 11.2, 11.1, 11.0, 11.0, 10.9, 10.9, 10.8, 10.8, 10.8, 10.7, 10.7, 10.7, 10.7],
          federated_mae: [17.8, 14.2, 11.8, 9.9, 8.5, 7.5, 6.8, 6.2, 5.8, 5.5, 5.2, 5.0, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.3, 4.2, 4.2, 4.2, 4.18, 4.18, 4.18],
          centralized_mae: [17.5, 13.8, 11.2, 9.2, 7.8, 6.8, 6.1, 5.6, 5.2, 4.9, 4.6, 4.4, 4.3, 4.2, 4.1, 4.0, 4.0, 3.95, 3.92, 3.90, 3.90, 3.88, 3.87, 3.86, 3.85]
        };
      }
    );
  },

  async getModelPerformance() {
    return safeFetch(
      `${API_BASE}/api/model-performance`,
      () => ({
        rows: [
          { model: "Fed-Ensemble Temporal Model (Ours)", MAE: 4.18, MASE: 0.62 },
          { model: "Centralized LSTM-Quantile", MAE: 3.92, MASE: 0.58 },
          { model: "District Ridge Autoregressive", MAE: 6.84, MASE: 1.02 },
          { model: "Prophet with Monsoon Holiday Regressors", MAE: 7.45, MASE: 1.11 },
          { model: "4-Week Rolling Moving Average", MAE: 8.92, MASE: 1.31 },
          { model: "Naive Seasonal Baseline (Last Year)", MAE: 11.45, MASE: 1.68 }
        ]
      })
    );
  }
};
