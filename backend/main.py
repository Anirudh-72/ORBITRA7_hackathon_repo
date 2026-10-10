"""ORBITRA7 Central FastAPI Integration Backbone & API Gateway.

Role: Technical Lead & System Integration Architect
Provides standardized, contract-compliant REST endpoints connecting:
- Workstream 1: Sentinel-1 SAR Flood Pipeline
- Workstream 2: Geospatial Road Classification
- Workstream 3: NetworkX Dynamic Penalty Routing
- Workstream 4: React + MapLibre GL JS WebGL Client
- Workstream 5: QA & Integration Testing
"""

import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.flood_pipeline.curator import list_available_scenarios, get_scenario, get_facilities_geojson
from backend.flood_pipeline.processor import load_scenario_flood_geojson, HAS_GEOSPATIAL_LIBS
from backend.spatial.classifier import generate_contract_road_network
from backend.routing.router import plan_post_flood_routes
from backend.shelters import get_shelters_geojson

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("orbitra7.gateway")

app = FastAPI(
    title="ORBITRA7 Post-Flood Accessibility & Tactical Routing API",
    description="Intelligent Geospatial Engine converting Sentinel-1 SAR observations into risk-penalized emergency logistics routes.",
    version="1.0.0"
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# In-memory cached layers for fast hackathon demo queries
_CACHE: Dict[str, Dict[str, Any]] = {}


from fastapi import FastAPI, HTTPException, Query, status, Request, Body
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "role5_frontend" / "dist"

from backend.live_data import hazard_db, fetch_live_weather

class RouteRequest(BaseModel):
    origin: List[float] = Field(..., description="[longitude, latitude] of departure point", min_length=2, max_length=2)
    destination: List[float] = Field(..., description="[longitude, latitude] of arrival point", min_length=2, max_length=2)
    scenario_id: str = Field(default="kerala_2018", description="Identifier of the flood event scenario")

@app.get("/api")
def read_root():
    return {
        "project": "ORBITRA7",
        "title": "Post-Flood Road Accessibility Mapper",
        "role": "Integration Backbone & Geospatial Gateway",
        "documentation": "/docs",
        "status": "OPERATIONAL"
    }



@app.get("/api/health")
def health_check():
    """Telemetry and dependency status verification."""
    return {
        "status": "HEALTHY",
        "version": "1.0.0",
        "geospatial_acceleration": {
            "rasterio_shapely_loaded": HAS_GEOSPATIAL_LIBS,
            "engine": "GeoPandas + Rasterio + Shapely STRtree + NetworkX"
        },
        "supported_scenarios": [s["id"] for s in list_available_scenarios()]
    }


@app.get("/api/scenarios")
def get_scenarios():
    """Return available flood disaster scenarios."""
    return {
        "scenarios": list_available_scenarios()
    }


@app.get("/api/layers/flood")
def get_flood_layer(
    scenario_id: str = Query(default="kerala_2018"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None)
):
    """Retrieve vectorized flood inundation polygons with satellite provenance."""
    if lat is not None and lon is not None:
        if not (6.7 <= lat <= 35.5 and 68.1 <= lon <= 97.3):
            raise HTTPException(status_code=400, detail="Flood monitoring restricted to India.")
        if not (8.1 <= lat <= 12.8 and 74.8 <= lon <= 77.5):
            return {
                "type": "FeatureCollection",
                "features": [],
                "message": "No verified flood data available"
            }

    cache_key = f"flood_{scenario_id}"
    if cache_key not in _CACHE:
        try:
            logger.info("Generating/caching flood layer for scenario: %s", scenario_id)
            _CACHE[cache_key] = load_scenario_flood_geojson(scenario_id)
        except Exception as e:
            logger.error("Error loading flood layer: %s", e)
            raise HTTPException(status_code=500, detail=str(e))
    return _CACHE[cache_key]


@app.get("/api/layers/roads")
def get_road_network(
    scenario_id: str = Query(default="kerala_2018"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None)
):
    """Retrieve classified road network with Clear, Partially Flooded, and Submerged segments."""
    if lat is not None and lon is not None:
        if not (6.7 <= lat <= 35.5 and 68.1 <= lon <= 97.3):
            raise HTTPException(status_code=400, detail="Flood monitoring restricted to India.")
        if not (8.1 <= lat <= 12.8 and 74.8 <= lon <= 77.5):
            return {
                "type": "FeatureCollection",
                "features": []
            }

    cache_key = f"roads_{scenario_id}"
    if cache_key not in _CACHE:
        try:
            logger.info("Generating/caching road network for scenario: %s", scenario_id)
            _CACHE[cache_key] = generate_contract_road_network(scenario_id)
        except Exception as e:
            logger.error("Error loading road network: %s", e)
            raise HTTPException(status_code=500, detail=str(e))
    return _CACHE[cache_key]


@app.get("/api/facilities")
def get_facilities(
    scenario_id: str = Query(default="kerala_2018"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None)
):
    """Retrieve emergency facilities (relief staging camps, hospitals, evacuation points)."""
    if lat is not None and lon is not None:
        if not (6.7 <= lat <= 35.5 and 68.1 <= lon <= 97.3):
            raise HTTPException(status_code=400, detail="Flood monitoring restricted to India.")
        if not (8.1 <= lat <= 12.8 and 74.8 <= lon <= 77.5):
            return {
                "type": "FeatureCollection",
                "features": []
            }

    try:
        return get_facilities_geojson(scenario_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/shelters")
def get_shelters(
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None)
):
    """Retrieve official designated emergency evacuation shelters (Safe Havens) with SDMA provenance."""
    return get_shelters_geojson(lat=lat, lon=lon)


@app.post("/api/route")
def calculate_route(request: RouteRequest):
    """Compute risk-aware post-flood route with baseline comparison."""
    try:
        # Pass origin coordinates to prevent loading Kerala roads for non-Kerala points
        roads = get_road_network(request.scenario_id, lat=request.origin[1], lon=request.origin[0])
        
        # If roads is empty, the region is unsupported
        if not roads.get("features"):
            return {
                "status": "DESTINATION_ISOLATED",
                "message": "No mapped roads available in this region."
            }

        result = plan_post_flood_routes(
            origin=request.origin,
            destination=request.destination,
            roads_geojson=roads,
            scenario_id=request.scenario_id
        )
        return result
    except Exception as e:
        logger.error("Routing calculation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Routing failure: {str(e)}")

@app.get("/api/live/weather")
async def get_weather(lat: float = Query(...), lon: float = Query(...)):
    """Fetch live weather conditions for a specific coordinate."""
    return await fetch_live_weather(lat, lon)

@app.get("/api/hazards")
def get_hazards():
    """Retrieve all active crowd-sourced hazards (potholes, closures)."""
    return {"status": "success", "data": hazard_db.get_active_hazards()}

@app.post("/api/hazards")
def create_hazard(
    lat: float = Body(...), 
    lon: float = Body(...), 
    type: str = Body(...), 
    description: str = Body(...), 
    severity: str = Body(default="medium")
):
    """Report a new geolocated road hazard."""
    hazard = hazard_db.add_hazard(lat, lon, type, description, severity)
    return {"status": "success", "data": hazard}

# Mount the built React frontend at the root (must be after all /api/ routes)
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
