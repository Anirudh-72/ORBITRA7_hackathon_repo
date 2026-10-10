# config.py
# Configuration for Role 2: Geospatial Data Processing and Classification

# Classification thresholds are based on the proportion of the road segment intersecting the flood mask.
# Proportions range from 0.0 (no overlap) to 1.0 (fully covered).
CLASSIFICATION_THRESHOLDS = {
    "clear_max": 0.05,       # Roads with <= 5% overlap are considered CLEAR.
    "partial_max": 0.30      # Roads with > 5% and <= 30% overlap are considered PARTIALLY FLOODED.
                             # Roads with > 30% overlap are considered SUBMERGED.
}

# Buffer distance to approximate physical road width.
# Assumes inputs are in EPSG:4326 (degrees). 0.00005 degrees is roughly 5 meters at the equator.
# Adjust this based on coordinate reference system (CRS).
BUFFER_DEGREES = 0.00005

# ASSUMPTIONS:
# 1. Accessibility is modeled as a 2D spatial intersection proportion, acting as a proxy for risk.
# 2. Water depth is not modeled directly by this script (assumes 2D polygon masks represent hazardous standing water).
