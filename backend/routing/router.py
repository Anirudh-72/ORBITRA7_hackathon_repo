"""ORBITRA7 NetworkX Dynamic Penalty Routing Engine.

Workstream: Routing Developer (coordinated with Technical Lead)
Responsible for:
- Constructing in-memory graph from classified road segments
- Dynamic weight penalty routing (Clear: 1x, Partially Flooded: 10x, Submerged: 10,000x)
- Dual route comparison: Baseline shortest path vs. Flood-aware safe path
- Calculating detour overhead (Delta km) and hazard avoidance metrics
- Catching NetworkXNoPath for flooded isolated destinations
"""

from typing import Dict, Any, List, Optional, Tuple
import math
import networkx as nx

from backend.spatial.classifier import generate_contract_road_network
from backend.live_data import hazard_db


def build_routing_graph(roads_geojson: Dict[str, Any]) -> Tuple[nx.Graph, Dict[str, List[float]]]:
    """Construct a NetworkX graph with metric length and flood penalty weights.
    
    Returns:
        (graph, node_coords_dict)
    """
    G = nx.Graph()
    node_coords: Dict[str, List[float]] = {}
    
    for feature in roads_geojson.get("features", []):
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        coords = geom.get("coordinates", [])
        
        u = props.get("u")
        v = props.get("v")
        
        # If u/v not explicit, infer from start and end points
        if not u or not v:
            if len(coords) >= 2:
                u = f"node_{coords[0][0]:.4f}_{coords[0][1]:.4f}"
                v = f"node_{coords[-1][0]:.4f}_{coords[-1][1]:.4f}"
            else:
                continue
                
        if len(coords) >= 2:
            node_coords[u] = coords[0]
            node_coords[v] = coords[-1]
            
        length_m = props.get("length_meters", 100.0)
        penalty_weight = props.get("penalty_weight", length_m)
        status = props.get("status", "Clear")
        
        G.add_edge(
            u, v,
            segment_id=props.get("segment_id", "seg"),
            name=props.get("name", "Unnamed Road"),
            length_meters=length_m,
            penalty_weight=penalty_weight,
            status=status,
            coordinates=coords
        )
        
    return G, node_coords


def find_nearest_node(point: List[float], node_coords: Dict[str, List[float]]) -> str:
    """Find the closest graph node to a [lon, lat] coordinate."""
    lon, lat = point
    best_node = None
    min_dist_sq = float("inf")
    
    for node_id, coords in node_coords.items():
        dx = (coords[0] - lon) * math.cos(math.radians(lat))
        dy = coords[1] - lat
        dist_sq = dx*dx + dy*dy
        if dist_sq < min_dist_sq:
            min_dist_sq = dist_sq
            best_node = node_id
            
    if best_node is None:
        raise ValueError("Graph contains no nodes to snap to.")
    return best_node


def compute_route_geometry_and_stats(
    G: nx.Graph,
    path_nodes: List[str]
) -> Dict[str, Any]:
    """Extract ordered LineString coordinates and hazard statistics along path nodes."""
    all_coords = []
    total_length_m = 0.0
    submerged_count = 0
    partially_flooded_count = 0
    submerged_length_m = 0.0
    
    for i in range(len(path_nodes) - 1):
        u, v = path_nodes[i], path_nodes[i+1]
        edge_data = G.get_edge_data(u, v)
        if not edge_data:
            continue
            
        edge_coords = edge_data.get("coordinates", [])
        if all_coords and edge_coords:
            all_coords.extend(edge_coords[1:])
        else:
            all_coords.extend(edge_coords)
            
        length_m = edge_data.get("length_meters", 0.0)
        status = edge_data.get("status", "Clear")
        total_length_m += length_m
        
        if status == "Submerged":
            submerged_count += 1
            submerged_length_m += length_m
        elif status == "Partially Flooded":
            partially_flooded_count += 1
            
    return {
        "geojson": {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": all_coords
            },
            "properties": {}
        },
        "distance_km": round(total_length_m / 1000.0, 2),
        "distance_meters": round(total_length_m, 1),
        "submerged_segments_crossed": submerged_count,
        "submerged_meters_crossed": round(submerged_length_m, 1),
        "partially_flooded_segments_crossed": partially_flooded_count,
        "path_node_ids": path_nodes
    }


def plan_post_flood_routes(
    origin: List[float],
    destination: List[float],
    roads_geojson: Optional[Dict[str, Any]] = None,
    scenario_id: str = "kerala_2018"
) -> Dict[str, Any]:
    """Execute dual-path route computation: Baseline shortest path vs. Flood-aware safe path.
    
    Returns full comparative telemetry according to docs/architecture.md.
    """
    if roads_geojson is None:
        roads_geojson = generate_contract_road_network(scenario_id)
        
    G, node_coords = build_routing_graph(roads_geojson)
    
    # --- APPLY LIVE HAZARD PENALTIES ---
    active_hazards = hazard_db.get_active_hazards()
    for hazard in active_hazards:
        hx, hy = hazard["coordinates"]
        try:
            h_node = find_nearest_node([hx, hy], node_coords)
            for neighbor in G.neighbors(h_node):
                edge_data = G[h_node][neighbor]
                multiplier = 10 if hazard["type"] == "pothole" else 100
                edge_data["penalty_weight"] = edge_data.get("penalty_weight", edge_data.get("length_meters", 100.0)) * multiplier
        except ValueError:
            pass
    # -----------------------------------
    
    origin_node = find_nearest_node(origin, node_coords)
    dest_node = find_nearest_node(destination, node_coords)
    
    # 1. Baseline Route (standard Dijkstra optimizing solely for physical distance)
    try:
        baseline_nodes = nx.shortest_path(G, source=origin_node, target=dest_node, weight="length_meters")
        baseline_route = compute_route_geometry_and_stats(G, baseline_nodes)
    except nx.NetworkXNoPath:
        baseline_route = None

    # 2. Flood-Aware Safe Route (Dijkstra penalizing submerged roads by 10,000x)
    # To strictly avoid submerged roads where physically possible, we first test if a path
    # exists completely avoiding Submerged roads.
    G_strictly_safe = G.copy()
    submerged_edges = [(u, v) for u, v, d in G.edges(data=True) if d.get("status") == "Submerged"]
    G_strictly_safe.remove_edges_from(submerged_edges)
    
    safe_nodes = None
    isolated = False
    
    try:
        # Check if 100% dry/partially flooded detour exists
        safe_nodes = nx.shortest_path(G_strictly_safe, source=origin_node, target=dest_node, weight="penalty_weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        # Fall back to weighted penalty on full graph (least hazardous passage)
        try:
            safe_nodes = nx.shortest_path(G, source=origin_node, target=dest_node, weight="penalty_weight")
        except nx.NetworkXNoPath:
            isolated = True

    if isolated or safe_nodes is None:
        return {
            "status": "DESTINATION_ISOLATED",
            "safe_route": None,
            "baseline_route": baseline_route,
            "analytics": {
                "detour_overhead_km": 0.0,
                "submerged_distance_avoided_m": 0.0,
                "recommendation": "Target destination is completely isolated by flood waters. Terrestrial vehicular access is blocked. Deploy amphibious logistics or aerial supply drops."
            }
        }
        
    safe_route = compute_route_geometry_and_stats(G, safe_nodes)
    
    # Analytics & Comparison
    baseline_dist = baseline_route["distance_km"] if baseline_route else safe_route["distance_km"]
    safe_dist = safe_route["distance_km"]
    detour_overhead_km = round(max(0.0, safe_dist - baseline_dist), 2)
    
    baseline_submerged_m = baseline_route.get("submerged_meters_crossed", 0.0) if baseline_route else 0.0
    safe_submerged_m = safe_route.get("submerged_meters_crossed", 0.0)
    submerged_avoided_m = round(max(0.0, baseline_submerged_m - safe_submerged_m), 1)
    
    if safe_route["submerged_segments_crossed"] == 0 and baseline_route and baseline_route["submerged_segments_crossed"] > 0:
        recommendation = f"Safe detour active: successfully avoided {submerged_avoided_m}m of submerged impassable road. Overhead: +{detour_overhead_km} km."
    elif safe_route["submerged_segments_crossed"] == 0 and (not baseline_route or baseline_route["submerged_segments_crossed"] == 0):
        recommendation = "Standard primary route is clear of flood hazards. Proceed safely."
    else:
        recommendation = f"Warning: Minimal passage requires traversing {safe_route['partially_flooded_segments_crossed']} partially flooded segments. Exercise caution with high-clearance emergency vehicles."

    return {
        "status": "SUCCESS",
        "safe_route": safe_route,
        "baseline_route": baseline_route,
        "analytics": {
            "detour_overhead_km": detour_overhead_km,
            "submerged_distance_avoided_m": submerged_avoided_m,
            "recommendation": recommendation
        }
    }
