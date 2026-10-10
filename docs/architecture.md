# ORBITRA7 — System Architecture & Integration Contracts Specification

**Version:** 1.0.0  
**Author:** Technical Lead & System Integration Architect  
**Project:** ORBITRA7 — AI-Powered Post-Flood Road Accessibility Mapper

---

## 1. System Overview & Component Topology

ORBITRA7 is an emergency response decision-support tool that transforms orbital radar flood observations and OpenStreetMap vector road graphs into risk-aware navigation routes to critical healthcare and relief infrastructure.

```
                    ┌──────────────────────────────────────────────┐
                    │            DATA SOURCES                      │
                    │  - Sen1Floods11 Sentinel-1 SAR GeoTIFF       │
                    │  - OpenStreetMap (OSMnx / Overpass)          │
                    └───────────────────────┬──────────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │       WORKSTREAM 1: TECHNICAL LEAD           │
                    │       Flood-Data Ingestion Pipeline          │
                    │   - Rasterio polygon vectorization           │
                    │   - Metadata & Provenance extraction         │
                    │   - Reprojection to metric UTM zone          │
                    └───────────────────────┬──────────────────────┘
                                            │ Flood Polygons GeoJSON
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │      WORKSTREAM 2: GEOSPATIAL DEVELOPER      │
                    │       Road Graph & Exposure Classifier       │
                    │   - OSMnx Network extraction & metric UTM    │
                    │   - Shapely 5m roadbed buffering             │
                    │   - STRtree spatial indexing & intersection   │
                    │   - Exposure ratio R classification          │
                    └───────────────────────┬──────────────────────┘
                                            │ Classified Segments (Clear, Partial, Submerged)
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │       WORKSTREAM 3: ROUTING DEVELOPER        │
                    │         NetworkX Risk Routing Engine         │
                    │   - Dynamic edge weights (1x, 10x, 10000x)   │
                    │   - Dijkstra/A* dual-route computation       │
                    │   - Detour overhead & hazard avoidance       │
                    └───────────────────────┬──────────────────────┘
                                            │ Route GeoJSON & Detour Metrics
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │       WORKSTREAM 1: TECHNICAL LEAD           │
                    │        FastAPI Integration Backbone          │
                    │   - Standardized REST APIs                   │
                    │   - In-memory graph caching & serialization  │
                    └───────────────────────┬──────────────────────┘
                                            │ REST / GeoJSON Endpoints
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │      WORKSTREAM 4: FRONTEND DEVELOPER        │
                    │     React + MapLibre GL JS WebGL Client      │
                    │   - Tactical Dark-Mode 3D Map (WebGL)        │
                    │   - Inundation masks & color-coded roads     │
                    │   - Mission Operations & Detour Analytics    │
                    │   - Satellite proxy limitation disclosure    │
                    └──────────────────────────────────────────────┘
                                            ▲
                                            │ Verification & Audits
                    ┌───────────────────────┴──────────────────────┐
                    │         WORKSTREAM 5: QA & VALIDATION        │
                    │   - Edge case assertions (no-path, dry)      │
                    │   - Automated pytest suite & contract tests  │
                    └──────────────────────────────────────────────┘
```

---

## 2. Coordinate Reference Systems (CRS) Standards

> [!IMPORTANT]
> **Strict Metric CRS Rule:**
> Geometric buffering and area calculations MUST NOT be performed in geographic angular degrees (`EPSG:4326`). Doing so produces mathematically invalid elliptical buffers.

* **Storage & Transmission CRS:** `EPSG:4326` (WGS 84, Longitude/Latitude coordinates in decimal degrees). All GeoJSON objects exchanged between the backend and frontend MUST use `EPSG:4326`.
* **Processing & Computation CRS:** Local Universal Transverse Mercator (UTM).
  * Example test area (Kochi / Kerala, India): `EPSG:32643` (WGS 84 / UTM Zone 43N).
  * Example alternate area (Mekong Delta / Southeast Asia): `EPSG:32648` (UTM Zone 48N).
* Both the road graph edges and flood polygons are projected to the identical local UTM zone prior to performing buffering or intersection operations.

---

## 3. Flood-Data Pipeline & Format Contract

### Ingest Format
* Input: Georeferenced GeoTIFF (`.tif`) representing flood inundation masks derived from Sentinel-1 SAR backscatter thresholding (Otsu method or Sen1Floods11 ground-truth chips).
* Data values: `0 = Dry Land`, `1 = Inundated Water`, `255 / -1 = No Data / Masked`.

### Output GeoJSON Specification (`/api/layers/flood`)
```json
{
  "type": "FeatureCollection",
  "metadata": {
    "scenario_id": "kerala_2018_event",
    "dataset": "Sen1Floods11 Sentinel-1 SAR Ground Truth",
    "sensor": "Sentinel-1 C-Band SAR (IW Mode, VV+VH)",
    "resolution_meters": 10.0,
    "acquisition_date": "2018-08-15T00:00:00Z",
    "scientific_disclaimer": "Proxy surface inundation detected via radar backscatter. Does not reflect water depth."
  },
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[76.25, 9.95], [76.26, 9.95], [76.26, 9.96], [76.25, 9.96], [76.25, 9.95]]]
      },
      "properties": {
        "id": "flood_poly_001",
        "area_sq_m": 125000.0,
        "hazard_type": "surface_water_inundation"
      }
    }
  ]
}
```

---

## 4. Road Classification Data Contract

### Calculation Formula
Each road segment geometry is buffered by a fixed width $w = 5\text{ m}$.
$$R = \frac{\text{Area}(\text{RoadBuffer} \cap \text{FloodPolygons})}{\text{Area}(\text{RoadBuffer})}$$

### Configurable Thresholds & Classification Mapping
| Status | Exposure Ratio $R$ | Dijkstra Penalty Multiplier | Visual Hex Code | Operational Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Clear** | $R < 0.05$ | $1\times$ | `#64748b` (Slate Gray) | Negligible water exposure; safe for routing |
| **Partially Flooded** | $0.05 \le R \le 0.30$ | $10\times$ | `#f59e0b` (Amber Orange) | Shoulder or shallow flooding; cautious transit |
| **Submerged** | $R > 0.30$ | $10{,}000\times$ | `#ef4444` (Crimson Red) | Severe inundation; structurally impassable |

### Road Layer GeoJSON Specification (`/api/layers/roads`)
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[76.251, 9.952], [76.258, 9.955]]
      },
      "properties": {
        "segment_id": "osm_way_10482",
        "name": "MG Road",
        "highway": "primary",
        "length_meters": 820.5,
        "exposure_ratio": 0.02,
        "status": "Clear",
        "penalty_weight": 820.5,
        "speed_kph": 50
      }
    }
  ]
}
```

---

## 5. Critical Facilities Contract (`/api/facilities`)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [76.275, 9.982]
      },
      "properties": {
        "id": "fac_01",
        "name": "District General Hospital",
        "type": "hospital",
        "status": "active",
        "capacity": 250
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [76.241, 9.945]
      },
      "properties": {
        "id": "fac_02",
        "name": "Central Relief Staging Depot",
        "type": "relief_centre",
        "status": "staging",
        "resources": ["water", "medical_kits", "boats"]
      }
    }
  ]
}
```

---

## 6. Routing API Contract (`POST /api/route`)

### Request Body
```json
{
  "origin": [76.241, 9.945],
  "destination": [76.275, 9.982],
  "scenario_id": "kerala_2018_event"
}
```

### Response Body (Success: Safe Detour Found)
```json
{
  "status": "SUCCESS",
  "safe_route": {
    "geojson": {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[76.241, 9.945], [76.249, 9.960], [76.275, 9.982]]
      },
      "properties": {}
    },
    "distance_km": 6.8,
    "estimated_time_min": 14.5,
    "submerged_segments_crossed": 0,
    "partially_flooded_segments_crossed": 1
  },
  "baseline_route": {
    "geojson": {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[76.241, 9.945], [76.260, 9.955], [76.275, 9.982]]
      },
      "properties": {}
    },
    "distance_km": 4.2,
    "submerged_segments_crossed": 2,
    "partially_flooded_segments_crossed": 1
  },
  "analytics": {
    "detour_overhead_km": 2.6,
    "submerged_distance_avoided_m": 1200.0,
    "recommendation": "Follow safe detour. Direct route crosses 1.2km of impassable submerged road."
  }
}
```

### Response Body (Cut-off Destination: No Safe Path)
```json
{
  "status": "DESTINATION_ISOLATED",
  "safe_route": null,
  "baseline_route": {
    "geojson": { ... },
    "distance_km": 4.2,
    "submerged_segments_crossed": 3
  },
  "analytics": {
    "detour_overhead_km": 0,
    "submerged_distance_avoided_m": 0,
    "recommendation": "Destination is completely encircled by flood waters. Terrestrial vehicular access is impossible. Dispatch amphibious or aerial logistics."
  }
}
```

---

## 7. Frontend Integration Contract

1. **Map Engine:** MapLibre GL JS running in WebGL canvas.
2. **Layer Rendering Stack:**
   - Base map: Dark Matter / Carto Dark vector tiles.
   - Inundation layer: Translucent Cyan (`#06b6d4`, opacity: 0.45, outline: `#22d3ee`).
   - Road network layer: Line layer styled via dynamic data-driven color:
     `['match', ['get', 'status'], 'Clear', '#64748b', 'Partially Flooded', '#f59e0b', 'Submerged', '#ef4444', '#64748b']`
   - Baseline route layer: Red dashed line (`#ef4444`, dasharray `[2, 2]`).
   - Safe detour route layer: Glowing Solid Neon Green (`#10b981`, width 4).
   - Facilities layer: Interactive icon markers (Hospital vs Relief Centre).
3. **Mission Control UI:**
   - Origin/Destination select pickers + "Find Safe Route" button.
   - Detour overhead telemetry card displaying $\Delta\text{km}$ and avoided hazards.
   - Prominent Scientific Proxy Disclaimer banner.

---

## 8. Execution Instructions & Known Scientific Limitations

### Quickstart Execution
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run backend integration server
uvicorn backend.main:app --reload --port 8000

# 3. Run automated verification suite
pytest backend/tests/
```

### Known Scientific Limitations
1. **Radar Depth Ambiguity:** 2D SAR backscatter indicates smooth surface water specular reflection. It cannot measure flood water depth. Road passability is therefore an inferred spatial exposure proxy.
2. **Urban Double-Bounce:** Vertical walls in dense urban canyons bounce radar pulses back to the sensor, creating false negatives (flooded streets appearing dry). Pre-validated ground truth chips (Sen1Floods11) are used to mitigate this risk for the MVP.
3. **Roadbed Elevation:** Elevated highways or bridges may physically cross a flood zone without being inundated. The $5\text{ m}$ buffer model assumes roadbed grade matches surrounding terrain unless OpenStreetMap bridge/tunnel tags are present.
