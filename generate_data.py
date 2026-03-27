import os
import json
import urllib.request
import random
from dotenv import load_dotenv

load_dotenv()

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

def clear_table(endpoint, field):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}?{field}=not.is.null", headers=headers, method="DELETE")
    try:
        urllib.request.urlopen(req)
        print(f"Cleared {endpoint}")
    except Exception as e:
        print(f"Error clearing {endpoint}: {e}")

def wipe_database():
    print("Wiping existing data...")
    clear_table("involves", "supplier_id")
    clear_table("order_item", "order_id")
    clear_table("orders", "order_id")
    clear_table("supplier_product", "supplier_id")
    clear_table("carbon_goal", "goal_id")
    clear_table("transport_method", "transport_id")
    clear_table("users", "user_id")
    clear_table("supplier", "supplier_id")
    clear_table("product", "product_id")

def generate_coffee_data():
    wipe_database()
    print("\nGenerating Coffee Shop Data...")

    print("Generating Users (Buyers)...")
    users = [
        {"name": "Downtown Cafe", "email": "downtown@cafe.com", "co2_per_kg_prod": 1.5},
        {"name": "Espresso Express", "email": "admin@espresso.com", "co2_per_kg_prod": 2.0},
        {"name": "Morning Roast", "email": "roast@morning.com", "co2_per_kg_prod": 1.1}
    ]
    inserted_users = post_data("users", users)
    user_ids = [u['user_id'] for u in inserted_users] if inserted_users else []

    print("Generating Suppliers (Sellers)...")
    suppliers = [
        {"name": "Global Beans Co", "contact_email": "sales@globalbeans.com", "country": "Colombia", "city": "Bogota"},
        {"name": "Dairy Farm Dist", "contact_email": "orders@dairyfarm.com", "country": "USA", "city": "Wisconsin"},
        {"name": "Sweet Syrups Inc", "contact_email": "hello@sweetsyrup.com", "country": "France", "city": "Paris"},
        {"name": "Paper Co Solutions", "contact_email": "b2b@paperco.com", "country": "China", "city": "Shenzhen"}
    ]
    inserted_suppliers = post_data("supplier", suppliers)
    
    # Map suppliers for later use
    supplier_map = {s['name']: s['supplier_id'] for s in inserted_suppliers} if inserted_suppliers else {}

    print("Generating Coffee Products...")
    products = [
        {"name": "Arabica Espresso Beans", "description": "Premium dark roast for espresso.", "category": "Coffee Beans", "weight_kg": 5.0},
        {"name": "Colombian Mild Roast", "description": "Light and fruity morning blend.", "category": "Coffee Beans", "weight_kg": 2.5},
        {"name": "Whole Milk (Gallon)", "description": "Fresh dairy milk.", "category": "Dairy", "weight_kg": 3.7},
        {"name": "Oat Milk Barista Edition", "description": "Creamy oat milk for lattes.", "category": "Dairy", "weight_kg": 1.0},
        {"name": "Vanilla Bean Syrup", "description": "Classic sweet syrup 1L.", "category": "Syrups", "weight_kg": 1.2},
        {"name": "Caramel Drizzle", "description": "Thick caramel topping 500ml.", "category": "Syrups", "weight_kg": 0.6},
        {"name": "12oz Paper Cups", "description": "Recyclable hot cups (1000ct).", "category": "Equipment", "weight_kg": 8.0},
        {"name": "Wooden Stirrers", "description": "Eco-friendly stirrers (5000ct).", "category": "Equipment", "weight_kg": 2.0}
    ]
    inserted_products = post_data("product", products)
    product_map = {p['name']: p['product_id'] for p in inserted_products} if inserted_products else {}

    print("Generating Transport Methods...")
    transports = [
        {"mode": "Bicycle Courier", "avg_speed_kmh": 20.0, "co2_per_km_kg": 0.0},
        {"mode": "Electric Delivery Van", "avg_speed_kmh": 60.0, "co2_per_km_kg": 0.05},
        {"mode": "Freight Truck", "avg_speed_kmh": 80.0, "co2_per_km_kg": 0.3},
        {"mode": "Cargo Flight", "avg_speed_kmh": 800.0, "co2_per_km_kg": 1.2}
    ]
    post_data("transport_method", transports)

    print("Generating Supplier Inventories...")
    supplier_products = []
    
    if supplier_map and product_map:
        # Global Beans Co sells Coffee Beans
        supplier_products.append({"supplier_id": supplier_map.get("Global Beans Co"), "product_id": product_map.get("Arabica Espresso Beans"), "price": 45.0, "priority": 1, "stock_qty": 100})
        supplier_products.append({"supplier_id": supplier_map.get("Global Beans Co"), "product_id": product_map.get("Colombian Mild Roast"), "price": 38.5, "priority": 2, "stock_qty": 50})
        
        # Dairy Farm Dist sells Dairy
        supplier_products.append({"supplier_id": supplier_map.get("Dairy Farm Dist"), "product_id": product_map.get("Whole Milk (Gallon)"), "price": 5.5, "priority": 1, "stock_qty": 200})
        supplier_products.append({"supplier_id": supplier_map.get("Dairy Farm Dist"), "product_id": product_map.get("Oat Milk Barista Edition"), "price": 4.2, "priority": 1, "stock_qty": 300})
        
        # Sweet Syrups Inc sells Syrups
        supplier_products.append({"supplier_id": supplier_map.get("Sweet Syrups Inc"), "product_id": product_map.get("Vanilla Bean Syrup"), "price": 12.0, "priority": 1, "stock_qty": 80})
        supplier_products.append({"supplier_id": supplier_map.get("Sweet Syrups Inc"), "product_id": product_map.get("Caramel Drizzle"), "price": 14.5, "priority": 1, "stock_qty": 40})
        
        # Paper Co Solutions sells Equipment
        supplier_products.append({"supplier_id": supplier_map.get("Paper Co Solutions"), "product_id": product_map.get("12oz Paper Cups"), "price": 85.0, "priority": 1, "stock_qty": 20})
        supplier_products.append({"supplier_id": supplier_map.get("Paper Co Solutions"), "product_id": product_map.get("Wooden Stirrers"), "price": 15.0, "priority": 2, "stock_qty": 50})

        # Insert some overlapping stock to show competition
        supplier_products.append({"supplier_id": supplier_map.get("Global Beans Co"), "product_id": product_map.get("Vanilla Bean Syrup"), "price": 13.5, "priority": 2, "stock_qty": 10})
        
        # Filter out None values in case a name mismatch happened
        supplier_products = [sp for sp in supplier_products if sp['supplier_id'] and sp['product_id']]
        post_data("supplier_product", supplier_products)

    print("\nSuccessfully seeded Coffee Shop Database!")

if __name__ == "__main__":
    generate_coffee_data()
