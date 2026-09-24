import os
import csv
import math
import random

def generate_all_data():
    os.makedirs('data', exist_ok=True)
    random.seed(42)

    # 1. Districts & PHCs
    # state,district_id,phc_id,phc_name,lat,lon,vulnerability_weight,receiver_capacity
    phcs = [
        # Koraput District
        ("Odisha", "DIST_KORAPUT", "PHC_BORIGUMMA", "Borigumma Sub-District Hospital", 18.966, 82.556, 1.20, 6500),
        ("Odisha", "DIST_KORAPUT", "PHC_KOTPAD", "Kotpad Block PHC", 19.141, 82.327, 1.40, 4200),
        ("Odisha", "DIST_KORAPUT", "PHC_LAMTAPUT", "Lamtaput High-Altitude PHC", 18.665, 82.684, 1.65, 3200),
        
        # Rayagada District
        ("Odisha", "DIST_RAYAGADA", "PHC_BISSAM_CUTTACK", "Bissam Cuttack Community Health Centre", 19.516, 83.518, 1.25, 5800),
        ("Odisha", "DIST_RAYAGADA", "PHC_MUNIGUDA", "Muniguda Rural Centre", 19.627, 83.488, 1.45, 3800),
        ("Odisha", "DIST_RAYAGADA", "PHC_KALYANSINGHPUR", "Kalyansinghpur Tribal Valley PHC", 19.349, 83.332, 1.70, 3100),
        
        # Kalahandi District
        ("Odisha", "DIST_KALAHANDI", "PHC_BHAWANIPATNA", "Bhawanipatna Central Reserve PHC", 19.907, 83.164, 1.10, 8000),
        ("Odisha", "DIST_KALAHANDI", "PHC_DHARAMGARH", "Dharamgarh Model Health Unit", 19.866, 82.778, 1.20, 6000),
        ("Odisha", "DIST_KALAHANDI", "PHC_THUAMUL_RAMPUR", "Thuamul Rampur Remote Ridge PHC", 19.578, 82.998, 1.85, 2800),
        
        # Nabarangpur District
        ("Odisha", "DIST_NABARANGPUR", "PHC_UMERKOTE", "Umerkote Sub-Divisional PHC", 19.670, 82.208, 1.15, 6200),
        ("Odisha", "DIST_NABARANGPUR", "PHC_PAPADAHANDI", "Papadahandi Riverbank PHC", 19.383, 82.597, 1.35, 4100),
        ("Odisha", "DIST_NABARANGPUR", "PHC_JHARIGAON", "Jharigaon Forest Border PHC", 19.821, 82.389, 1.75, 3000),
    ]

    with open('data/districts.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["state", "district_id", "phc_id", "phc_name", "lat", "lon", "vulnerability_weight", "receiver_capacity"])
        for row in phcs:
            writer.writerow(row)

    medicines = [
        "ORS_ZINC",
        "ARTESUNATE",
        "AMOXICILLIN",
        "OXYTOCIN",
        "RABIES_VACCINE",
        "PARACETAMOL",
        "SNAKE_ANTIVENOM"
    ]

    # 2. Inventory CSV
    # phc_id,medicine_id,current_stock,safety_stock,avg_daily_demand,lead_time_days
    # Central PHCs (Bhawanipatna, Borigumma, Umerkote, Dharamgarh) hold strong surplus.
    # Vulnerable/remote PHCs (Thuamul Rampur, Kalyansinghpur, Lamtaput, Jharigaon) have thinner stock.
    inventory_rows = []
    base_stock_profiles = {
        "ORS_ZINC": {"daily": 45, "central_stock": 2600, "remote_stock": 420, "safety": 300, "lead": 7},
        "ARTESUNATE": {"daily": 25, "central_stock": 1400, "remote_stock": 190, "safety": 180, "lead": 10},
        "AMOXICILLIN": {"daily": 35, "central_stock": 1900, "remote_stock": 310, "safety": 250, "lead": 8},
        "OXYTOCIN": {"daily": 12, "central_stock": 650, "remote_stock": 90, "safety": 80, "lead": 5},
        "RABIES_VACCINE": {"daily": 10, "central_stock": 480, "remote_stock": 65, "safety": 60, "lead": 12},
        "PARACETAMOL": {"daily": 60, "central_stock": 3200, "remote_stock": 580, "safety": 400, "lead": 5},
        "SNAKE_ANTIVENOM": {"daily": 8, "central_stock": 380, "remote_stock": 35, "safety": 45, "lead": 14},
    }

    central_phcs = {"PHC_BHAWANIPATNA", "PHC_BORIGUMMA", "PHC_UMERKOTE", "PHC_DHARAMGARH", "PHC_BISSAM_CUTTACK"}
    remote_phcs = {"PHC_THUAMUL_RAMPUR", "PHC_KALYANSINGHPUR", "PHC_LAMTAPUT", "PHC_JHARIGAON"}

    for phc in phcs:
        p_id = phc[2]
        is_central = p_id in central_phcs
        is_remote = p_id in remote_phcs

        for med in medicines:
            prof = base_stock_profiles[med]
            daily = prof["daily"]
            if is_central:
                daily = int(daily * 1.5)
                stock = int(prof["central_stock"] * random.uniform(0.9, 1.25))
                safety = int(prof["safety"] * 1.3)
            elif is_remote:
                daily = int(daily * 0.8)
                stock = int(prof["remote_stock"] * random.uniform(0.7, 1.05))
                safety = int(prof["safety"] * 0.9)
            else:
                stock = int((prof["central_stock"] + prof["remote_stock"]) * 0.45 * random.uniform(0.85, 1.15))
                safety = prof["safety"]

            inventory_rows.append([p_id, med, stock, safety, daily, prof["lead"]])

    with open('data/inventory.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["phc_id", "medicine_id", "current_stock", "safety_stock", "avg_daily_demand", "lead_time_days"])
        for r in inventory_rows:
            writer.writerow(r)

    # 3. Routes CSV
    # from_phc,to_phc,distance_km,route_capacity
    # Compute Haversine distance with route factor ~1.28 for winding rural roads
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    route_rows = []
    max_transfer_range = 145.0 # km

    for i in range(len(phcs)):
        for j in range(len(phcs)):
            if i == j:
                continue
            p1 = phcs[i]
            p2 = phcs[j]
            crow_dist = haversine(p1[4], p1[5], p2[4], p2[5])
            road_dist = round(crow_dist * 1.32, 1)
            if road_dist <= max_transfer_range:
                # Capacity depends on corridor maturity (e.g. 500 to 2200 units)
                cap = 1600 if (p1[2] in central_phcs or p2[2] in central_phcs) else 900
                route_rows.append([p1[2], p2[2], road_dist, cap])

    with open('data/routes.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["from_phc", "to_phc", "distance_km", "route_capacity"])
        for r in route_rows:
            writer.writerow(r)

    # 4. Scenarios CSV
    # scenario_id,name,description,demand_multiplier,affected_districts,affected_medicines
    scenarios = [
        ("BASELINE", "Normal Operational Baseline", "Standard seasonal consumption with routine supply cycles and no active disaster alerts.", 1.0, "ALL", "ALL"),
        ("MONSOON_FLOOD", "Monsoon Flooding & Waterborne Surge", "Severe cloudburst causing Flash floods in Rayagada and Kalahandi river basins. Unprecedented surge in diarrheal cases, snakebites, and secondary bacterial infections.", 2.9, "DIST_RAYAGADA,DIST_KALAHANDI,DIST_KORAPUT", "ORS_ZINC,SNAKE_ANTIVENOM,AMOXICILLIN"),
        ("MALARIA_EPIDEMIC", "Post-Monsoon Vector Outbreak", "Stagnant floodwater accelerates Anopheles breeding in forested tribal belts. Acute surge in falciparum malaria and hyperpyrexia.", 2.5, "DIST_RAYAGADA,DIST_KORAPUT,DIST_NABARANGPUR", "ARTESUNATE,PARACETAMOL"),
        ("HEATWAVE_SURGE", "Pre-Monsoon Extreme Heat Emergency", "Peak summer temperatures exceeding 45.8°C across Kalahandi and Nabarangpur plains, causing severe dehydration and heatstroke.", 2.2, "DIST_KALAHANDI,DIST_NABARANGPUR", "ORS_ZINC,PARACETAMOL"),
        ("RESPIRATORY_SPIKE", "Winter Viral Respiratory Cluster", "Cold spell in high-altitude Lamtaput and Thuamul Rampur ridges triggering acute bronchiolitis and secondary pneumonia.", 2.4, "DIST_KORAPUT,DIST_KALAHANDI", "AMOXICILLIN,PARACETAMOL")
    ]
    with open('data/scenarios.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["scenario_id", "name", "description", "demand_multiplier", "affected_districts", "affected_medicines"])
        for s in scenarios:
            writer.writerow(s)

    # 5. Forecast Sample CSV
    # phc_id,medicine_id,week,actual,yhat,yhat_lo,yhat_hi
    # 8 historical weeks (actuals) + 6 future weeks (forecast)
    weeks = [
        "W-08", "W-07", "W-06", "W-05", "W-04", "W-03", "W-02", "W-01",
        "W+01", "W+02", "W+03", "W+04", "W+05", "W+06"
    ]
    forecast_rows = []
    for phc in phcs:
        p_id = phc[2]
        for med in medicines:
            base_w = base_stock_profiles[med]["daily"] * 7
            if p_id in central_phcs:
                base_w = int(base_w * 1.4)
            elif p_id in remote_phcs:
                base_w = int(base_w * 0.8)

            for i, w in enumerate(weeks):
                if i < 8:
                    noise = random.uniform(-0.12, 0.14)
                    act = int(base_w * (1.0 + noise + 0.02 * (i - 4)))
                    forecast_rows.append([p_id, med, w, act, "", "", ""])
                else:
                    step = i - 7
                    trend = 1.0 + 0.035 * step
                    yhat = int(base_w * trend)
                    spread = int(yhat * (0.12 + 0.025 * step))
                    yhat_lo = max(10, yhat - spread)
                    yhat_hi = yhat + spread
                    forecast_rows.append([p_id, med, w, "", yhat, yhat_lo, yhat_hi])

    with open('data/forecast_sample.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["phc_id", "medicine_id", "week", "actual", "yhat", "yhat_lo", "yhat_hi"])
        for r in forecast_rows:
            writer.writerow(r)

    # 6. Risk Drivers Sample CSV
    # phc_id,medicine_id,feature,importance
    driver_features = [
        ("Inventory Run-Rate Coverage", 0.38),
        ("Emergency Surge Multiplier", 0.26),
        ("Supplier Resupply Lead-Time", 0.16),
        ("Monsoon Road Inundation Index", 0.12),
        ("Weekly Outpatient Footfall Velocity", 0.08)
    ]
    risk_driver_rows = []
    for phc in phcs:
        p_id = phc[2]
        for med in medicines:
            # Add slight perturbation
            weights = [max(0.04, imp + random.uniform(-0.03, 0.03)) for feat, imp in driver_features]
            tot = sum(weights)
            weights = [round(w / tot, 3) for w in weights]
            diff = round(1.0 - sum(weights), 3)
            weights[0] += diff
            for (feat, _), w in zip(driver_features, weights):
                risk_driver_rows.append([p_id, med, feat, round(w, 3)])

    with open('data/risk_drivers_sample.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["phc_id", "medicine_id", "feature", "importance"])
        for r in risk_driver_rows:
            writer.writerow(r)

    # 7. Federated Learning Sample CSV
    # round,local_only_mae,federated_mae,centralized_mae
    federated_rows = []
    for rnd in range(1, 26):
        # Local model plateaus early at higher error
        loc_mae = round(12.5 * math.exp(-0.06 * rnd) + 6.8 + random.uniform(-0.15, 0.15), 2)
        # Federated approaches centralized gracefully
        fed_mae = round(13.2 * math.exp(-0.15 * rnd) + 4.15 + random.uniform(-0.12, 0.12), 2)
        # Centralized benchmark (pooled theoretical lower bound)
        cen_mae = round(13.0 * math.exp(-0.17 * rnd) + 3.85 + random.uniform(-0.08, 0.08), 2)
        federated_rows.append([rnd, loc_mae, fed_mae, cen_mae])

    with open('data/federated_sample.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["round", "local_only_mae", "federated_mae", "centralized_mae"])
        for r in federated_rows:
            writer.writerow(r)

    # 8. Model Performance Sample CSV
    # model,MAE,MASE
    model_perf_rows = [
        ["Fed-Ensemble Temporal Model (Ours)", 4.18, 0.62],
        ["Centralized LSTM-Quantile", 3.92, 0.58],
        ["District Ridge Autoregressive", 6.84, 1.02],
        ["Prophet with Monsoon Holiday Regressors", 7.45, 1.11],
        ["4-Week Rolling Moving Average", 8.92, 1.31],
        ["Naive Seasonal Baseline (Last Year)", 11.45, 1.68]
    ]
    with open('data/model_perf_sample.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["model", "MAE", "MASE"])
        for r in model_perf_rows:
            writer.writerow(r)

    print("Successfully generated all seed CSV files in ./data/")

if __name__ == "__main__":
    generate_all_data()
