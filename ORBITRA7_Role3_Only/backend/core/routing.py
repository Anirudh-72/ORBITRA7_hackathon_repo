"""
Emergency Pathfinding and Facility Reachability Solver for ORBITRA
Uses NetworkX weighted Dijkstra graph algorithms to compute safe emergency routes,
penalize partially flooded roads, avoid submerged cut-offs, and diagnose isolated POIs.
"""

import math
import logging
from typing import Dict, Any, List, Tuple, Optional
import networkx as nx
from shapely.geometry import LineString, Point
import shapely.geometry

logger = logging.getLogger(__name__)

def build_conservative_graph(classified_geojson: Dict[str, Any]) -> nx.DiGraph:
    """Only Clear roads. Completely avoids Partially Flooded and Submerged."""
    G = nx.DiGraph()
    for feat in classified_geojson.get("features", []):
        props = feat.get("properties", {})
        status = props.get("status")
        u = str(props.get("u"))
        v = str(props.get("v"))
        length_m = float(props.get("length_m", 100.0))
        edge_id = str(feat.get("id", props.get("id", props.get("edge_id", f"{u}-{v}"))))
        
        if status != "Clear":
            continue
            
        G.add_edge(
            u, v,
            weight=length_m,
            length_m=length_m,
            travel_time_sec=(length_m / 1000.0) / 40.0 * 3600.0,
            name=props.get("name", "Road"),
            status=status,
            color=props.get("color", "#10B981"),
            flooded_pct=props.get("flooded_pct", 0.0),
            coordinates=feat.get("geometry", {}).get("coordinates", []),
            edge_id=edge_id
        )
    return G

def build_penalized_graph(classified_geojson: Dict[str, Any], partial_penalty=10.0) -> nx.DiGraph:
    """Clear (1x) and Partially Flooded (10x). Excludes Submerged."""
    G = nx.DiGraph()
    for feat in classified_geojson.get("features", []):
        props = feat.get("properties", {})
        status = props.get("status")
        u = str(props.get("u"))
        v = str(props.get("v"))
        length_m = float(props.get("length_m", 100.0))
        edge_id = str(feat.get("id", props.get("id", props.get("edge_id", f"{u}-{v}"))))
        
        if status == "Submerged":
            continue
            
        if status == "Partially Flooded":
            weight = length_m * partial_penalty
            speed_kmh = 8.0
        else:
            weight = length_m
            speed_kmh = 40.0
            
        G.add_edge(
            u, v,
            weight=weight,
            length_m=length_m,
            travel_time_sec=(length_m / 1000.0) / speed_kmh * 3600.0,
            name=props.get("name", "Road"),
            status=status,
            color=props.get("color", "#10B981"),
            flooded_pct=props.get("flooded_pct", 0.0),
            coordinates=feat.get("geometry", {}).get("coordinates", []),
            edge_id=edge_id
        )
    return G

def build_routing_graph(classified_geojson: Dict[str, Any]) -> nx.DiGraph:
    """Backward compatibility: defaults to penalized emergency graph."""
    return build_penalized_graph(classified_geojson)

def build_unconstrained_graph(classified_geojson: Dict[str, Any]) -> nx.DiGraph:
    unconstrained_G = nx.DiGraph()
    for feat in classified_geojson.get("features", []):
        props = feat.get("properties", {})
        u = str(props.get("u"))
        v = str(props.get("v"))
        length_m = float(props.get("length_m", 100.0))
        status = props.get("status", "Clear")
        edge_id = str(feat.get("id", props.get("id", props.get("edge_id", f"{u}-{v}"))))
        unconstrained_G.add_edge(
            u, v, weight=length_m, length_m=length_m, name=props.get("name", "Road"),
            status=status, color=props.get("color", "#10B981"),
            flooded_pct=props.get("flooded_pct", 0.0),
            coordinates=feat.get("geometry", {}).get("coordinates", []),
            edge_id=edge_id
        )
    return unconstrained_G

def find_nearest_node(lat, lon, base_graph, traversable_graph=None):
    best_node = None
    min_dist_m = float("inf")
    for nid, data in base_graph.nodes(data=True):
        n_lon = float(data.get("x", data.get("lon", 0.0)))
        n_lat = float(data.get("y", data.get("lat", 0.0)))
        mid_lat = (lat + n_lat) / 2.0
        dx = (lon - n_lon) * 111320.0 * math.cos(math.radians(mid_lat))
        dy = (lat - n_lat) * 111320.0
        dist_m = math.sqrt(dx * dx + dy * dy)
        if dist_m < min_dist_m:
            min_dist_m = dist_m
            best_node = str(nid)
    return best_node, min_dist_m

def _compute_route_details(path_nodes, routing_graph, base_graph, start_lon, start_lat, end_lon, end_lat):
    full_coords = [[start_lon, start_lat]]
    total_physical_m = 0.0
    total_time_sec = 0.0
    warnings = []
    segment_ids = []
    
    for i in range(len(path_nodes) - 1):
        u = path_nodes[i]
        v = path_nodes[i + 1]
        edge_data = routing_graph[u][v]
        
        segment_ids.append(edge_data.get("edge_id", f"{u}-{v}"))
        length_m = edge_data["length_m"]
        total_physical_m += length_m
        total_time_sec += edge_data.get("travel_time_sec", 0.0)
        
        coords = edge_data.get("coordinates")
        if coords:
            for pt in coords:
                if full_coords and full_coords[-1] != pt:
                    full_coords.append(pt)
        else:
            nu = base_graph.nodes[u]
            nv = base_graph.nodes[v]
            full_coords.append([float(nu["x"]), float(nu["y"])])
            full_coords.append([float(nv["x"]), float(nv["y"])])
            
        accumulated_km = round(total_physical_m / 1000.0, 2)
        if edge_data.get("status") == "Partially Flooded":
            pct = edge_data.get("flooded_pct", 0.0)
            road_name = edge_data.get("name", "Road")
            warnings.append({
                "km_mark": accumulated_km,
                "road_name": road_name,
                "flooded_pct": pct,
                "severity": "WARNING",
                "message": f"At KM {accumulated_km}: {road_name} is partially flooded ({pct}% water cover). Speed restricted to 8 km/h."
            })
            
    full_coords.append([end_lon, end_lat])
    return {
        "full_coords": full_coords,
        "total_km": round(total_physical_m / 1000.0, 2),
        "travel_time_min": round(total_time_sec / 60.0, 1),
        "warnings": warnings,
        "segment_ids": segment_ids
    }

def find_safe_route(
    start_lat: float, start_lon: float,
    end_lat: float, end_lon: float,
    base_graph: nx.MultiDiGraph,
    routing_graph: nx.DiGraph,
    unconstrained_graph: Optional[nx.DiGraph] = None,
    conservative_graph: Optional[nx.DiGraph] = None,
    mode: str = "auto"
) -> Dict[str, Any]:
    
    start_node, _ = find_nearest_node(start_lat, start_lon, base_graph)
    end_node, _ = find_nearest_node(end_lat, end_lon, base_graph)
    
    # 1. Naive Unconstrained Route
    unconstrained_route_geojson = None
    naive_distance_km = 0.0
    submerged_avoided_count = 0
    if unconstrained_graph and start_node and end_node:
        if unconstrained_graph.has_node(start_node) and unconstrained_graph.has_node(end_node):
            if nx.has_path(unconstrained_graph, start_node, end_node):
                try:
                    naive_nodes = nx.shortest_path(unconstrained_graph, start_node, end_node, weight="weight")
                    naive_details = _compute_route_details(naive_nodes, unconstrained_graph, base_graph, start_lon, start_lat, end_lon, end_lat)
                    naive_distance_km = naive_details["total_km"]
                    
                    submerged_segments = []
                    for i in range(len(naive_nodes) - 1):
                        u, v = naive_nodes[i], naive_nodes[i+1]
                        if unconstrained_graph[u][v].get("status") == "Submerged":
                            name = unconstrained_graph[u][v].get("name", "Segment")
                            if name not in submerged_segments:
                                submerged_segments.append(name)
                    submerged_avoided_count = len(submerged_segments)
                    
                    unconstrained_route_geojson = {
                        "type": "Feature",
                        "properties": {
                            "name": f"Naive Shortest Path ({naive_distance_km} km)",
                            "total_distance_km": naive_distance_km,
                            "submerged_avoided_count": submerged_avoided_count,
                            "submerged_segments": submerged_segments,
                            "is_naive": True
                        },
                        "geometry": {"type": "LineString", "coordinates": naive_details["full_coords"]}
                    }
                except:
                    pass
                    
    # Error Handling for invalid input
    if not start_node or not end_node:
        return _make_error_resp("INVALID_INPUT", "Unable to map start or destination to road network.", unconstrained_route_geojson, naive_distance_km, submerged_avoided_count)
        
    # Check graph isolation on penalized (or primary) graph
    if not routing_graph.has_node(start_node):
        return _make_error_resp("NO_ROUTE_ORIGIN_CUTOFF", "Origin starting location is surrounded by submerged roads. Vehicles cannot depart safely.", unconstrained_route_geojson, naive_distance_km, submerged_avoided_count, ["CRITICAL: Departure sector is marooned by floodwater."])
    if not routing_graph.has_node(end_node):
        return _make_error_resp("NO_ROUTE_DESTINATION_CUTOFF", "Destination is completely cut off by submerged access roads.", unconstrained_route_geojson, naive_distance_km, submerged_avoided_count, ["CRITICAL: Destination is completely cut off by floodwater."])
        
    # Mode resolution
    graph_to_use = None
    route_status = "FOUND_WITH_WARNINGS"
    
    if mode == "conservative" and conservative_graph:
        if conservative_graph.has_node(start_node) and conservative_graph.has_node(end_node) and nx.has_path(conservative_graph, start_node, end_node):
            graph_to_use = conservative_graph
            route_status = "FOUND_CLEAR"
        else:
            return _make_error_resp("NO_ROUTE_BLOCKED", "Conservative mode requested, but no fully clear path exists.", unconstrained_route_geojson, naive_distance_km, submerged_avoided_count)
    elif mode == "emergency":
        if nx.has_path(routing_graph, start_node, end_node):
            graph_to_use = routing_graph
        else:
            return _make_error_resp("NO_ROUTE_BLOCKED", "No continuous safe path exists. All corridors have submerged segments.", unconstrained_route_geojson, naive_distance_km, submerged_avoided_count)
    else:
        # "auto" mode
        if conservative_graph and conservative_graph.has_node(start_node) and conservative_graph.has_node(end_node) and nx.has_path(conservative_graph, start_node, end_node):
            graph_to_use = conservative_graph
            route_status = "FOUND_CLEAR"
        elif nx.has_path(routing_graph, start_node, end_node):
            graph_to_use = routing_graph
            route_status = "FOUND_WITH_WARNINGS"
        else:
            return _make_error_resp("NO_ROUTE_BLOCKED", "No continuous safe path exists.", unconstrained_route_geojson, naive_distance_km, submerged_avoided_count, ["CRITICAL: All available bridge crossings or road causeways to this destination are submerged."])

    # Compute path
    path_nodes = nx.shortest_path(graph_to_use, start_node, end_node, weight="weight")
    details = _compute_route_details(path_nodes, graph_to_use, base_graph, start_lon, start_lat, end_lon, end_lat)
    
    # Adjust status if emergency found no partials anyway
    if route_status == "FOUND_WITH_WARNINGS" and len(details["warnings"]) == 0:
        route_status = "FOUND_CLEAR"
        
    dist_penalty_km = max(0.0, round(details["total_km"] - naive_distance_km, 2)) if naive_distance_km > 0 else 0.0

    route_geojson = {
        "type": "Feature",
        "properties": {
            "name": f"Safe Emergency Route ({details['total_km']} km)",
            "total_distance_km": details["total_km"],
            "travel_time_min": details["travel_time_min"],
            "start_node": start_node,
            "end_node": end_node,
            "warning_count": len(details["warnings"]),
            "distance_penalty_km": dist_penalty_km,
            "submerged_avoided_count": submerged_avoided_count,
        },
        "geometry": {"type": "LineString", "coordinates": details["full_coords"]}
    }
    
    return {
        "is_reachable": True,
        "route_status": route_status,
        "message": f"Safe route computed ({details['total_km']} km, ~{details['travel_time_min']} mins).",
        "route_geojson": route_geojson,
        "unconstrained_route_geojson": unconstrained_route_geojson,
        "total_distance_km": details["total_km"],
        "travel_time_min": details["travel_time_min"],
        "naive_distance_km": naive_distance_km,
        "submerged_avoided_count": submerged_avoided_count,
        "distance_penalty_km": dist_penalty_km,
        "warnings": details["warnings"],
        "nodes_traversed": path_nodes,
        "segment_ids": details["segment_ids"],
        "cost_label": "Physical Road Length (Meters)",
        "safety_disclaimer": "Passability is an inferred geospatial exposure metric based on satellite inundation boundaries, not field-verified structural or water-depth safety."
    }

def _make_error_resp(status, message, unconstrained_route, naive_dist, submerged_avoided, warnings=None):
    return {
        "is_reachable": False,
        "route_status": status,
        "message": message,
        "route_geojson": None,
        "unconstrained_route_geojson": unconstrained_route,
        "total_distance_km": 0.0,
        "travel_time_min": 0.0,
        "naive_distance_km": naive_dist,
        "submerged_avoided_count": submerged_avoided,
        "distance_penalty_km": 0.0,
        "warnings": warnings or [],
        "segment_ids": [],
        "cost_label": "Physical Road Length (Meters)",
        "safety_disclaimer": "Passability is an inferred geospatial exposure metric based on satellite inundation boundaries, not field-verified structural or water-depth safety."
    }
    
def evaluate_cutoff_pois(pois, depot_poi_id, base_graph, routing_graph):
    depot = next((p for p in pois if p.get("id") == depot_poi_id or p.get("is_headquarters")), None)
    if not depot and pois: depot = pois[0]
    if not depot: return {"pois": []}
    depot_node, _ = find_nearest_node(depot["lat"], depot["lon"], base_graph)
    results = []
    accessible_count = cutoff_count = 0
    depot_accessible = routing_graph.has_node(depot_node)
    
    for poi in pois:
        is_depot = poi.get("id") == depot.get("id")
        poi_node, _ = find_nearest_node(poi["lat"], poi["lon"], base_graph)
        
        if is_depot:
            status, is_cutoff, dist_km, reason = "Accessible (HQ)", False, 0.0, "Main Logistics Headquarters."
        elif not depot_accessible:
            status, is_cutoff, dist_km, reason = "Completely Cut Off", True, 0.0, "Main relief depot is itself surrounded by submerged roads."
        elif not routing_graph.has_node(poi_node):
            status, is_cutoff, dist_km, reason = "Completely Cut Off", True, 0.0, "Nearest access road is submerged under floodwaters."
        elif not nx.has_path(routing_graph, depot_node, poi_node):
            status, is_cutoff, dist_km, reason = "Completely Cut Off", True, 0.0, "All connecting bridges and road corridors are submerged."
        else:
            path_length_m = nx.shortest_path_length(routing_graph, depot_node, poi_node, weight="length_m")
            dist_km = round(path_length_m / 1000.0, 2)
            status, is_cutoff, reason = "Accessible", False, f"Reachable via safe corridors ({dist_km} km)."
            
        if is_cutoff: cutoff_count += 1
        else: accessible_count += 1
        
        p = dict(poi)
        p.update({"accessibility_status": status, "is_cutoff": is_cutoff, "distance_from_depot_km": dist_km, "assessment_reason": reason})
        results.append(p)
        
    return {
        "depot_id": depot.get("id"),
        "depot_name": depot.get("name"),
        "total_evaluated": len(pois),
        "accessible_count": accessible_count,
        "cutoff_count": cutoff_count,
        "pois": results,
    }

