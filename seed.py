import os
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("API_URL", "")
key = os.environ.get("SERVICE_ROLE_KEY", "")

if not url or not key:
    key = os.environ.get("ANON_API_KEY", "")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def post_data(endpoint, data):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", data=json.dumps(data).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Success ({response.status}): {response.read().decode('utf-8')}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Seeding users...")
    post_data("users", {
        "name": "Test User",
        "email": "test2@example.com",
        "co2_per_kg_prod": 1.5
    })

    print("Seeding transport method...")
    post_data("transport_method", {
        "mode": "Air Freight",
        "avg_speed_kmh": 800.0,
        "co2_per_km_kg": 0.5
    })
