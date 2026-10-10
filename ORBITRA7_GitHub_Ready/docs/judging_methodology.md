# ORBITRA7 — Technical Methodology for Judging

**Workstream:** Technical Lead, Flood Detection & System Integration

## 1. Problem Addressed
During active flooding events (like Kerala 2018 or Mekong 2019), optical satellite imagery (Sentinel-2) is useless due to thick storm cloud cover. Emergency responders suffer a critical intelligence gap: they cannot determine which terrestrial roads remain passable to deliver relief supplies or evacuate patients to hospitals.

## 2. Satellite Data Processing (Sentinel-1 SAR Methodology & Current Fallback)
Our system architecture is designed to bypass optical blindness by utilizing **Sentinel-1 C-Band Synthetic Aperture Radar (SAR)**. SAR microwaves penetrate clouds and rain. Smooth flood water acts as a mirror, deflecting radar pulses away from the satellite, returning a very low backscatter signal (typically $\approx -15\text{ dB}$).
By thresholding this backscatter (using datasets like Sen1Floods11), we obtain a binary raster mask of flood inundation.

**MVP Implementation Note:** Due to the large size and complexity of live Sentinel-1 SAR data, the current executable MVP utilizes a **synthetic, pre-prepared raster generator fallback** (`generate_curated_geotiff`) that simulates SAR-derived inundation masks. This ensures the end-to-end data pipeline, exposure calculations, and routing logic can be validated independently.

## 3. Geospatial Exposure Classification
Detecting water is not enough; we must determine road passability.
1. **Projection:** OpenStreetMap road lines are projected from angular degrees (`EPSG:4326`) into a local metric Universal Transverse Mercator (UTM) coordinate space.
2. **Buffering:** We buffer road lines by 5 meters to accurately simulate the physical width of the roadbed and adjacent drainage.
3. **Intersection & Exposure Ratio:** We calculate the exact geometric area of intersection between the flood polygon and the road buffer. The passability is determined by the exposure ratio ($R$):
   $$R = \frac{\text{Area of Intersected Water}}{\text{Area of Buffered Road}}$$
4. **Classification:**
   - **Clear:** $R < 0.05$
   - **Partially Flooded:** $0.05 \le R \le 0.30$
   - **Submerged:** $R > 0.30$

## 4. Risk-Aware Graph Routing Engine
Standard navigation algorithms (like standard Dijkstra's) optimize solely for shortest physical distance. If applied blindly to a flooded city, they will guide emergency vehicles directly into submerged causeways if it represents the shortest path.
ORBITRA7 solves this using a **Dynamic Penalty Weight Graph**:
- Each road edge is assigned a penalty multiplier: $1\times$ for Clear, $10\times$ for Partially Flooded, and $10{,}000\times$ for Submerged.
- The routing engine minimizes the sum of these penalized weights.
- **Result:** The algorithm mathematically exhausts all Clear and Partially Flooded detours across the entire city before it will ever select a Submerged road. 
- If a destination (e.g., a hospital) is entirely encircled by Submerged roads, the graph catches `NetworkXNoPath` and explicitly flags the destination as **ISOLATED**, signaling the need for helicopters or boats.

## 5. System Integration & Architecture
- **Backend:** Python FastAPI running high-performance asynchronous endpoints.
- **Geospatial Engine:** Rasterio (raster-to-vector), Shapely STRtree (spatial indexing), and pyproj (CRS transformations).
- **Routing:** NetworkX.
- **Frontend:** React-ready / HTML5 WebGL dashboard powered by MapLibre GL JS, featuring a dark-mode tactical UI generated via Stitch.
- **Contracts:** Strictly defined GeoJSON schemas ensuring seamless integration between all 5 teammate workstreams.
