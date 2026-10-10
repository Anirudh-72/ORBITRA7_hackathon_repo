"""Unit tests for Road Exposure Classification."""

import pytest
from backend.spatial.classifier import (
    classify_exposure_ratio,
    get_penalty_weight,
    generate_contract_road_network,
    CLEAR_THRESHOLD,
    PARTIALLY_FLOODED_THRESHOLD,
    PENALTY_MULTIPLIERS
)


def test_exposure_thresholds():
    assert classify_exposure_ratio(0.00) == "Clear"
    assert classify_exposure_ratio(0.049) == "Clear"
    assert classify_exposure_ratio(0.05) == "Partially Flooded"
    assert classify_exposure_ratio(0.20) == "Partially Flooded"
    assert classify_exposure_ratio(0.30) == "Partially Flooded"
    assert classify_exposure_ratio(0.301) == "Submerged"
    assert classify_exposure_ratio(0.85) == "Submerged"


def test_penalty_multipliers():
    length = 1000.0
    assert get_penalty_weight(length, "Clear") == 1000.0
    assert get_penalty_weight(length, "Partially Flooded") == 10000.0
    assert get_penalty_weight(length, "Submerged") == 10000000.0


def test_road_network_contract():
    roads = generate_contract_road_network("kerala_2018")
    assert roads["type"] == "FeatureCollection"
    assert "metadata" in roads
    assert roads["metadata"]["clear_count"] > 0
    assert roads["metadata"]["submerged_count"] > 0
    
    for f in roads["features"]:
        assert f["type"] == "Feature"
        assert f["geometry"]["type"] == "LineString"
        props = f["properties"]
        assert props["status"] in ("Clear", "Partially Flooded", "Submerged")
        assert props["length_meters"] > 0
        assert props["penalty_weight"] >= props["length_meters"]
