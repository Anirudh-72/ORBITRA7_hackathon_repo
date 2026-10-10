# test_classifier.py
import unittest
from classifier import process_road_network

class TestRoadClassifier(unittest.TestCase):
    def setUp(self):
        # A simple 10x10 square flood
        self.flood = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[0,0], [10,0], [10,10], [0,10], [0,0]]]
                }
            }]
        }

    def test_missing_and_invalid_geometries(self):
        # Missing geometry, Empty geometry, Valid geometry
        roads = {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "properties": {"segment_id": "missing"}, "geometry": None},
                {"type": "Feature", "properties": {"segment_id": "empty"}, "geometry": {"type": "LineString", "coordinates": []}},
                {"type": "Feature", "properties": {"segment_id": "valid"}, "geometry": {"type": "LineString", "coordinates": [[11,11], [12,12]]}}
            ]
        }
        
        result = process_road_network(roads, self.flood)
        
        # Only the valid geometry should be processed and returned
        self.assertEqual(len(result["features"]), 1)
        self.assertEqual(result["features"][0]["properties"]["segment_id"], "valid")
        self.assertEqual(result["features"][0]["properties"]["status"], "clear")

    def test_classification_thresholds(self):
        # Submerged (fully inside), Clear (fully outside), Partial (half inside)
        roads = {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "properties": {"segment_id": "r_submerged"}, "geometry": {"type": "LineString", "coordinates": [[2,2], [8,8]]}},
                {"type": "Feature", "properties": {"segment_id": "r_clear"}, "geometry": {"type": "LineString", "coordinates": [[20,20], [30,30]]}},
                {"type": "Feature", "properties": {"segment_id": "r_partial"}, "geometry": {"type": "LineString", "coordinates": [[8,5], [18,5]]}} # 2 units inside, 8 outside = 20% overlap
            ]
        }
        
        result = process_road_network(roads, self.flood)
        
        statuses = {f["properties"]["segment_id"]: f["properties"]["status"] for f in result["features"]}
        ratios = {f["properties"]["segment_id"]: f["properties"]["flood_overlap_ratio"] for f in result["features"]}
        
        self.assertEqual(statuses["r_submerged"], "submerged")
        self.assertEqual(statuses["r_clear"], "clear")
        self.assertEqual(statuses["r_partial"], "partial")
        
        self.assertGreater(ratios["r_submerged"], 0.9)
        self.assertEqual(ratios["r_clear"], 0.0)
        self.assertTrue(0.05 < ratios["r_partial"] < 0.9)

if __name__ == "__main__":
    unittest.main()
