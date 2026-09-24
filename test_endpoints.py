import httpx

base = 'http://localhost:8000/api'
endpoints = [
    '/phcs',
    '/forecast?phc_id=PHC_THUAMUL_RAMPUR&medicine_id=ORS_ZINC&horizon=6',
    '/risk?phc_id=PHC_THUAMUL_RAMPUR&medicine_id=ORS_ZINC&scenario=MONSOON_FLOOD',
    '/risk-drivers?phc_id=PHC_THUAMUL_RAMPUR&medicine_id=ORS_ZINC',
    '/alerts?scenario=MONSOON_FLOOD',
    '/map?scenario=MONSOON_FLOOD&medicine_id=ORS_ZINC',
    '/transfers?scenario=MONSOON_FLOOD&medicine_id=ORS_ZINC',
    '/explanation?phc_id=PHC_THUAMUL_RAMPUR&medicine_id=ORS_ZINC&scenario=MONSOON_FLOOD',
    '/federated',
    '/model-performance',
    '/health'
]

with httpx.Client(timeout=10.0) as client:
    for ep in endpoints:
        r = client.get(base + ep)
        short_name = ep.split("?")[0]
        print(f"{short_name:20s}: status={r.status_code}, bytes={len(r.content)}")
        assert r.status_code == 200, f"Failed on {ep}: {r.text}"
        data = r.json()
        assert isinstance(data, dict), f"Expected dict response for {ep}"

print("\n>>> ALL 10 API ENDPOINTS VALIDATED SUCCESSFULLY! <<<")
