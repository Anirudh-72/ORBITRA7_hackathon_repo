# ORBITRA7 - Role 5 Frontend Implementation

This directory contains the Role 5 and Role 5.1 implementation for the ORBITRA7 Post-Flood Road Accessibility Mapper. It provides a premium 3D frontend designed with Google Stitch.

## Responsibilities Implemented
- **Premium 3D Geographic Visualization**: Built with React and MapLibre GL JS, visualizing flood layers, color-coded road segments, and computed safe routes.
- **Premium UI Interactions**: Refined glassmorphic interface, dark cinematic theme, responsive map overlay controls.
- **Backend API Integration**: Connects dynamically to the FastAPI backend (Role 1-3) to fetch real GeoJSON layers and calculate routes via `/api/route`.
- **Stitch Design Integration**: Followed the "Orbital GeoTactical" design system provided by Google Stitch, implementing its precise typography, structural telemetry, and semantic colors.

## Project Structure
- `src/App.tsx`: The main operations dashboard and MapLibre instance.
- `src/api.ts`: API client connecting to backend endpoints.
- `src/index.css`: The Tailwind CSS v4 design system variables and glassmorphism component classes.
- `vite.config.ts`: Configured with Vite and `@tailwindcss/vite`.

## Setup & Running
Ensure the main ORBITRA7 backend is running first:
```bash
cd ../
uvicorn backend.main:app --port 8000
```

Then, run the frontend:
```bash
cd role5_frontend
npm install
npm run dev
```
The application will be accessible at `http://localhost:5173`.

## Technologies Used
- React 18, Vite
- MapLibre GL JS (`maplibre-gl`, `react-map-gl/maplibre`)
- Tailwind CSS v4
- Lucide React (Icons)
- Carto Dark Matter Vector Tiles

## Missing Features / Limitations
- 3D Terrain Elevation is unsupported out-of-the-box by standard flat 2D tile sources like Carto Dark Matter without a corresponding DEM source, though the map camera supports 2.5D pitch.
- Route computation latency loading indicators depend on backend response time, currently simulated via pulse animations.
