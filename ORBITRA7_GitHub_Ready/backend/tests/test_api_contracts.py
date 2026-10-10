"""Integration contract tests for FastAPI gateway endpoints."""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "ORBITRA7"
    assert data["status"] == "OPERATIONAL"


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert "supported_scenarios" in data


def test_scenarios():
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert len(data["scenarios"]) >= 2


def test_flood_layer_endpoint():
    response = client.get("/api/layers/flood?scenario_id=kerala_2018")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert "metadata" in data
    assert len(data["features"]) > 0


def test_roads_layer_endpoint():
    response = client.get("/api/layers/roads?scenario_id=kerala_2018")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0


def test_facilities_endpoint():
    response = client.get("/api/facilities?scenario_id=kerala_2018")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) >= 3


def test_route_calculation_endpoint():
    payload = {
        "origin": [76.298, 9.962],
        "destination": [76.282, 9.978],
        "scenario_id": "kerala_2018"
    }
    response = client.post("/api/route", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["safe_route"] is not None
    assert data["baseline_route"] is not None
    assert "analytics" in data
    assert "detour_overhead_km" in data["analytics"]

def test_route_calculation_invalid_input():
    payload = {
        "origin": [76.298, 9.962],
        # Missing destination
        "scenario_id": "kerala_2018"
    }
    response = client.post("/api/route", json=payload)
    assert response.status_code == 422  # FastAPI default validation error

def test_route_calculation_invalid_scenario():
    payload = {
        "origin": [76.298, 9.962],
        "destination": [76.282, 9.978],
        "scenario_id": "non_existent_scenario"
    }
    response = client.post("/api/route", json=payload)
    assert response.status_code == 500  # Will throw 500 because get_scenario raises KeyError which is caught in main.py
