"""
ORBITRA7 - Role 3 (Routing Backend)
Isolated FastAPI server containing ONLY the routing graph and navigation endpoint.
"""
import os
import json
import logging
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import networkx as nx

from backend.core.routing import (
    build_routing_graph,
    build_unconstrained_graph,
    find_safe_route,
    build_conservative_graph,
    build_penalized_graph
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ORBITRA_ROLE3")

app = FastAPI(title="ORBITRA7 - Routing Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

APP_STATE: Dict[str, Any] = {
    "base_graph": nx.MultiDiGraph(),  # In a real integrated env, Role 3 gets this from Role 2 or OSMnx
    "current_routing_graph": None,
    "current_conservative_graph": None,
    "current_unconstrained_graph": None
}

class SetupGraphRequest(BaseModel):
    roads_geojson: Dict[str, Any]
    
class NavigationRequest(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    mode: str = "auto"  # auto, conservative, emergency

@app.post("/api/setup_graph")
def setup_graph(req: SetupGraphRequest):
    """
    Role 3 interface boundary: Consume the classified road GeoJSON from Role 2.
    Converts it into memory-resident routing graphs.
    """
    try:
        # We need a base_graph for snapping coordinates to nodes. 
        # Role 3 rebuilds a simple base graph from the incoming GeoJSON.
        base_G = nx.MultiDiGraph()
        for feat in req.roads_geojson.get("features", []):
            coords = feat.get("geometry", {}).get("coordinates", [])
            u = str(feat["properties"].get("u"))
            v = str(feat["properties"].get("v"))
            if coords and len(coords) >= 2:
                base_G.add_node(u, lon=coords[0][0], lat=coords[0][1], x=coords[0][0], y=coords[0][1])
                base_G.add_node(v, lon=coords[-1][0], lat=coords[-1][1], x=coords[-1][0], y=coords[-1][1])
        
        APP_STATE["base_graph"] = base_G
        APP_STATE["current_routing_graph"] = build_penalized_graph(req.roads_geojson)
        APP_STATE["current_conservative_graph"] = build_conservative_graph(req.roads_geojson)
        APP_STATE["current_unconstrained_graph"] = build_unconstrained_graph(req.roads_geojson)
        
        return {"success": True, "message": "Graph successfully built from classified GeoJSON."}
    except Exception as e:
        logger.error(f"Failed to build graph: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/navigate")
def navigate_route(req: NavigationRequest):
    """
    Computes optimal safe route avoiding submerged roads and minimizing flooded exposure.
    """
    routing_G = APP_STATE.get("current_routing_graph")
    conservative_G = APP_STATE.get("current_conservative_graph")
    unconstrained_G = APP_STATE.get("current_unconstrained_graph")
    base_G = APP_STATE.get("base_graph")

    if not routing_G:
        raise HTTPException(status_code=400, detail="Graph not initialized. Call /api/setup_graph first.")

    try:
        result = find_safe_route(
            start_lat=req.start_lat, start_lon=req.start_lon,
            end_lat=req.end_lat, end_lon=req.end_lon,
            base_graph=base_G,
            routing_graph=routing_G,
            unconstrained_graph=unconstrained_G,
            conservative_graph=conservative_G,
            mode=req.mode
        )
        return result
    except Exception as e:
        logger.error(f"Navigation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
def healthcheck():
    return {
        "status": "healthy",
        "service": "ORBITRA - Role 3 Routing Engine",
        "graph_ready": APP_STATE["current_routing_graph"] is not None
    }
