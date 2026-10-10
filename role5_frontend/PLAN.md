# ORBITRA7 Phase 1 Implementation Plan

## Role 5 & 5.1 Responsibilities
- Implement the "Premium 3D Frontend" for the ORBITRA7 project.
- Provide a cinematic, dark-themed, map-based operations interface.
- Integrate the frontend with existing real backend API endpoints for map layers, roads, and routing.
- Visualize geospatial data using MapLibre GL JS (flood extent, clear/flooded roads, safe routes).
- Refine UI with tasteful motion and a cohesive design system using Stitch-provided aesthetics.

## Component Mapping & Implementation Strategy

### 1. Project Scaffolding
- **Framework**: React 18 + TypeScript + Vite.
- **Styling**: Tailwind CSS + custom design tokens from Stitch generated theme.
- **Mapping**: `maplibre-gl` and `react-map-gl`.

### 2. Design System & UI Components (`src/components/ui/`)
- `Button.tsx`: Glowing cyan primary actions and subdued secondary buttons.
- `Panel.tsx`: Glassmorphic panels for telemetry and routing controls.
- `Badge.tsx`: Status capsules for road conditions and metrics.
- `Select.tsx`: Input dropdowns for Origin and Destination selection.

### 3. Map View (`src/components/Map/`)
- `MapView.tsx`: Full-screen MapLibre canvas initialized with dark matter tiles.
- `FloodLayer.tsx`: Translucent cyan polygons for flood inundation data.
- `RoadNetworkLayer.tsx`: Line layer color-coded by passability status (Clear, Partially Flooded, Submerged).
- `RouteLayer.tsx`: Dashed baseline route and neon green optimal safe route.
- `FacilitiesLayer.tsx`: Points/icons for hospitals and relief staging areas.

### 4. Operations Dashboard (`src/components/Dashboard/`)
- `OperationsPanel.tsx`: Left sidebar containing routing controls.
- `RoutingForm.tsx`: Origin and destination selection.
- `ImpactSummary.tsx`: Post-calculation detour metrics and avoided hazards.
- `StatusLegend.tsx`: Reference guide for road status colors.

### 5. API Integration (`src/api/`)
- `client.ts`: Axios or Fetch wrapper with configurable base URLs (defaults to `http://localhost:8000/api`).
- Interfaces:
  - `GET /api/facilities`: Fetches origin/destination points.
  - `GET /api/layers/roads`: Road network GeoJSON.
  - `GET /api/layers/flood`: Flood polygon GeoJSON.
  - `POST /api/route`: Requests route calculation.

### 6. Integration Steps
- Milestone 1: Initialize Vite React app, Tailwind setup, design system translation (from Stitch output).
- Milestone 2: Implement core MapLibre component and add MapTiler Dark Matter base.
- Milestone 3: Create UI layout (glass sidebar, forms, summary cards).
- Milestone 4: Wire up backend data loading (facilities, roads, flood layers).
- Milestone 5: Implement routing interaction (POST to backend, render response).
- Milestone 6: Add visual polish (animations, loading states).
- Milestone 7: Verification and GitHub commit preparation.
