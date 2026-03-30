import math

# A simulated basic coordinates map to act as our "geography" for calculating distances.
# In a real-world scenario, we would use an API like Google Maps or Geopy to resolve these.
CITY_COORDS = {
    # format: (latitude, longitude)
    "Bogota": (4.7110, -74.0721),       # Colombia
    "Wisconsin": (44.5000, -89.5000),   # USA (approx state center)
    "Paris": (48.8566, 2.3522),         # France
    "Shenzhen": (22.5431, 114.0579),    # China
    "New York": (40.7128, -74.0060)     # Default proxy destination
}

def haversine(coord1, coord2):
    """
    Calculate the great circle distance in kilometers between two points 
    on the earth (specified in decimal degrees)
    """
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    
    # Convert latitude and longitude to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371 # Radius of earth in kilometers
    return c * r

def get_distance(origin_city: str, dest_city: str = "New York") -> float:
    """Returns the distance between origin and destination in km."""
    origin_coord = CITY_COORDS.get(origin_city)
    dest_coord = CITY_COORDS.get(dest_city, CITY_COORDS["New York"])
    
    if not origin_coord:
        return 5000.0 # fallback default distance
        
    return haversine(origin_coord, dest_coord)

def compute_routes(supplier_city: str, product_weight_kg: float, transport_methods: list):
    """
    Core Transport Optimization Engine.
    Given an origin city and product details, it evaluates all transport methods
    and returns ranked route options based on cost, CO2, and time.
    """
    distance_km = get_distance(supplier_city, "New York")
    
    # If the product originates in the same proxy area (e.g. Wisconsin to NY),
    # the distance is much smaller. Still, we apply realistic formulas.
    
    routes = []
    
    for t in transport_methods:
        mode = t.get("mode")
        speed = float(t.get("avg_speed_kmh", 50))
        co2_factor = float(t.get("co2_per_km_kg", 0.1))
        
        # 1. Delivery Time (Days)
        # Adding a base handling time of 1 day for realism
        estimated_hours = distance_km / speed if speed > 0 else 999
        estimated_days = math.ceil(estimated_hours / 24) + 1
        
        # 2. CO2 Impact
        # footprint = distance * co2_per_km_per_kg * item_weight
        co2_impact = distance_km * co2_factor * product_weight_kg
        
        # 3. Cost
        # Simulated rate cards based on typical transport economics
        base_fee = 10.0
        if "Bicycle" in mode:
            # Short range, if distance > 500, it's not viable but we'll show it as extremely slow/expensive or filter it out.
            cost_per_km = 0.5
            if distance_km > 1000:
                continue # Bicycle can't do trans-oceanic
        elif "Flight" in mode:
            cost_per_km = 0.08 # expensive over long distance
        elif "Van" in mode:
            cost_per_km = 0.03
        else: # Freight Truck or similar
            cost_per_km = 0.015
            
        shipping_cost = base_fee + (distance_km * cost_per_km * (product_weight_kg * 0.5))
        
        routes.append({
            "route_id": f"route_{t['transport_id']}",
            "transport_id": t["transport_id"],
            "mode": mode,
            "name": f"{mode} Direct",
            "estimated_days": estimated_days,
            "co2_impact_kg": round(co2_impact, 2),
            "shipping_cost": round(shipping_cost, 2),
            "raw_score": 0 # Used for internal sorting later
        })
        
    if not routes:
        return []

    # Identify the best in each category
    fastest = min(routes, key=lambda r: r["estimated_days"])
    fastest["tag"] = "Fastest"
    
    greenest = min(routes, key=lambda r: r["co2_impact_kg"])
    if "tag" not in greenest:
        greenest["tag"] = "Eco-Friendly"
        
    cheapest = min(routes, key=lambda r: r["shipping_cost"])
    if "tag" not in cheapest:
        cheapest["tag"] = "Cheapest"
        
    # Optional: Balanced (Normalize scores and find lowest sum)
    # Give it "Optimal" tag
    max_days = max(r["estimated_days"] for r in routes) or 1
    max_co2 = max(r["co2_impact_kg"] for r in routes) or 1
    max_cost = max(r["shipping_cost"] for r in routes) or 1
    
    for r in routes:
        # Lower is better for all metrics
        score = (r["estimated_days"]/max_days) + (r["co2_impact_kg"]/max_co2) + (r["shipping_cost"]/max_cost)
        r["raw_score"] = score
        
    optimal = min(routes, key=lambda r: r["raw_score"])
    if "tag" not in optimal:
        optimal["tag"] = "Optimal"
        
    # Ensure items without a tag get a default tag
    for r in routes:
        if "tag" not in r:
            r["tag"] = "Standard"

    # Sort routes so the Optimal, Fastest, Eco-Friendly appear first
    priority = {"Optimal": 1, "Fastest": 2, "Eco-Friendly": 3, "Cheapest": 4, "Standard": 5}
    routes.sort(key=lambda a: priority.get(a.get("tag"), 6))

    return routes
