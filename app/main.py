import os
import math
import random
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(env_path)

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
    route_legs: list = []  # Multi-leg journey data

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
    res = supabase.table("product").select("*, supplier_product(*, supplier(*))").execute()
    data = res.data or []
    
    valid_products = []
    for p in data:
        sps = p.get("supplier_product") or []
        stock_sps = [sp for sp in sps if sp.get("stock_qty", 0) > 0]
        if stock_sps:
            p["supplier_product"] = stock_sps
            valid_products.append(p)
            
    return valid_products

from app.services.transport_engine import compute_routes, rank_routes

@app.get("/api/storefront/routes/{product_id}/{supplier_id}")
def get_routes(product_id: str, supplier_id: str, preference: str = "balanced", dest_city: str = "New York"):
    # 1. Fetch transport methods
    transports_res = supabase.table("transport_method").select("*").execute()
    transports = transports_res.data
    if not transports:
        return []
        
    # 2. Fetch Supplier to get their city
    sup_res = supabase.table("supplier").select("city").eq("supplier_id", supplier_id).execute()
    if not sup_res.data:
        supplier_city = "New York"
    else:
        supplier_city = sup_res.data[0].get("city", "New York")
        
    # 3. Fetch Product to get its weight
    prod_res = supabase.table("product").select("weight_kg").eq("product_id", product_id).execute()
    if not prod_res.data:
        weight_kg = 1.0
    else:
        weight_kg = float(prod_res.data[0].get("weight_kg", 1.0))
        
    # 4. Use the Transport Engine to generate multi-leg optimized routes
    routes = compute_routes(supplier_city, dest_city, weight_kg, transports, preference)
    return routes

@app.post("/api/storefront/order")
def place_order(order: OrderRequest):
    try:
        # 1. Fetch current stock
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
        
        # 3. Create Order Item(s) — directly with product_id + supplier_id (no involves table)
        item_data = {
            "order_id": new_order_id,
            "product_id": order.product_id,
            "supplier_id": order.supplier_id,
            "quantity": order.quantity,
            "unit_price": order.unit_price,
            "item_co2_kg": order.item_co2_kg
        }
        supabase.table("order_item").insert(item_data).execute()
        
        # 4. Inventory Depletion
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
    
    # Directly query order_item with nested product lookup via supplier_product
    oi_res = supabase.table("order_item").select("*, supplier_product(*, product(*))").in_("order_id", order_ids).execute()
    order_items = oi_res.data or []
    
    for o in orders:
        o["order_item"] = []
        matching_ois = [oi for oi in order_items if oi["order_id"] == o["order_id"]]
        for oi in matching_ois:
            product_info = None
            if oi.get("supplier_product") and oi["supplier_product"].get("product"):
                product_info = oi["supplier_product"]["product"]
            o["order_item"].append({
                "quantity": oi.get("quantity", 1),
                "unit_price": oi.get("unit_price", 0),
                "item_co2_kg": oi.get("item_co2_kg", 0),
                "product": product_info
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
    # Query order_items that reference this supplier directly (no involves table)
    oi_res = supabase.table("order_item").select("*, supplier_product(*, product(*))").eq("supplier_id", supplier_id).execute()
    items = oi_res.data or []
    if not items: return []
    
    order_ids = list(set([str(item["order_id"]) for item in items]))
    o_res = supabase.table("orders").select("*").in_("order_id", order_ids).execute()
    all_orders = o_res.data or []
    
    result = []
    for item in items:
        matching_order = next((o for o in all_orders if o["order_id"] == item["order_id"]), None)
        if matching_order and matching_order.get("status") != "dismissed":
            product_info = None
            if item.get("supplier_product") and item["supplier_product"].get("product"):
                product_info = item["supplier_product"]["product"]
            result.append({
                "order_id": item["order_id"],
                "item_id": item["item_id"],
                "orders": matching_order,
                "order_item": item,
                "product": product_info
            })
            
    return result

@app.post("/api/seller/orders/{order_id}/dismiss")
def dismiss_order(order_id: str):
    res = supabase.table("orders").update({"status": "dismissed"}).eq("order_id", order_id).execute()
    return {"success": True}

# ==========================================
# TRANSPORT ENGINE API
# ==========================================

@app.get("/api/transport/cities")
def get_available_cities():
    """Return the list of cities the transport engine knows about."""
    from app.services.transport_engine import CITY_COORDS
    return [{"name": city, "lat": coords[0], "lng": coords[1]} for city, coords in CITY_COORDS.items()]

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
