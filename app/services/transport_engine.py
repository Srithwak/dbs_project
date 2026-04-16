import math
import random

# ============================================================
# CITY COORDINATE DATABASE
# ============================================================
CITY_COORDS = {
    # Asia
    "Seoul": (37.5665, 126.9780),
    "Tokyo": (35.6762, 139.6503),
    "Shanghai": (31.2304, 121.4737),
    "Shenzhen": (22.5431, 114.0579),
    "Mumbai": (19.0760, 72.8777),
    "Dubai": (25.2048, 55.2708),
    # Europe
    "Istanbul": (41.0082, 28.9784),
    "Amsterdam": (52.3676, 4.9041),
    "London": (51.5074, -0.1278),
    "Paris": (48.8566, 2.3522),
    # Americas
    "New York": (40.7128, -74.0060),
    "Los Angeles": (34.0522, -118.2437),
    "Bogota": (4.7110, -74.0721),
    "Sao Paulo": (-23.5505, -46.6333),
    # USA Domestic
    "Wisconsin": (44.5000, -89.5000),
    "Chicago": (41.8781, -87.6298),
    # Africa
    "Nairobi": (-1.2921, 36.8219),
}

# Common transit hubs for multi-leg shipping
TRANSIT_HUBS = {
    "Asia-Americas": ["Shanghai", "Tokyo", "Los Angeles"],
    "Asia-Europe": ["Dubai", "Istanbul", "Amsterdam"],
    "Americas-Europe": ["New York", "London"],
    "Domestic-US": ["Chicago", "Los Angeles", "New York"],
    "Africa-Europe": ["Nairobi", "Istanbul", "Amsterdam"],
    "South-America-North": ["Bogota", "New York"],
}

# Which region each city belongs to
CITY_REGIONS = {
    "Seoul": "Asia", "Tokyo": "Asia", "Shanghai": "Asia",
    "Shenzhen": "Asia", "Mumbai": "Asia", "Dubai": "Middle-East",
    "Istanbul": "Europe", "Amsterdam": "Europe", "London": "Europe",
    "Paris": "Europe", "New York": "Americas", "Los Angeles": "Americas",
    "Bogota": "South-America", "Sao Paulo": "South-America",
    "Wisconsin": "Americas", "Chicago": "Americas", "Nairobi": "Africa",
}


def haversine(coord1, coord2):
    """Great circle distance in km between two (lat, lon) points."""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return c * 6371  # Earth radius in km


def get_coords(city_name):
    """Lookup coordinates for a city, with fuzzy fallback."""
    if city_name in CITY_COORDS:
        return CITY_COORDS[city_name]
    # Try case-insensitive
    for k, v in CITY_COORDS.items():
        if k.lower() == city_name.lower():
            return v
    return CITY_COORDS["New York"]  # default fallback


def _leg_cost(distance_km, weight_kg, mode):
    """Compute shipping cost for a single leg."""
    base_fee = 8.0
    if "Bicycle" in mode:
        cost_per_km = 0.50
        if distance_km > 500:
            return None  # Bicycle can't do long haul
    elif "Flight" in mode or "Air" in mode:
        cost_per_km = 0.08
    elif "Van" in mode or "Electric" in mode:
        cost_per_km = 0.03
        if distance_km > 2000:
            return None  # Vans can't cross oceans
    elif "Ship" in mode or "Sea" in mode:
        cost_per_km = 0.008
    else:  # Freight Truck
        cost_per_km = 0.015
        if distance_km > 5000:
            return None  # Trucks can't cross oceans
    return base_fee + (distance_km * cost_per_km * max(weight_kg * 0.3, 1.0))


def _compute_leg(origin, destination, weight_kg, transport, seq):
    """Compute metrics for a single journey leg."""
    origin_coord = get_coords(origin)
    dest_coord = get_coords(destination)
    distance_km = haversine(origin_coord, dest_coord)

    if distance_km < 1:
        return None

    mode = transport.get("mode", "Freight Truck")
    speed = float(transport.get("avg_speed_kmh", 50))
    co2_factor = float(transport.get("co2_per_km_kg", 0.1))

    cost = _leg_cost(distance_km, weight_kg, mode)
    if cost is None:
        return None

    hours = distance_km / speed if speed > 0 else 9999
    days = math.ceil(hours / 24) + 1  # +1 for handling
    co2_kg = distance_km * co2_factor * weight_kg

    return {
        "journey_seq": seq,
        "origin": origin,
        "destination": destination,
        "origin_coords": list(origin_coord),
        "dest_coords": list(dest_coord),
        "distance_km": round(distance_km, 1),
        "transport_mode": mode,
        "transport_id": transport.get("transport_id"),
        "estimated_days": days,
        "co2_kg": round(co2_kg, 2),
        "cost": round(cost, 2),
    }


def _find_hub_routes(origin_city, dest_city):
    """Find plausible multi-leg routes via transit hubs."""
    origin_region = CITY_REGIONS.get(origin_city, "")
    dest_region = CITY_REGIONS.get(dest_city, "Americas")

    routes = []

    # Always include direct
    routes.append([origin_city, dest_city])

    # Find hub chains
    all_hubs = set()
    for key, cities in TRANSIT_HUBS.items():
        regions_in_key = key.split("-")
        # Check if origin/dest regions relate to this hub group
        o_match = any(r.lower() in origin_region.lower() for r in regions_in_key)
        d_match = any(r.lower() in dest_region.lower() for r in regions_in_key)
        if o_match or d_match:
            for c in cities:
                if c != origin_city and c != dest_city:
                    all_hubs.add(c)

    # Generate 1-hub routes
    for hub in all_hubs:
        routes.append([origin_city, hub, dest_city])

    # Generate 2-hub routes (pick a couple interesting ones)
    hub_list = list(all_hubs)
    if len(hub_list) >= 2:
        for i in range(min(3, len(hub_list))):
            for j in range(i + 1, min(4, len(hub_list))):
                h1, h2 = hub_list[i], hub_list[j]
                # Order by geographic progression (simple longitude sort)
                c1 = get_coords(h1)
                c2 = get_coords(h2)
                co = get_coords(origin_city)
                cd = get_coords(dest_city)
                hubs_sorted = sorted([(h1, c1), (h2, c2)],
                                     key=lambda x: abs(x[1][1] - co[1]))
                routes.append([origin_city, hubs_sorted[0][0], hubs_sorted[1][0], dest_city])

    return routes[:8]  # cap at 8 route options


def compute_routes(supplier_city, dest_city, weight_kg, transports, preference="balanced"):
    """
    Core Transport Optimization Engine.
    Generates multi-leg routes from supplier_city to dest_city,
    evaluates each using available transport methods, and ranks based on preference.

    Each route is a list of journey legs. The engine tries direct routes
    and routes through intermediate transit hubs.

    Args:
        supplier_city: Origin city name
        dest_city: Destination city name (defaults to "New York" if not found)
        weight_kg: Product weight
        transports: List of transport_method records from DB
        preference: "fastest" | "cheapest" | "greenest" | "balanced"

    Returns:
        List of route options, each with legs[], totals, and a tag.
    """
    if not dest_city or dest_city not in CITY_COORDS:
        dest_city = "New York"
    if not supplier_city or supplier_city not in CITY_COORDS:
        supplier_city = "New York"

    hub_routes = _find_hub_routes(supplier_city, dest_city)

    all_routes = []

    for waypoints in hub_routes:
        # Try each transport method for all legs (homogeneous transport per route)
        for transport in transports:
            legs = []
            valid = True
            for i in range(len(waypoints) - 1):
                leg = _compute_leg(waypoints[i], waypoints[i + 1], weight_kg, transport, i + 1)
                if leg is None:
                    valid = False
                    break
                legs.append(leg)

            if not valid or not legs:
                continue

            total_distance = sum(l["distance_km"] for l in legs)
            total_days = sum(l["estimated_days"] for l in legs)
            total_co2 = sum(l["co2_kg"] for l in legs)
            total_cost = sum(l["cost"] for l in legs)

            route_name = " → ".join(waypoints)

            all_routes.append({
                "route_id": f"route_{transport['transport_id']}_{len(all_routes)}",
                "transport_id": transport["transport_id"],
                "mode": transport["mode"],
                "name": route_name,
                "legs": legs,
                "num_legs": len(legs),
                "total_distance_km": round(total_distance, 1),
                "estimated_days": total_days,
                "co2_impact_kg": round(total_co2, 2),
                "shipping_cost": round(total_cost, 2),
            })

    # Also generate a few mixed-transport routes (different transport per leg)
    for waypoints in hub_routes:
        if len(waypoints) <= 2:
            continue  # Skip direct for mixed (already covered)
        if len(transports) < 2:
            continue

        # Try: air for longest leg, truck/ship for shorter legs
        legs = []
        valid = True
        for i in range(len(waypoints) - 1):
            origin_c = get_coords(waypoints[i])
            dest_c = get_coords(waypoints[i + 1])
            leg_dist = haversine(origin_c, dest_c)

            # Pick transport: air for long legs, cheapest ground for short
            if leg_dist > 3000:
                t = next((t for t in transports if "Flight" in t.get("mode", "") or "Air" in t.get("mode", "")), transports[0])
            elif leg_dist > 500:
                t = next((t for t in transports if "Truck" in t.get("mode", "") or "Freight" in t.get("mode", "")), transports[0])
            else:
                t = next((t for t in transports if "Van" in t.get("mode", "") or "Electric" in t.get("mode", "")), transports[-1])

            leg = _compute_leg(waypoints[i], waypoints[i + 1], weight_kg, t, i + 1)
            if leg is None:
                valid = False
                break
            legs.append(leg)

        if valid and legs:
            total_distance = sum(l["distance_km"] for l in legs)
            total_days = sum(l["estimated_days"] for l in legs)
            total_co2 = sum(l["co2_kg"] for l in legs)
            total_cost = sum(l["cost"] for l in legs)
            route_name = " → ".join(waypoints)

            all_routes.append({
                "route_id": f"route_mixed_{len(all_routes)}",
                "transport_id": legs[0]["transport_id"],  # primary transport
                "mode": "Mixed (" + " / ".join(set(l["transport_mode"] for l in legs)) + ")",
                "name": route_name,
                "legs": legs,
                "num_legs": len(legs),
                "total_distance_km": round(total_distance, 1),
                "estimated_days": total_days,
                "co2_impact_kg": round(total_co2, 2),
                "shipping_cost": round(total_cost, 2),
            })

    if not all_routes:
        return []

    # ============================================================
    # RANKING
    # ============================================================
    all_routes = rank_routes(all_routes, preference)

    return all_routes


def rank_routes(routes, preference="balanced"):
    """Rank routes based on user preference and tag the top ones."""
    if not routes:
        return routes

    max_days = max(r["estimated_days"] for r in routes) or 1
    max_co2 = max(r["co2_impact_kg"] for r in routes) or 1
    max_cost = max(r["shipping_cost"] for r in routes) or 1

    weights = {
        "fastest":  {"time": 0.7, "co2": 0.1, "cost": 0.2},
        "cheapest": {"time": 0.1, "co2": 0.2, "cost": 0.7},
        "greenest": {"time": 0.1, "co2": 0.7, "cost": 0.2},
        "balanced": {"time": 0.34, "co2": 0.33, "cost": 0.33},
    }
    w = weights.get(preference, weights["balanced"])

    for r in routes:
        score = (
            w["time"] * (r["estimated_days"] / max_days) +
            w["co2"] * (r["co2_impact_kg"] / max_co2) +
            w["cost"] * (r["shipping_cost"] / max_cost)
        )
        r["score"] = round(score, 4)

    routes.sort(key=lambda r: r["score"])

    # Tag top routes
    for r in routes:
        r.pop("tag", None)

    # Find category bests
    fastest = min(routes, key=lambda r: r["estimated_days"])
    greenest = min(routes, key=lambda r: r["co2_impact_kg"])
    cheapest = min(routes, key=lambda r: r["shipping_cost"])

    # The overall top by score is "Recommended"
    routes[0]["tag"] = "Recommended"

    if "tag" not in fastest:
        fastest["tag"] = "Fastest"
    if "tag" not in greenest:
        greenest["tag"] = "Eco-Friendly"
    if "tag" not in cheapest:
        cheapest["tag"] = "Cheapest"

    for r in routes:
        if "tag" not in r:
            r["tag"] = "Standard"

    # Limit to top 6 most distinct routes
    return routes[:6]
