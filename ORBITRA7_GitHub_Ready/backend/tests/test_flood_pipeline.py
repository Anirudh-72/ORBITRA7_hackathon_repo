"""Unit tests for Sentinel-1 SAR Flood Pipeline."""

import pytest
from backend.flood_pipeline.curator import list_available_scenarios, get_scenario, get_facilities_geojson
from backend.flood_pipeline.processor import load_scenario_flood_geojson


def test_scenarios_available():
    scenarios = list_available_scenarios()
    assert len(scenarios) >= 2
    scenario_ids = [s["id"] for s in scenarios]
    assert "kerala_2018" in scenario_ids
    assert "mekong_2019" in scenario_ids


def test_scenario_metadata():
    sc = get_scenario("kerala_2018")
    assert sc["utm_epsg"] == 32643
    assert len(sc["bbox"]) == 4
    assert len(sc["facilities"]) >= 3


def test_facilities_geojson():
    fac_geojson = get_facilities_geojson("kerala_2018")
    assert fac_geojson["type"] == "FeatureCollection"
    assert len(fac_geojson["features"]) >= 3
    for f in fac_geojson["features"]:
        assert f["type"] == "Feature"
        assert f["geometry"]["type"] == "Point"
        assert len(f["geometry"]["coordinates"]) == 2
        assert "name" in f["properties"]
        assert "type" in f["properties"]


def test_flood_geojson_contract():
    flood_data = load_scenario_flood_geojson("kerala_2018")
    assert flood_data["type"] == "FeatureCollection"
    assert "metadata" in flood_data
    meta = flood_data["metadata"]
    assert "scientific_disclaimer" in meta
    assert "sensor" in meta
    assert "Sentinel-1" in meta["sensor"]
    assert len(flood_data["features"]) > 0
    for f in flood_data["features"]:
        assert f["type"] == "Feature"
        assert f["geometry"]["type"] in ("Polygon", "MultiPolygon")
        assert "area_sq_m" in f["properties"]
        assert f["properties"]["area_sq_m"] > 0
