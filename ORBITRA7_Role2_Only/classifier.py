# classifier.py
import json
from shapely.geometry import shape, mapping
from shapely.validation import make_valid
from config import CLASSIFICATION_THRESHOLDS, BUFFER_DEGREES

def classify_overlap(overlap_ratio):
    """Assigns discrete classification based on the intersection ratio."""
    if overlap_ratio < CLASSIFICATION_THRESHOLDS["clear_max"]:
        return "clear"
    elif overlap_ratio <= CLASSIFICATION_THRESHOLDS["partial_max"]:
        return "partial"
    else:
        return "submerged"

def process_road_network(roads_geojson_dict, flood_geojson_dict):
    """
    Intersects roads with flood polygons and calculates an overlap ratio.
    Returns a valid GeoJSON FeatureCollection with accessibility properties appended.
    """
    # 1. Parse flood geometries safely
    flood_shapes = []
    for feature in flood_geojson_dict.get("features", []):
        if not feature.get("geometry"):
            continue
        try:
            geom = shape(feature["geometry"])
            if not geom.is_valid:
                geom = make_valid(geom)
            if not geom.is_empty:
                flood_shapes.append(geom)
        except Exception:
            pass # Gracefully skip invalid/missing flood geoms
            
    # Combine floods into a single geometry for intersection
    if flood_shapes:
        from shapely.ops import unary_union
        unified_flood = unary_union(flood_shapes)
    else:
        unified_flood = None

    classified_features = []
    
    # 2. Intersect and Classify Roads
    for feature in roads_geojson_dict.get("features", []):
        # Handle missing geometry safely
        if not feature.get("geometry"):
            continue
            
        try:
            road_geom = shape(feature["geometry"])
        except Exception:
            continue
            
        if not road_geom.is_valid:
            road_geom = make_valid(road_geom)
            
        # Ignore truly empty or zero-length inputs
        if road_geom.is_empty or road_geom.length == 0:
            continue

        overlap_ratio = 0.0
        
        # Calculate intersection if flood data exists
        if unified_flood is not None:
            # Buffer the road centerline to simulate physical road width
            buffered_road = road_geom.buffer(BUFFER_DEGREES)
            
            try:
                intersection = buffered_road.intersection(unified_flood)
                overlap_area = intersection.area
                total_area = buffered_road.area
                if total_area > 0:
                    overlap_ratio = overlap_area / total_area
            except Exception:
                # If Shapely intersection fails topologically, default to 0 overlap
                pass
                
        status = classify_overlap(overlap_ratio)
        
        # Build valid output GeoJSON feature maintaining original attributes
        props = feature.get("properties", {}).copy()
        props["status"] = status
        props["flood_overlap_ratio"] = round(overlap_ratio, 4)
        
        # Ensure a segment ID exists as per Role 2 data contract
        if "segment_id" not in props:
            props["segment_id"] = props.get("id", str(id(feature)))
            
        classified_features.append({
            "type": "Feature",
            "properties": props,
            "geometry": mapping(road_geom) # Preserve original line geometry for Map/UI
        })
        
    return {
        "type": "FeatureCollection",
        "features": classified_features
    }
