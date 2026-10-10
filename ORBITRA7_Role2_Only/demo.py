# demo.py
import json
import urllib.request
import urllib.parse
from classifier import process_road_network

def main():
    print("=== ORBITRA7 Role 2: Geospatial Processing Demo ===")
    
    # 1. Select reproducible demonstration area (Guwahati bounding box)
    bbox = (26.15, 91.75, 26.16, 91.76)
    
    # 2. Obtain road network
    print(f"1. Fetching road network from OSM for bbox {bbox}...")
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = f"[out:json];(way[\"highway\"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}););out body;>;out skel qt;"
    data_encoded = urllib.parse.urlencode({'data': overpass_query}).encode('utf-8')
    
    roads_geojson = {"type": "FeatureCollection", "features": []}
    
    try:
        req = urllib.request.Request(overpass_url, data=data_encoded, headers={'User-Agent': 'ORBITRA7-Role2/1.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
        
        nodes = {n['id']: (n['lon'], n['lat']) for n in data['elements'] if n['type'] == 'node'}
        
        for element in data['elements']:
            if element['type'] == 'way' and 'nodes' in element:
                coords = [nodes[n] for n in element['nodes'] if n in nodes]
                if len(coords) >= 2:
                    roads_geojson["features"].append({
                        "type": "Feature",
                        "properties": {
                            "segment_id": str(element['id']),
                            "highway": element.get('tags', {}).get('highway', 'unknown')
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": coords
                        }
                    })
        print(f"   => Successfully fetched {len(roads_geojson['features'])} road segments from OSM.")
    except Exception as e:
        print(f"   => Overpass API failed ({e}). Falling back to synthetic roads.")
        roads_geojson["features"] = [
            {"type": "Feature", "properties": {"segment_id": "r1_submerged"}, "geometry": {"type": "LineString", "coordinates": [[91.755, 26.155], [91.756, 26.156]]}},
            {"type": "Feature", "properties": {"segment_id": "r2_clear"}, "geometry": {"type": "LineString", "coordinates": [[91.751, 26.151], [91.751, 26.152]]}}
        ]
    
    # 3. Load flood polygon mask
    print("2. Loading reproducible flood mask...")
    flood_geojson = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"layer": "flood"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[91.752, 26.152], [91.758, 26.152], [91.758, 26.158], [91.752, 26.158], [91.752, 26.152]]]
            }
        }]
    }
    
    # 4. Classify segments
    print("3. Intersecting and classifying segments...")
    classified_geojson = process_road_network(roads_geojson, flood_geojson)
    
    # 5. Export
    output_path = "classified_roads.geojson"
    print(f"4. Exporting data contract to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(classified_geojson, f, indent=2)
        
    print("\n--- RESULTS ---")
    stats = {"clear": 0, "partial": 0, "submerged": 0}
    for f in classified_geojson["features"]:
        stats[f["properties"]["status"]] += 1
    print(f"Classification Breakdown: {stats}")
    print("Role 2 complete.")

if __name__ == "__main__":
    main()
