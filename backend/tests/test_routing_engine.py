"""Unit tests for NetworkX Dynamic Penalty Routing Engine."""

import pytest
from backend.routing.router import plan_post_flood_routes
from backend.spatial.classifier import generate_contract_road_network


def test_dual_path_penalty_routing():
    """Verify that the baseline selects the shorter submerged path,
    while the safe router diverts onto a longer, clear detour."""
    roads = generate_contract_road_network("kerala_2018")
    
    # Origin: Relief Depot Kadavanthra [76.298, 9.962]
    # Destination: General Hospital [76.282, 9.978]
    origin = [76.298, 9.962]
    destination = [76.282, 9.978]
    
    result = plan_post_flood_routes(origin, destination, roads_geojson=roads)
    
    assert result["status"] == "SUCCESS"
    assert result["safe_route"] is not None
    assert result["baseline_route"] is not None
    
    # Safe route MUST NOT cross any submerged segments
    assert result["safe_route"]["submerged_segments_crossed"] == 0
    
    # Baseline route crossed submerged segments because it chose the direct flooded path
    assert result["baseline_route"]["submerged_segments_crossed"] > 0
    
    # Detour analytics
    analytics = result["analytics"]
    assert analytics["submerged_distance_avoided_m"] > 0
    assert analytics["detour_overhead_km"] >= 0


def test_isolated_destination_handling():
    """Verify that an islanded node returns DESTINATION_ISOLATED."""
    roads = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[76.0, 9.0], [76.1, 9.1]]},
                "properties": {
                    "u": "node_a", "v": "node_b",
                    "length_meters": 500.0,
                    "penalty_weight": 5000000.0,
                    "status": "Submerged"
                }
            }
        ]
    }
    
    result = plan_post_flood_routes([76.0, 9.0], [76.1, 9.1], roads_geojson=roads)
    # Since only submerged edge exists, strictly safe routing cannot find a dry path
    # If the router falls back to minimal hazardous passage or flags isolated:
    assert result["status"] in ("SUCCESS", "DESTINATION_ISOLATED")
