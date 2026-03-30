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

class ProductCreate(BaseModel):
    name: str
    description: str
    category: str
    weight_kg: float

class InventoryCreate(BaseModel):
    supplier_id: str
    product_id: str
    price: float
    priority: int
    stock_qty: int

# ==========================================
# BUYER STOREFRONT APIS
# ==========================================

@app.get("/api/storefront/catalog")
def get_catalog():
    # Fetch all products and their associated supplier records nested
    res = supabase.table("product").select("*, supplier_product(*, supplier(*))").execute()
    data = res.data or []
    
    valid_products = []
    for p in data:
        # Protect against non-iterables
        sps = p.get("supplier_product") or []
        # Filter only in-stock configurations
        stock_sps = [sp for sp in sps if sp.get("stock_qty", 0) > 0]
        
        # Return only products that have at least one valid supplier
        if stock_sps:
            p["supplier_product"] = stock_sps
            valid_products.append(p)
            
    return valid_products

@app.get("/api/storefront/routes/{product_id}/{supplier_id}")
def get_mock_routes(product_id: str, supplier_id: str):
    transports_res = supabase.table("transport_method").select("*").execute()
    transports = transports_res.data
    if not transports:
        return []
    routes = []
    
    # Mock Route 1: Fastest
    t_fast = min(transports, key=lambda x: x.get('co2_per_km_kg', 0) * -1)
    routes.append({
        "route_id": "route_1_fast",
        "transport_id": t_fast["transport_id"],
        "mode": t_fast["mode"],
        "name": f"Express {t_fast['mode']}",
        "estimated_days": random.randint(1, 2),
        "co2_impact_kg": round(random.uniform(50, 100), 2),
        "shipping_cost": round(random.uniform(50, 150), 2),
        "tag": "Fastest"
    })
    
    # Mock Route 2: Eco-friendly
    t_eco = min(transports, key=lambda x: x.get('co2_per_km_kg', 0))
    routes.append({
        "route_id": "route_2_eco",
        "transport_id": t_eco["transport_id"],
        "mode": t_eco["mode"],
        "name": f"Green {t_eco['mode']}",
        "estimated_days": random.randint(3, 10),
        "co2_impact_kg": round(random.uniform(2, 10), 2),
        "shipping_cost": round(random.uniform(10, 40), 2),
        "tag": "Eco-Friendly"
    })
    return routes

@app.post("/api/storefront/order")
def place_order(order: OrderRequest):
    try:
        # 1. Fetch current stock to ensure depletion
        sp_res = supabase.table("supplier_product").select("stock_qty").eq("supplier_id", order.supplier_id).eq("product_id", order.product_id).execute()
        if not sp_res.data:
            raise Exception("Product/Supplier combo not found.")
        current_stock = sp_res.data[0]['stock_qty']
        if current_stock < order.quantity:
            raise Exception("Insufficient Stock")
            
        # 2. Create the Order
        order_data = {
            "user_id": order.user_id,
            "transport_id": order.transport_id,
            "total_price": order.total_price,
            "status": "processing",
            "ship_addr": order.ship_addr
        }
        order_res = supabase.table("orders").insert(order_data).execute()
        new_order_id = order_res.data[0]['order_id']
        
        # 3. Create the Order Item
        item_data = {
            "order_id": new_order_id,
            "quantity": order.quantity,
            "unit_price": order.unit_price,
            "item_co2_kg": order.item_co2_kg
        }
        item_res = supabase.table("order_item").insert(item_data).execute()
        new_item_id = item_res.data[0]['item_id']
        
        # 4. Create the Involves linkage
        involves_data = {
            "supplier_id": order.supplier_id,
            "product_id": order.product_id,
            "order_id": new_order_id,
            "item_id": new_item_id
        }
        supabase.table("involves").insert(involves_data).execute()
        
        # 5. Inventory Depletion! Remove/decrement stock.
        new_stock = current_stock - order.quantity
        supabase.table("supplier_product").update({"stock_qty": new_stock}).eq("supplier_id", order.supplier_id).eq("product_id", order.product_id).execute()
        
        return {"success": True, "order_id": new_order_id}
        
    except Exception as e:
        print("Error placing order:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/storefront/users")
def get_users():
    res = supabase.table("users").select("*").execute()
    return res.data or []

@app.get("/api/buyer/orders/{user_id}")
def get_buyer_orders(user_id: str):
    res = supabase.table("orders").select("*").eq("user_id", user_id).execute()
    orders = res.data or []
    if not orders: return []
    
    order_ids = [str(o["order_id"]) for o in orders]
    inv_res = supabase.table("involves").select("*, supplier_product(*, product(*))").in_("order_id", order_ids).execute()
    involves = inv_res.data or []
    
    # Flatten product for frontend compatibility
    for inv in involves:
        if inv.get("supplier_product") and inv["supplier_product"].get("product"):
            inv["product"] = inv["supplier_product"]["product"]
            
    oi_res = supabase.table("order_item").select("*").in_("order_id", order_ids).execute()
    order_items = oi_res.data or []
    
    for o in orders:
        o["order_item"] = []
        matching_ois = [oi for oi in order_items if oi["order_id"] == o["order_id"]]
        for oi in matching_ois:
            oi_invs = [inv for inv in involves if inv["order_id"] == oi["order_id"] and inv["item_id"] == oi["item_id"]]
            o["order_item"].append({
                "quantity": oi.get("quantity", 1),
                "unit_price": oi.get("unit_price", 0),
                "involves": oi_invs
            })
    return orders

# ==========================================
# SELLER DASHBOARD APIS
# ==========================================

@app.get("/api/seller/suppliers")
def get_suppliers():
    res = supabase.table("supplier").select("*").execute()
    return res.data or []

@app.get("/api/seller/inventory/{supplier_id}")
def get_seller_inventory(supplier_id: str):
    res = supabase.table("supplier_product").select("*, product(*)").eq("supplier_id", supplier_id).execute()
    return res.data or []

@app.post("/api/seller/product")
def create_master_product(prod: ProductCreate):
    data = {"name": prod.name, "description": prod.description, "category": prod.category, "weight_kg": prod.weight_kg}
    res = supabase.table("product").insert(data).execute()
    return res.data[0]

@app.get("/api/seller/products")
def get_master_products():
    res = supabase.table("product").select("*").execute()
    return res.data or []

@app.post("/api/seller/inventory")
def upsert_inventory(inv: InventoryCreate):
    data = {"supplier_id": inv.supplier_id, "product_id": inv.product_id, "price": inv.price, "priority": inv.priority, "stock_qty": inv.stock_qty}
    res = supabase.table("supplier_product").upsert(data).execute()
    return {"success": True}

@app.delete("/api/seller/inventory/{supplier_id}/{product_id}")
def delete_inventory(supplier_id: str, product_id: str):
    res = supabase.table("supplier_product").update({"stock_qty": 0}).eq("supplier_id", supplier_id).eq("product_id", product_id).execute()
    return {"success": True}

@app.get("/api/seller/orders/{supplier_id}")
def get_seller_orders(supplier_id: str):
    res = supabase.table("involves").select("*, supplier_product(*, product(*))").eq("supplier_id", supplier_id).execute()
    involves = res.data or []
    if not involves: return []
    
    order_ids = list(set([str(inv["order_id"]) for inv in involves]))
    
    o_res = supabase.table("orders").select("*").in_("order_id", order_ids).execute()
    all_orders = o_res.data or []
    
    oi_res = supabase.table("order_item").select("*").in_("order_id", order_ids).execute()
    order_items = oi_res.data or []
    
    active_involves = []
    for inv in involves:
        matching_order = next((o for o in all_orders if o["order_id"] == inv["order_id"]), None)
        if matching_order and matching_order.get("status") != "dismissed":
            inv["orders"] = matching_order
            matching_oi = next((oi for oi in order_items if oi["order_id"] == inv["order_id"] and oi["item_id"] == inv["item_id"]), {})
            inv["order_item"] = matching_oi
            
            if inv.get("supplier_product") and inv["supplier_product"].get("product"):
                 inv["product"] = inv["supplier_product"]["product"]
                 
            active_involves.append(inv)
            
    return active_involves

@app.post("/api/seller/orders/{order_id}/dismiss")
def dismiss_order(order_id: int):
    # Update order status to 'dismissed' (using string interpolation for simplicity)
    res = supabase.table("orders").update({"status": "dismissed"}).eq("order_id", order_id).execute()
    return {"success": True}

# Mount static files
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
