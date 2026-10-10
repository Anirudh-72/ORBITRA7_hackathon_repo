import unittest
import networkx as nx
from backend.core.routing import (
    build_conservative_graph,
    build_penalized_graph,
    build_unconstrained_graph,
    find_safe_route,
)

class TestRoutingEngine(unittest.TestCase):
    def setUp(self):
        # Create a small reproducible road graph and classified GeoJSON
        # Nodes: A, B, C, D
        # A -> B (Clear, 100m)
        # B -> C (Submerged, 100m)
        # A -> D (Partially Flooded, 300m)
        # D -> C (Clear, 100m)
        
        # Coordinates (lon, lat)
        self.nodes = {
            "A": (0.0, 0.0),
            "B": (0.01, 0.0),
            "C": (0.01, 0.01),
            "D": (0.0, 0.01)
        }
        
        self.base_graph = nx.MultiDiGraph()
        for nid, (lon, lat) in self.nodes.items():
            self.base_graph.add_node(nid, x=lon, y=lat, lon=lon, lat=lat)
            
        self.classified_geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "id": "e_AB",
                    "properties": {"u": "A", "v": "B", "length_m": 100.0, "status": "Clear", "name": "AB_Road"},
                    "geometry": {"type": "LineString", "coordinates": [self.nodes["A"], self.nodes["B"]]}
                },
                {
                    "id": "e_BC",
                    "properties": {"u": "B", "v": "C", "length_m": 100.0, "status": "Submerged", "name": "BC_Road"},
                    "geometry": {"type": "LineString", "coordinates": [self.nodes["B"], self.nodes["C"]]}
                },
                {
                    "id": "e_AD",
                    "properties": {"u": "A", "v": "D", "length_m": 300.0, "status": "Partially Flooded", "flooded_pct": 20.0, "name": "AD_Road"},
                    "geometry": {"type": "LineString", "coordinates": [self.nodes["A"], self.nodes["D"]]}
                },
                {
                    "id": "e_DC",
                    "properties": {"u": "D", "v": "C", "length_m": 100.0, "status": "Clear", "name": "DC_Road"},
                    "geometry": {"type": "LineString", "coordinates": [self.nodes["D"], self.nodes["C"]]}
                }
            ]
        }
        
        self.conservative_G = build_conservative_graph(self.classified_geojson)
        self.penalized_G = build_penalized_graph(self.classified_geojson)
        self.unconstrained_G = build_unconstrained_graph(self.classified_geojson)

    def test_clear_route_exists(self):
        # Route A -> B is completely clear
        res = find_safe_route(
            start_lat=0.0, start_lon=0.0,
            end_lat=0.0, end_lon=0.01,
            base_graph=self.base_graph,
            routing_graph=self.penalized_G,
            unconstrained_graph=self.unconstrained_G,
            conservative_graph=self.conservative_G,
            mode="auto"
        )
        self.assertTrue(res["is_reachable"])
        self.assertEqual(res["route_status"], "FOUND_CLEAR")
        self.assertEqual(res["total_distance_km"], 0.1) # 100m
        self.assertEqual(res["segment_ids"], ["e_AB"])

    def test_submerged_avoidance_with_alternative(self):
        # Route A -> C: Naive path is A->B->C (200m). But B->C is Submerged.
        # Safe route is A->D->C (400m). D is Partial.
        res = find_safe_route(
            start_lat=0.0, start_lon=0.0,
            end_lat=0.01, end_lon=0.01,
            base_graph=self.base_graph,
            routing_graph=self.penalized_G,
            unconstrained_graph=self.unconstrained_G,
            conservative_graph=self.conservative_G,
            mode="emergency"
        )
        self.assertTrue(res["is_reachable"])
        self.assertEqual(res["route_status"], "FOUND_WITH_WARNINGS")
        self.assertEqual(res["total_distance_km"], 0.4) # A->D (300) + D->C (100)
        self.assertEqual(res["naive_distance_km"], 0.2) # A->B->C
        self.assertIn("e_AD", res["segment_ids"])
        self.assertIn("e_DC", res["segment_ids"])
        self.assertEqual(len(res["warnings"]), 1) # warning for AD_Road
        self.assertNotIn("e_BC", res["segment_ids"]) # strictly avoided
        
    def test_partial_roads_handled_by_policy(self):
        # Conservative mode should fail A->C because it requires A->D (partial)
        res_con = find_safe_route(
            start_lat=0.0, start_lon=0.0,
            end_lat=0.01, end_lon=0.01,
            base_graph=self.base_graph,
            routing_graph=self.penalized_G,
            unconstrained_graph=self.unconstrained_G,
            conservative_graph=self.conservative_G,
            mode="conservative"
        )
        self.assertFalse(res_con["is_reachable"])
        self.assertEqual(res_con["route_status"], "NO_ROUTE_BLOCKED")
        
        # Auto mode should fallback to emergency and find the partial route
        res_auto = find_safe_route(
            start_lat=0.0, start_lon=0.0,
            end_lat=0.01, end_lon=0.01,
            base_graph=self.base_graph,
            routing_graph=self.penalized_G,
            unconstrained_graph=self.unconstrained_G,
            conservative_graph=self.conservative_G,
            mode="auto"
        )
        self.assertTrue(res_auto["is_reachable"])
        self.assertEqual(res_auto["route_status"], "FOUND_WITH_WARNINGS")
        
    def test_all_routes_blocked(self):
        # Make all roads leaving A Submerged
        geo = dict(self.classified_geojson)
        for f in geo["features"]:
            if f["properties"]["u"] == "A":
                f["properties"]["status"] = "Submerged"
        
        blocked_G = build_penalized_graph(geo)
        res = find_safe_route(
            start_lat=0.0, start_lon=0.0,
            end_lat=0.01, end_lon=0.01,
            base_graph=self.base_graph,
            routing_graph=blocked_G,
            unconstrained_graph=self.unconstrained_G,
            mode="auto"
        )
        self.assertFalse(res["is_reachable"])
        self.assertEqual(res["route_status"], "NO_ROUTE_ORIGIN_CUTOFF")

    def test_destination_disconnected(self):
        # Add a node E that is completely disconnected
        self.base_graph.add_node("E", x=0.02, y=0.02, lon=0.02, lat=0.02)
        res = find_safe_route(
            start_lat=0.0, start_lon=0.0,
            end_lat=0.02, end_lon=0.02,
            base_graph=self.base_graph,
            routing_graph=self.penalized_G,
            unconstrained_graph=self.unconstrained_G,
            mode="auto"
        )
        self.assertFalse(res["is_reachable"])
        self.assertEqual(res["route_status"], "NO_ROUTE_DESTINATION_CUTOFF")
        
    def test_invalid_input(self):
        # Missing or completely out of bounds (actually find_nearest_node will just pick the closest)
        # But if the base_graph is completely empty:
        empty_graph = nx.MultiDiGraph()
        res = find_safe_route(
            start_lat=0.0, start_lon=0.0,
            end_lat=0.01, end_lon=0.01,
            base_graph=empty_graph,
            routing_graph=self.penalized_G,
            unconstrained_graph=self.unconstrained_G,
            mode="auto"
        )
        self.assertFalse(res["is_reachable"])
        self.assertEqual(res["route_status"], "INVALID_INPUT")

if __name__ == "__main__":
    unittest.main()
