import os
import json
import urllib.request
import random
from dotenv import load_dotenv
from faker import Faker

load_dotenv()
fake = Faker()

url = os.environ.get("API_URL", "")
key = os.environ.get("SERVICE_ROLE_KEY", "")
if not key:
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
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error inserting into {endpoint}: {e}")
        return []

def generate_mock_data():
    print("Generating Users...")
    users = []
    for _ in range(10):
        users.append({
            "name": fake.name(),
            "email": fake.unique.email(),
            "co2_per_kg_prod": round(random.uniform(0.5, 5.0), 4)
        })
    inserted_users = post_data("users", users)
    user_ids = [u['user_id'] for u in inserted_users]

    print("Generating Suppliers...")
    suppliers = []
    for _ in range(5):
        suppliers.append({
            "name": fake.company(),
            "contact_email": fake.company_email(),
            "country": fake.country(),
            "city": fake.city()
        })
    inserted_suppliers = post_data("supplier", suppliers)
    supplier_ids = [s['supplier_id'] for s in inserted_suppliers]

    print("Generating Products...")
    categories = ["Electronics", "Clothing", "Food", "Industrial", "Medical"]
    products = []
    for _ in range(15):
        products.append({
            "name": fake.catch_phrase(),
            "description": fake.text(max_nb_chars=100),
            "category": random.choice(categories),
            "weight_kg": round(random.uniform(0.1, 100.0), 3)
        })
    inserted_products = post_data("product", products)
    product_ids = [p['product_id'] for p in inserted_products]

    print("Generating Transport Methods...")
    methods = ["Air Freight", "Ocean Freight", "Rail", "Trucking", "Drone"]
    transports = []
    for m in methods:
        transports.append({
            "mode": m,
            "avg_speed_kmh": round(random.uniform(40.0, 900.0), 2),
            "co2_per_km_kg": round(random.uniform(0.01, 1.5), 6)
        })
    inserted_transports = post_data("transport_method", transports)
    transport_ids = [t['transport_id'] for t in inserted_transports]

    print("Generating Supplier_Products...")
    supplier_products = []
    for p_id in product_ids:
        # Each product is supplied by 1 to 3 suppliers
        sampled_suppliers = random.sample(supplier_ids, random.randint(1, min(3, len(supplier_ids))))
        for s_id in sampled_suppliers:
            supplier_products.append({
                "supplier_id": s_id,
                "product_id": p_id,
                "price": round(random.uniform(10.0, 1000.0), 2),
                "priority": random.randint(1, 5),
                "stock_qty": random.randint(0, 1000)
            })
    post_data("supplier_product", supplier_products)

    print("Generating Orders...")
    orders = []
    for _ in range(20):
        orders.append({
            "user_id": random.choice(user_ids),
            "transport_id": random.choice(transport_ids),
            "total_price": round(random.uniform(50.0, 5000.0), 2),
            "status": random.choice(["pending", "processing", "shipped", "delivered"]),
            "ship_addr": fake.address().replace("\n", ", ")
        })
    inserted_orders = post_data("orders", orders)

    print(f"Successfully minted {len(inserted_users)} users, {len(inserted_suppliers)} suppliers, {len(inserted_products)} products, {len(inserted_transports)} transports, and {len(inserted_orders)} orders.")

if __name__ == "__main__":
    generate_mock_data()
