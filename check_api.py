import requests
import json

r = requests.get('http://127.0.0.1:8000/api/v1/projects/')
data = r.json()
items = data.get('items', data) if isinstance(data, dict) else data

simplified = []
for p in items[:5]:
    simplified.append({
        "id": p.get("id"),
        "name": p.get("name"),
        "status": p.get("status"),
        "project_type": p.get("project_type")
    })
print(json.dumps(simplified, indent=2))
