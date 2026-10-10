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


from fastapi import FastAPI, HTTPException, Query, status, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).resolve().parent / "static"


class RouteRequest(BaseModel):
    origin: List[float] = Field(..., description="[longitude, latitude] of departure point", min_length=2, max_length=2)
    destination: List[float] = Field(..., description="[longitude, latitude] of arrival point", min_length=2, max_length=2)
    scenario_id: str = Field(default="kerala_2018", description="Identifier of the flood event scenario")


@app.get("/")
def read_root(request: Request):
    """Service landing page and operational metadata.
    Delivers interactive geospatial dashboard to browser clients, JSON to API clients.
    """
    accept = request.headers.get("accept", "")
    if "text/html" in accept and (STATIC_DIR / "index.html").exists():
        return FileResponse(STATIC_DIR / "index.html")
    return {
        "project": "ORBITRA7",
        "title": "Post-Flood Road Accessibility Mapper",
        "role": "Integration Backbone & Geospatial Gateway",
        "documentation": "/docs",
        "status": "OPERATIONAL"
    }

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")



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
def get_flood_layer(scenario_id: str = Query(default="kerala_2018")):
    """Retrieve vectorized flood inundation polygons with satellite provenance."""
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
def get_road_network(scenario_id: str = Query(default="kerala_2018")):
    """Retrieve classified road network with Clear, Partially Flooded, and Submerged segments."""
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
def get_facilities(scenario_id: str = Query(default="kerala_2018")):
    """Retrieve emergency facilities (relief staging camps, hospitals, evacuation points)."""
    try:
        return get_facilities_geojson(scenario_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/route")
def calculate_route(request: RouteRequest):
    """Compute risk-aware post-flood route with baseline comparison."""
    try:
        roads = get_road_network(request.scenario_id)
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
