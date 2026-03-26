import os
import random
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
url: str = os.environ.get("API_URL", "")
key: str = os.environ.get("SERVICE_ROLE_KEY", "")

if not url or not key:
    raise Exception("Supabase credentials not found in environment variables.")

supabase: Client = create_client(url, key)

app = FastAPI(title="SupplyTrack Procurement")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OrderRequest(BaseModel):
    user_id: str
    product_id: str
    supplier_id: str
    transport_id: str
    quantity: int
    unit_price: float
    total_price: float
    item_co2_kg: float
    ship_addr: str

@app.get("/api/storefront/catalog")
def get_catalog():
    # Fetch all products and their associated supplier records nested
    res = supabase.table("product").select("*, supplier_product(*, supplier(*))").execute()
    return res.data

@app.get("/api/storefront/routes/{product_id}/{supplier_id}")
def get_mock_routes(product_id: str, supplier_id: str):
    # This prepares the frontend for the real graph engine later.
    # For now, fetch available transports and generate 3 mock "routes"
    transports_res = supabase.table("transport_method").select("*").execute()
    transports = transports_res.data
    
    if not transports:
        return []
        
    routes = []
    # Mock Route 1: Fastest (High CO2, High Cost)
    t_fast = min(transports, key=lambda x: x.get('co2_per_km_kg', 0) * -1) # pick one arbitrarily using negative CO2 to get highest
    routes.append({
        "route_id": "route_1_fast",
        "transport_id": t_fast["transport_id"],
        "mode": t_fast["mode"],
        "name": f"Express {t_fast['mode']} Route",
        "estimated_days": random.randint(1, 3),
        "co2_impact_kg": round(random.uniform(50, 150), 2),
        "shipping_cost": round(random.uniform(100, 300), 2),
        "tag": "Fastest"
    })
    
    # Mock Route 2: Eco-friendly (Low CO2, Low Cost, Slow)
    t_eco = min(transports, key=lambda x: x.get('co2_per_km_kg', 0))
    routes.append({
        "route_id": "route_2_eco",
        "transport_id": t_eco["transport_id"],
        "mode": t_eco["mode"],
        "name": f"Green {t_eco['mode']} Route",
        "estimated_days": random.randint(7, 21),
        "co2_impact_kg": round(random.uniform(5, 30), 2),
        "shipping_cost": round(random.uniform(20, 80), 2),
        "tag": "Eco-Friendly"
    })
    
    # Mock Route 3: Balanced
    t_bal = random.choice(transports)
    routes.append({
        "route_id": "route_3_bal",
        "transport_id": t_bal["transport_id"],
        "mode": t_bal["mode"],
        "name": f"Standard {t_bal['mode']} Route",
        "estimated_days": random.randint(4, 8),
        "co2_impact_kg": round(random.uniform(30, 80), 2),
        "shipping_cost": round(random.uniform(50, 150), 2),
        "tag": "Balanced"
    })
    
    return routes

@app.post("/api/storefront/order")
def place_order(order: OrderRequest):
    try:
        # 1. Create the Order
        order_data = {
            "user_id": order.user_id,
            "transport_id": order.transport_id,
            "total_price": order.total_price,
            "status": "processing",
            "ship_addr": order.ship_addr
        }
        order_res = supabase.table("orders").insert(order_data).execute()
        new_order_id = order_res.data[0]['order_id']
        
        # 2. Create the Order Item
        item_data = {
            "order_id": new_order_id,
            "quantity": order.quantity,
            "unit_price": order.unit_price,
            "item_co2_kg": order.item_co2_kg
        }
        item_res = supabase.table("order_item").insert(item_data).execute()
        new_item_id = item_res.data[0]['item_id']
        
        # 3. Create the Involves linkage
        involves_data = {
            "supplier_id": order.supplier_id,
            "product_id": order.product_id,
            "order_id": new_order_id,
            "item_id": new_item_id
        }
        supabase.table("involves").insert(involves_data).execute()
        
        return {"success": True, "order_id": new_order_id}
        
    except Exception as e:
        print("Error placing order:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/storefront/users")
def get_users():
    res = supabase.table("users").select("*").execute()
    return res.data

@app.get("/api/storefront/orders/{user_id}")
def get_user_orders(user_id: str):
    res = supabase.table("orders").select("*, order_item(*, involves(*))").eq("user_id", user_id).order("order_date", desc=True).execute()
    return res.data

# Mount static files
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
