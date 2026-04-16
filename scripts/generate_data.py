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
        print(f"  Cleared {endpoint}")
    except Exception as e:
        print(f"  Error clearing {endpoint}: {e}")

def wipe_database():
    print("Wiping existing data...")
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
    print("\n========================================")
    print("  Generating Coffee Shop Data...")
    print("========================================\n")

    # =======================================
    # USERS (BUYERS) — no co2_per_kg_prod
    # =======================================
    print("1. Generating Users (Buyers)...")
    users = [
        {"name": "Downtown Cafe", "email": "downtown@cafe.com"},
        {"name": "Espresso Express", "email": "admin@espresso.com"},
        {"name": "Morning Roast", "email": "roast@morning.com"},
        {"name": "Urban Grind Co", "email": "orders@urbangrind.com"},
        {"name": "Bean Scene", "email": "hello@beanscene.com"},
    ]
    inserted_users = post_data("users", users)
    user_ids = [u['user_id'] for u in inserted_users] if inserted_users else []
    print(f"   → {len(user_ids)} buyers created")

    # =======================================
    # SUPPLIERS (SELLERS) — global cities
    # =======================================
    print("2. Generating Suppliers (Sellers)...")
    suppliers = [
        {"name": "Global Beans Co", "contact_email": "sales@globalbeans.com", "country": "Colombia", "city": "Bogota"},
        {"name": "Dairy Farm Dist", "contact_email": "orders@dairyfarm.com", "country": "USA", "city": "Wisconsin"},
        {"name": "Sweet Syrups Inc", "contact_email": "hello@sweetsyrup.com", "country": "France", "city": "Paris"},
        {"name": "Paper Co Solutions", "contact_email": "b2b@paperco.com", "country": "China", "city": "Shenzhen"},
        {"name": "Seoul Roasters", "contact_email": "export@seoulroast.kr", "country": "South Korea", "city": "Seoul"},
        {"name": "Mumbai Spice Trade", "contact_email": "info@mumbaispice.in", "country": "India", "city": "Mumbai"},
        {"name": "Amsterdam Trade Co", "contact_email": "trade@amstrading.nl", "country": "Netherlands", "city": "Amsterdam"},
        {"name": "Tokyo Premium Imports", "contact_email": "sales@tokyopremium.jp", "country": "Japan", "city": "Tokyo"},
    ]
    inserted_suppliers = post_data("supplier", suppliers)
    supplier_map = {s['name']: s['supplier_id'] for s in inserted_suppliers} if inserted_suppliers else {}
    print(f"   → {len(supplier_map)} suppliers created")

    # =======================================
    # PRODUCTS
    # =======================================
    print("3. Generating Products...")
    products = [
        {"name": "Arabica Espresso Beans", "description": "Premium dark roast for espresso.", "category": "Coffee Beans", "weight_kg": 5.0},
        {"name": "Colombian Mild Roast", "description": "Light and fruity morning blend.", "category": "Coffee Beans", "weight_kg": 2.5},
        {"name": "Ethiopian Yirgacheffe", "description": "Floral and citrus notes, single origin.", "category": "Coffee Beans", "weight_kg": 3.0},
        {"name": "Korean Honey Process", "description": "Sweet, full-body honey processed beans.", "category": "Coffee Beans", "weight_kg": 2.0},
        {"name": "Whole Milk (Gallon)", "description": "Fresh dairy milk.", "category": "Dairy", "weight_kg": 3.7},
        {"name": "Oat Milk Barista Edition", "description": "Creamy oat milk for lattes.", "category": "Dairy", "weight_kg": 1.0},
        {"name": "Coconut Cream", "description": "Rich coconut cream for specialty drinks.", "category": "Dairy", "weight_kg": 0.8},
        {"name": "Vanilla Bean Syrup", "description": "Classic sweet syrup 1L.", "category": "Syrups", "weight_kg": 1.2},
        {"name": "Caramel Drizzle", "description": "Thick caramel topping 500ml.", "category": "Syrups", "weight_kg": 0.6},
        {"name": "Matcha Powder Premium", "description": "Ceremonial grade Japanese matcha 500g.", "category": "Syrups", "weight_kg": 0.5},
        {"name": "Chai Spice Concentrate", "description": "Indian masala chai concentrate 1L.", "category": "Syrups", "weight_kg": 1.1},
        {"name": "12oz Paper Cups", "description": "Recyclable hot cups (1000ct).", "category": "Equipment", "weight_kg": 8.0},
        {"name": "Wooden Stirrers", "description": "Eco-friendly stirrers (5000ct).", "category": "Equipment", "weight_kg": 2.0},
        {"name": "V60 Pour Over Dripper", "description": "Ceramic V60 dripper, size 02.", "category": "Equipment", "weight_kg": 0.4},
    ]
    inserted_products = post_data("product", products)
    product_map = {p['name']: p['product_id'] for p in inserted_products} if inserted_products else {}
    print(f"   → {len(product_map)} products created")

    # =======================================
    # TRANSPORT METHODS
    # =======================================
    print("4. Generating Transport Methods...")
    transports = [
        {"mode": "Bicycle Courier", "avg_speed_kmh": 20.0, "co2_per_km_kg": 0.0},
        {"mode": "Electric Delivery Van", "avg_speed_kmh": 60.0, "co2_per_km_kg": 0.05},
        {"mode": "Freight Truck", "avg_speed_kmh": 80.0, "co2_per_km_kg": 0.3},
        {"mode": "Cargo Flight", "avg_speed_kmh": 800.0, "co2_per_km_kg": 1.2},
        {"mode": "Sea Freight Ship", "avg_speed_kmh": 35.0, "co2_per_km_kg": 0.012},
    ]
    inserted_transports = post_data("transport_method", transports)
    print(f"   → {len(inserted_transports)} transport methods created")

    # =======================================
    # SUPPLIER INVENTORIES
    # =======================================
    print("5. Generating Supplier Inventories...")
    supplier_products = []
    
    if supplier_map and product_map:
        # Global Beans Co: Coffee from Colombia
        supplier_products.append({"supplier_id": supplier_map.get("Global Beans Co"), "product_id": product_map.get("Arabica Espresso Beans"), "price": 45.0, "priority": 1, "stock_qty": 100})
        supplier_products.append({"supplier_id": supplier_map.get("Global Beans Co"), "product_id": product_map.get("Colombian Mild Roast"), "price": 38.5, "priority": 2, "stock_qty": 50})
        supplier_products.append({"supplier_id": supplier_map.get("Global Beans Co"), "product_id": product_map.get("Ethiopian Yirgacheffe"), "price": 52.0, "priority": 1, "stock_qty": 30})
        
        # Seoul Roasters: Korean beans + matcha
        supplier_products.append({"supplier_id": supplier_map.get("Seoul Roasters"), "product_id": product_map.get("Korean Honey Process"), "price": 68.0, "priority": 1, "stock_qty": 40})
        supplier_products.append({"supplier_id": supplier_map.get("Seoul Roasters"), "product_id": product_map.get("Arabica Espresso Beans"), "price": 55.0, "priority": 2, "stock_qty": 25})
        
        # Tokyo Premium Imports: Matcha, equipment
        supplier_products.append({"supplier_id": supplier_map.get("Tokyo Premium Imports"), "product_id": product_map.get("Matcha Powder Premium"), "price": 42.0, "priority": 1, "stock_qty": 60})
        supplier_products.append({"supplier_id": supplier_map.get("Tokyo Premium Imports"), "product_id": product_map.get("V60 Pour Over Dripper"), "price": 28.0, "priority": 1, "stock_qty": 80})
        
        # Dairy Farm Dist: Dairy from USA
        supplier_products.append({"supplier_id": supplier_map.get("Dairy Farm Dist"), "product_id": product_map.get("Whole Milk (Gallon)"), "price": 5.5, "priority": 1, "stock_qty": 200})
        supplier_products.append({"supplier_id": supplier_map.get("Dairy Farm Dist"), "product_id": product_map.get("Oat Milk Barista Edition"), "price": 4.2, "priority": 1, "stock_qty": 300})
        supplier_products.append({"supplier_id": supplier_map.get("Dairy Farm Dist"), "product_id": product_map.get("Coconut Cream"), "price": 6.0, "priority": 2, "stock_qty": 80})
        
        # Sweet Syrups Inc: Syrups from France
        supplier_products.append({"supplier_id": supplier_map.get("Sweet Syrups Inc"), "product_id": product_map.get("Vanilla Bean Syrup"), "price": 12.0, "priority": 1, "stock_qty": 80})
        supplier_products.append({"supplier_id": supplier_map.get("Sweet Syrups Inc"), "product_id": product_map.get("Caramel Drizzle"), "price": 14.5, "priority": 1, "stock_qty": 40})
        
        # Mumbai Spice Trade: Chai + Syrups from India
        supplier_products.append({"supplier_id": supplier_map.get("Mumbai Spice Trade"), "product_id": product_map.get("Chai Spice Concentrate"), "price": 8.5, "priority": 1, "stock_qty": 120})
        supplier_products.append({"supplier_id": supplier_map.get("Mumbai Spice Trade"), "product_id": product_map.get("Vanilla Bean Syrup"), "price": 10.0, "priority": 2, "stock_qty": 45})
        
        # Paper Co Solutions: Equipment from China
        supplier_products.append({"supplier_id": supplier_map.get("Paper Co Solutions"), "product_id": product_map.get("12oz Paper Cups"), "price": 85.0, "priority": 1, "stock_qty": 20})
        supplier_products.append({"supplier_id": supplier_map.get("Paper Co Solutions"), "product_id": product_map.get("Wooden Stirrers"), "price": 15.0, "priority": 2, "stock_qty": 50})
        
        # Amsterdam Trade Co: International trading hub — coffee + dairy
        supplier_products.append({"supplier_id": supplier_map.get("Amsterdam Trade Co"), "product_id": product_map.get("Colombian Mild Roast"), "price": 41.0, "priority": 2, "stock_qty": 35})
        supplier_products.append({"supplier_id": supplier_map.get("Amsterdam Trade Co"), "product_id": product_map.get("Oat Milk Barista Edition"), "price": 3.8, "priority": 2, "stock_qty": 200})
        supplier_products.append({"supplier_id": supplier_map.get("Amsterdam Trade Co"), "product_id": product_map.get("Ethiopian Yirgacheffe"), "price": 58.0, "priority": 2, "stock_qty": 20})
        
        # Overlapping stock for competition
        supplier_products.append({"supplier_id": supplier_map.get("Global Beans Co"), "product_id": product_map.get("Vanilla Bean Syrup"), "price": 13.5, "priority": 2, "stock_qty": 10})
        
        # Filter out None values
        supplier_products = [sp for sp in supplier_products if sp.get('supplier_id') and sp.get('product_id')]
        post_data("supplier_product", supplier_products)
        print(f"   → {len(supplier_products)} inventory entries created")

    # =======================================
    # CARBON GOALS
    # =======================================
    print("6. Generating Carbon Goals...")
    goals = [
        {"period": "2025-Q1", "target_co2": 500.0, "actual_co2": 420.5},
        {"period": "2025-Q2", "target_co2": 450.0, "actual_co2": 380.2},
        {"period": "2025-Q3", "target_co2": 400.0, "actual_co2": None},
        {"period": "2025-Q4", "target_co2": 350.0, "actual_co2": None},
    ]
    post_data("carbon_goal", goals)
    print(f"   → {len(goals)} carbon goals created")

    print("\n========================================")
    print("  Successfully seeded Coffee Shop DB!")
    print("========================================")

if __name__ == "__main__":
    generate_coffee_data()
