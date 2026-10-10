# ORBITRA7

**Intelligent Geospatial Data Processing Using AI and Machine Learning**
*Post-Flood Road Accessibility Mapper*

## Project Overview
ORBITRA7 is an emergency response decision-support system that processes Sentinel-1 SAR (Synthetic Aperture Radar) satellite data to detect flood inundation. It cross-references flood geometries against OpenStreetMap road networks to classify segment passability and calculate risk-penalized logistical routes for emergency responders.

## Role Deliverables: Technical Lead & System Integration
This repository contains the integrated MVP backbone:
- **`backend/flood_pipeline/`**: Sentinel-1 SAR ingestion, Rasterio vectorization, and GeoJSON export.
- **`backend/spatial/` & `backend/routing/`**: Mocked contract-compliant integration hooks for the Geospatial and Routing Developer modules.
- **`backend/main.py`**: Central FastAPI integration gateway.
- **`docs/architecture.md`**: Central architecture blueprint and API data contracts.

## Setup Instructions
1. Install Python 3.10+ (tested on 3.14.7).
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI integration server:
   ```bash
   uvicorn backend.main:app --port 8000 --reload
   ```
4. Access the tactical dashboard at: [http://localhost:8000](http://localhost:8000)

## Running Verification Tests
```bash
python -m pytest backend/tests/ -v
```

## Known Limitations & Scientific Disclosures
* **Satellite Radar Surface Exposure Notice:** Synthetic Aperture Radar (SAR) backscatter analysis indicates surface specular reflection. Vegetation canopies, urban double-bounce artifacts, and subsurface drainage changes may alter real-time submersion depths. Ground truth validation is required prior to civilian convoy deployment.
* **Bridge Elevations:** Without high-resolution DEM data, roads intersecting flood polygons are assumed to be at-grade, which may misclassify elevated bridges as flooded.
