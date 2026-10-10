# ORBITRA7 - Role 2 Only
**Geospatial Data Processing and Road Accessibility Classification**

This directory contains the strict isolation of Role 2 functionality from the ORBITRA7 project. It relies only on Shapely and standard Python libraries, explicitly stripping out unrelated frontend, routing engine (Dijkstra/A*), and API gateway components.

## Implementation Details
The script ingests a road network (GeoJSON) and a flood mask (GeoJSON), buffering the roads to approximate physical width, and intersects them with the flood polygon.

The overlap proportion (`overlap_area / road_area`) is calculated and categorized according to explicitly configurable thresholds in `config.py`.

### Thresholds (Configurable)
- **Clear**: `<= 0.05` overlap.
- **Partially Flooded**: `> 0.05` and `<= 0.30` overlap.
- **Submerged**: `> 0.30` overlap.

### Core Files
- `classifier.py`: The geospatial processing module. Uses Shapely for topological intersections.
- `config.py`: Thresholds and assumptions.
- `test_classifier.py`: Validation tests for geometry handling and mathematical thresholds.
- `demo.py`: E2E demonstrator that fetches a reproducible OSM bounding box (Guwahati), merges a static flood mask, and generates the GeoJSON export.

## Execution
To verify the implementation and generate the classified dataset:

**1. Run the test suite:**
```bash
python test_classifier.py
```

**2. Run the end-to-end demo:**
```bash
python demo.py
```
*This will generate `classified_roads.geojson` containing the exported data contract required by Role 3 (Routing).*
