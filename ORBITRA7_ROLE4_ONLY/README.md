# ORBITRA7 - Role 4 & Role 4.1 Implementation
## Frontend Engineer and Interactive Geospatial Dashboard

This document details the implementation of Role 4 (Geospatial Dashboard) and the adherence to Role 4.1 (Antigravity Project Initialization Guidelines) for the ORBITRA7 Hackathon.

### Role 4 Responsibilities Completed
- **Dashboard Interface:** Developed a clean, dark-themed tactical dashboard prioritizing functional spatial data analysis.
- **Geospatial Map:** Integrated Leaflet.js with a dark tactical basemap.
- **Flood & Road Layers:** The dashboard fetches GeoJSON from the backend and overlays flood extents (cyan polygons) and road segments colored by risk (Clear = Gray, Partially Flooded = Amber, Submerged = Red).
- **Network Statistics:** Display road status segment counts parsed directly from the backend metadata responses.
- **Origin/Destination Selection:** Dynamic population of relief centers and hospitals from the `facilities` API.
- **Routing & Telemetry:** Fetches dynamic routes, visualizes the safe detour (thick green line) and direct submerged baseline (dashed red line). Included a side telemetry panel for distances and bypass metrics.
- **Error Handling:** Added `SYSTEM ERROR` toast notifications and gracefully handle "DESTINATION ISOLATED" situations with clear UI feedback.
- **Map Controls:** Implemented fit-to-area bounds adjustment on route calculation and a manual "CENTER MAP" reset button.

### Role 4.1 Responsibilities Adhered To
- Analyzed the pre-existing project repository and adhered to the existing `backend/static/index.html` structure.
- Prevented creation of duplicate frontend services or destructive rewrites.
- Leveraged the already-defined API contracts provided by the FastAPI server instead of mocking a competing routing algorithm.
- Ran tests by firing up the `uvicorn` instance locally and executing REST calls to ensure integration worked end-to-end.

### Files Modified / Created
- `backend/static/index.html`: **(Main Role 4 File)** The primary frontend client. It was enhanced with error handling, live network status statistics, and UI refinements.
- `role4_implementation/README.md`: This documentation file.

### Required Backend Endpoints
The frontend application expects the following REST endpoints to be provided by the FastAPI backend:
1. `GET /api/layers/flood?scenario_id={id}`: Returns GeoJSON Polygons of flood inundations.
2. `GET /api/layers/roads?scenario_id={id}`: Returns a GeoJSON FeatureCollection of the road network, each feature possessing `status` ('Clear', 'Partially Flooded', 'Submerged') and `metadata` containing network-wide segment statistics.
3. `GET /api/facilities?scenario_id={id}`: Returns GeoJSON Points of interest (type='relief_centre' or type='hospital').
4. `POST /api/route`: Accepts `origin`, `destination` (coordinate pairs) and `scenario_id`. Returns JSON outlining `safe_route`, `baseline_route`, and `analytics` object containing string summaries.

### Setup and Run Instructions
1. Ensure the Python backend is set up with its virtual environment (`pip install -r requirements.txt`).
2. Start the FastAPI integration server:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```
3. The interactive geospatial dashboard is served directly by the backend at the root path. Navigate to:
   ```
   http://127.0.0.1:8000/static/index.html
   ```
4. Choose a disaster scenario, pick an origin relief depot, a destination hospital, and click "COMPUTE RISK-AWARE DETOUR".

### Known Limitations
- The satellite radar exposure proxy is simulated based on static mock GeoJSON files (e.g. `kerala_2018`).
- 3D rendering and elaborate animations are omitted intentionally in favor of a functional and highly responsive MVP workflow, matching the prompt's explicit constraints.
