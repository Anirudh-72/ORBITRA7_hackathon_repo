import React, { useRef, useEffect, useState, useMemo } from 'react';
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl';
import * as maplibregl from 'maplibre-gl';
import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence } from 'framer-motion';

// Explicitly set the worker URL so Vite copies it to dist and resolves it correctly
maplibregl.setWorkerUrl(maplibreglWorkerUrl);
import { 
  MapPin, Building2, Route, AlertTriangle, 
  CheckCircle, Loader2, Navigation, Layers, Info, Map as MapIcon, Globe
} from 'lucide-react';
import bbox from '@turf/bbox';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import clsx from 'clsx';

interface CommandCenterProps {
  theme: 'light' | 'dark';
  facilities: any;
  roads: any;
  flood: any;
  routeResult: any;
  origin: any;
  destination: any;
  isCalculating: boolean;
  isLoadingData: boolean;
  dataError: string | null;
  liveWeather: any;
  hazards: any[];
  onOriginChange: (facility: any) => void;
  onDestinationChange: (facility: any) => void;
  onCalculateRoute: () => void;
  onClearRoute: () => void;
  onReportHazard: (lat: number, lon: number, type: string, description: string) => void;
}

export default function CommandCenter({
  theme,
  facilities,
  roads,
  flood,
  routeResult,
  origin,
  destination,
  isCalculating,
  isLoadingData,
  dataError,
  liveWeather,
  hazards,
  onOriginChange,
  onDestinationChange,
  onCalculateRoute,
  onClearRoute,
  onReportHazard,
}: CommandCenterProps) {
  const mapRef = useRef<MapRef>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number, y: number, feature: any } | null>(null);
  const [isReportingMode, setIsReportingMode] = useState(false);

  useEffect(() => {
    if (roads && roads.features && roads.features.length > 0 && mapRef.current) {
      if (!routeResult) {
        try {
          const [minLng, minLat, maxLng, maxLat] = bbox(roads);
          mapRef.current.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat]
            ],
            { padding: 50, duration: 1000 }
          );
        } catch (e) {
          console.error("Error fitting bounds to roads", e);
        }
      }
    }
  }, [roads, routeResult]);

  useEffect(() => {
    if (routeResult && routeResult.status === 'SUCCESS' && routeResult.safe_route?.geojson && mapRef.current) {
      try {
        const [minLng, minLat, maxLng, maxLat] = bbox(routeResult.safe_route.geojson);
        mapRef.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat]
          ],
          { padding: { top: 100, bottom: 100, left: 450, right: 450 }, duration: 1000 }
        );
      } catch (e) {
        console.error("Error fitting bounds to route", e);
      }
    }
  }, [routeResult]);

  const reliefCentres = useMemo(() => {
    if (!facilities?.features) return [];
    return facilities.features.filter((f: any) => f.properties?.type === 'relief_centre');
  }, [facilities]);

  const hospitals = useMemo(() => {
    if (!facilities?.features) return [];
    return facilities.features.filter((f: any) => f.properties?.type === 'hospital');
  }, [facilities]);

  const onMapHover = (event: any) => {
    const { features, point } = event;
    const hoveredFeature = features && features[0];
    if (hoveredFeature) {
      setHoverInfo({ x: point.x, y: point.y, feature: hoveredFeature });
    } else {
      setHoverInfo(null);
    }
  };

  const [visibleLayers, setVisibleLayers] = useState({
    flood: true,
    clear: true,
    partial: true,
    submerged: true,
    facilities: true
  });

  const facilityMarkers = useMemo(() => {
    if (!facilities?.features || !visibleLayers.facilities) return null;
    
    return facilities.features.map((facility: any, index: number) => {
      const coords = facility.geometry.coordinates;
      const isOrigin = origin && origin.properties?.id === facility.properties?.id;
      const isDestination = destination && destination.properties?.id === facility.properties?.id;
      const type = facility.properties?.type;

      let markerColor = '#94a3b8'; // subtle gray
      let glowClass = '';
      
      if (isOrigin) {
        markerColor = '#06b6d4'; // cyan
        glowClass = 'shadow-[0_0_15px_rgba(6,182,212,0.8)] rounded-full bg-surface-container/50';
      } else if (isDestination) {
        markerColor = '#10b981'; // green
        glowClass = 'shadow-[0_0_15px_rgba(16,185,129,0.8)] rounded-full bg-surface-container/50';
      }

      return (
        <Marker
          key={`marker-${index}`}
          longitude={coords[0]}
          latitude={coords[1]}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            if (type === 'relief_centre') onOriginChange(facility);
            if (type === 'hospital') onDestinationChange(facility);
          }}
        >
          <div className={clsx("cursor-pointer transform transition-transform hover:scale-110", glowClass)}>
            {type === 'hospital' ? (
              <Building2 size={24} color={markerColor} className="drop-shadow-md" />
            ) : (
              <MapPin size={24} color={markerColor} className="drop-shadow-md" />
            )}
          </div>
        </Marker>
      );
    });
  }, [facilities, origin, destination, onOriginChange, onDestinationChange, visibleLayers.facilities]);

  const dashboardMetrics = useMemo(() => {
    let totalKm = 0;
    let passableKm = 0;
    let submergedKm = 0;
    let cutoffCount = 0;

    if (roads?.features) {
      for (const feature of roads.features) {
        const lengthM = feature.properties?.length_meters || 0;
        const status = feature.properties?.status;
        totalKm += lengthM;
        if (status === 'Clear' || status === 'Partially Flooded') {
          passableKm += lengthM;
        } else if (status === 'Submerged') {
          submergedKm += lengthM;
        }
      }
    }

    if (facilities?.features && flood?.features) {
      for (const facility of facilities.features) {
        let isCutoff = false;
        // Check if facility is inside any flood polygon
        for (const poly of flood.features) {
          try {
            if (booleanPointInPolygon(facility.geometry.coordinates, poly)) {
              isCutoff = true;
              break;
            }
          } catch(e) {
            // handle any malformed geometries gracefully
          }
        }
        if (isCutoff) cutoffCount++;
      }
    }

    return {
      total: (totalKm / 1000).toFixed(1),
      passable: (passableKm / 1000).toFixed(1),
      submerged: (submergedKm / 1000).toFixed(1),
      cutoffCount
    };
  }, [roads, facilities, flood]);

  const [mapMode, setMapMode] = useState<'vector' | 'satellite'>('satellite');

  const mapStyleProp = useMemo(() => {
    if (mapMode === 'satellite') {
      return {
        version: 8,
        sources: {
          'satellite-tiles': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri'
          }
        },
        layers: [
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite-tiles',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      };
    }
    return theme === 'light' 
      ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
  }, [theme, mapMode]);

  // Build the filtered roads geojson for display
  const filteredRoads = useMemo(() => {
    if (!roads) return null;
    const features = roads.features.filter((f: any) => {
      const status = f.properties?.status;
      if (status === 'Clear' && !visibleLayers.clear) return false;
      if (status === 'Partially Flooded' && !visibleLayers.partial) return false;
      if (status === 'Submerged' && !visibleLayers.submerged) return false;
      return true;
    });
    return { ...roads, features };
  }, [roads, visibleLayers]);

  // Search handler for Nominatim
  const [originSearch, setOriginSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [originResults, setOriginResults] = useState<any[]>([]);
  const [destResults, setDestResults] = useState<any[]>([]);

  const handleSearch = async (query: string, setResults: (r: any[]) => void) => {
    if (!query || query.length < 3) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.slice(0, 5));
    } catch (err) {
      console.error("Nominatim search failed", err);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-surface">
      {/* 1. FULL-SCREEN MAP */}
      <Map
        ref={mapRef}
        mapLib={maplibregl as any}
        initialViewState={{
          longitude: 76.285,
          latitude: 9.975,
          zoom: 12,
          pitch: 50,
          bearing: -15
        }}
        mapStyle={mapStyleProp as any}
        interactiveLayerIds={['roads-layer']}
        onMouseMove={onMapHover}
        onMouseLeave={() => setHoverInfo(null)}
        onClick={(e) => {
          if (isReportingMode) {
            const { lng, lat } = e.lngLat;
            const desc = window.prompt("Enter hazard description:");
            if (desc !== null) {
              onReportHazard(lat, lng, 'pothole', desc);
            }
            setIsReportingMode(false);
          }
        }}
        style={{ width: '100%', height: '100%', cursor: isReportingMode ? 'crosshair' : 'default' }}
      >
        <NavigationControl position="bottom-right" />

        {/* 2. MAP LAYERS */}
        {/* Flood Layer - Realistic Riverine Blending */}
        {flood && visibleLayers.flood && (
          <Source id="flood-source" type="geojson" data={flood}>
            <Layer
              id="flood-layer-fill"
              type="fill"
              paint={{
                'fill-color': '#00E5FF',
                'fill-opacity': 0.4,
              }}
            />
            <Layer
              id="flood-layer-blur"
              type="line"
              paint={{
                'line-color': '#00E5FF',
                'line-width': 10,
                'line-blur': 8,
                'line-opacity': 0.6
              }}
            />
          </Source>
        )}

        {/* Roads Layer */}
        {filteredRoads && (
          <Source id="roads-source" type="geojson" data={filteredRoads}>
            <Layer
              id="roads-layer"
              type="line"
              paint={{
                'line-color': [
                  'match',
                  ['get', 'status'],
                  'Clear', '#64748b',
                  'Partially Flooded', '#f59e0b',
                  'Submerged', '#ef4444',
                  '#64748b' // default
                ],
                'line-width': [
                  'interpolate', ['linear'], ['zoom'],
                  10, 2,
                  15, 6
                ],
                'line-opacity': 0.9 // high opacity on satellite
              }}
            />
          </Source>
        )}

        {/* Baseline Route */}
        {routeResult?.baseline_route?.geojson && (
          <Source id="baseline-route-source" type="geojson" data={routeResult.baseline_route.geojson}>
            <Layer
              id="baseline-route-layer"
              type="line"
              paint={{
                'line-color': '#ef4444',
                'line-dasharray': [2, 2],
                'line-width': [
                  'interpolate', ['linear'], ['zoom'],
                  10, 2,
                  15, 6
                ]
              }}
            />
          </Source>
        )}

        {/* Safe Route */}
        {routeResult?.safe_route?.geojson && (
          <Source id="safe-route-source" type="geojson" data={routeResult.safe_route.geojson}>
            {/* Safe Route Glow / Casing */}
            <Layer
              id="safe-route-glow"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round'
              }}
              paint={{
                'line-color': '#166534',
                'line-width': [
                  'interpolate', ['linear'], ['zoom'],
                  10, 6,
                  15, 14
                ],
                'line-opacity': 0.6 // Boosted for satellite
              }}
            />
            {/* Main Safe Route */}
            <Layer
              id="safe-route-layer"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round'
              }}
              paint={{
                'line-color': '#22C55E', // Vivid Green
                'line-width': [
                  'interpolate', ['linear'], ['zoom'],
                  10, 3,
                  15, 6
                ]
              }}
            />
          </Source>
        )}

        {/* 3. MARKERS */}
        {facilityMarkers}

        {/* Hazard Markers */}
        {hazards && hazards.map((h: any, i: number) => (
          <Marker key={`hazard-${i}`} longitude={h.coordinates[0]} latitude={h.coordinates[1]} anchor="bottom">
            <div className="bg-orange-500/20 p-1.5 rounded-full cursor-pointer hover:bg-orange-500/40 transition-colors" title={h.description}>
              <AlertTriangle size={20} className="text-orange-500 drop-shadow-md" />
            </div>
          </Marker>
        ))}
      </Map>

      {/* Map Mode Toggle Button */}
      <div className={clsx(
        "absolute top-5 z-20 transition-all duration-300",
        routeResult ? "right-[360px]" : "right-5"
      )}>
        <button
          onClick={() => setMapMode(mapMode === 'satellite' ? 'vector' : 'satellite')}
          className="bg-white/95 dark:bg-[rgba(23,27,26,0.92)] backdrop-blur-md border border-stone-200 dark:border-outline-variant p-2 rounded-xl shadow-lg text-gray-900 dark:text-on-surface hover:bg-stone-100 dark:hover:bg-surface-container-high transition-colors"
          title={`Switch to ${mapMode === 'satellite' ? 'Vector' : 'Satellite'} mode`}
        >
          {mapMode === 'satellite' ? <MapIcon size={20} /> : <Globe size={20} />}
        </button>
      </div>

      {/* Cut-off Alert Banner */}
      <AnimatePresence>
        {dashboardMetrics.cutoffCount > 0 && (
          <motion.div
            initial={{ y: -100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: -100, opacity: 0, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className="absolute top-5 left-1/2 z-50 bg-stone-100/95 dark:bg-[rgba(23,27,26,0.92)] backdrop-blur-md px-5 py-2.5 rounded-xl shadow-lg border border-amber-300 dark:border-secondary flex items-center gap-3 text-gray-900 dark:text-on-surface"
          >
            <AlertTriangle size={18} className="text-amber-600 dark:text-secondary" />
            <span className="font-semibold text-sm">Critical Alert: {dashboardMetrics.cutoffCount} facilities isolated by flooding</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip for hovering over map features */}
      {hoverInfo && hoverInfo.feature && (
        <div 
          className="absolute z-50 pointer-events-none bg-white/95 dark:bg-[rgba(23,27,26,0.92)] backdrop-blur-md border border-stone-200 dark:border-outline-variant rounded-xl text-xs text-gray-900 dark:text-on-surface p-3 shadow-lg"
          style={{ left: hoverInfo.x + 10, top: hoverInfo.y + 10 }}
        >
          <div className="font-semibold mb-2 text-primary border-b border-stone-200 dark:border-outline-variant pb-1.5 flex items-center gap-1.5">
            <Route size={14} /> Road Segment
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="flex justify-between gap-4"><span className="text-gray-500 dark:text-on-surface-variant">Status</span> <span className="font-medium">{hoverInfo.feature.properties?.status || 'Unknown'}</span></span>
            <span className="flex justify-between gap-4"><span className="text-gray-500 dark:text-on-surface-variant">Water Level</span> <span className="font-medium">{hoverInfo.feature.properties?.water_level_m?.toFixed(2) || '0.00'} m</span></span>
          </div>
        </div>
      )}

      {/* LEFT PANELS WRAPPER */}
      <div className="absolute left-5 top-5 bottom-10 flex flex-col justify-between pointer-events-none z-10 w-[380px]">
      {/* 4. LEFT PANEL (DECLUTTERED) */}
      <motion.div 
        initial={{ x: -400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="pointer-events-auto bg-white/95 dark:bg-[rgba(23,27,26,0.92)] backdrop-blur-md border border-stone-200 dark:border-outline-variant rounded-xl shadow-2xl flex flex-col p-5 text-gray-900 dark:text-on-surface font-sans overflow-y-auto max-h-[50vh] shrink-0 mb-4"
      >
        <div className="flex items-center gap-3 mb-5 border-l-4 border-primary pl-3">
          <Navigation className="text-primary" size={22} />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-on-surface">Route Planning</h2>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-sm font-medium text-gray-600 dark:text-on-surface-variant">Origin</label>
            <input 
              className="w-full bg-stone-50 dark:bg-surface-container border border-stone-200 dark:border-outline-variant rounded-lg p-2.5 text-sm focus:outline-none focus:border-primary transition-colors text-gray-900 dark:text-on-surface placeholder-gray-400 dark:placeholder-on-surface-variant"
              placeholder="Search for an origin facility..."
              value={originSearch}
              onChange={(e) => {
                setOriginSearch(e.target.value);
                handleSearch(e.target.value, setOriginResults);
              }}
            />
            {originResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white/95 dark:bg-[rgba(23,27,26,0.95)] backdrop-blur-md border border-stone-200 dark:border-outline-variant mt-1 rounded-lg shadow-xl z-50 max-h-[200px] overflow-y-auto">
                {originResults.map(r => (
                  <div 
                    key={r.place_id} 
                    className="p-3 text-sm hover:bg-stone-100 dark:hover:bg-surface-container-high cursor-pointer border-b border-stone-100 dark:border-outline-variant last:border-b-0 text-gray-900 dark:text-on-surface"
                    onClick={() => {
                      onOriginChange({ properties: { id: r.place_id, name: r.display_name.split(',')[0], type: 'relief_centre' }, geometry: { coordinates: [parseFloat(r.lon), parseFloat(r.lat)] } });
                      setOriginSearch(r.display_name.split(',')[0]);
                      setOriginResults([]);
                    }}
                  >
                    {r.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 relative">
            <label className="text-sm font-medium text-gray-600 dark:text-on-surface-variant">Destination</label>
            <input 
              className="w-full bg-stone-50 dark:bg-surface-container border border-stone-200 dark:border-outline-variant rounded-lg p-2.5 text-sm focus:outline-none focus:border-primary transition-colors text-gray-900 dark:text-on-surface placeholder-gray-400 dark:placeholder-on-surface-variant"
              placeholder="Search for a destination facility..."
              value={destSearch}
              onChange={(e) => {
                setDestSearch(e.target.value);
                handleSearch(e.target.value, setDestResults);
              }}
            />
            {destResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white/95 dark:bg-[rgba(23,27,26,0.95)] backdrop-blur-md border border-stone-200 dark:border-outline-variant mt-1 rounded-lg shadow-xl z-50 max-h-[200px] overflow-y-auto">
                {destResults.map(r => (
                  <div 
                    key={r.place_id} 
                    className="p-3 text-sm hover:bg-stone-100 dark:hover:bg-surface-container-high cursor-pointer border-b border-stone-100 dark:border-outline-variant last:border-b-0 text-gray-900 dark:text-on-surface"
                    onClick={() => {
                      onDestinationChange({ properties: { id: r.place_id, name: r.display_name.split(',')[0], type: 'hospital' }, geometry: { coordinates: [parseFloat(r.lon), parseFloat(r.lat)] } });
                      setDestSearch(r.display_name.split(',')[0]);
                      setDestResults([]);
                    }}
                  >
                    {r.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onCalculateRoute}
            disabled={!origin || !destination || isCalculating}
            className={clsx(
              "w-full py-2.5 px-4 mt-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2",
              (!origin || !destination || isCalculating)
                ? "bg-stone-100 dark:bg-surface-container border border-stone-200 dark:border-outline-variant text-gray-400 dark:text-on-surface-variant opacity-60 cursor-not-allowed"
                : "bg-primary text-white dark:text-on-surface hover:brightness-110 shadow-sm border border-transparent"
            )}
          >
            {isCalculating ? (
              <><Loader2 size={16} className="animate-spin" /> Computing route...</>
            ) : (
              <><Route size={16} /> Compute Route</>
            )}
          </button>
          
          {/* Report Hazard Button */}
          <button
            onClick={() => setIsReportingMode(!isReportingMode)}
            className={clsx(
              "w-full py-2.5 px-4 mt-1 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 border",
              isReportingMode
                ? "bg-orange-500 text-white border-transparent shadow-sm"
                : "bg-stone-50 dark:bg-surface-container text-gray-700 dark:text-on-surface border-stone-200 dark:border-outline-variant hover:bg-stone-100 dark:hover:bg-surface-container-high"
            )}
          >
            <AlertTriangle size={16} />
            {isReportingMode ? "Cancel Reporting" : "Report Hazard"}
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-stone-200 dark:border-outline-variant grid grid-cols-3 gap-3">
          <div className="flex flex-col bg-stone-50 dark:bg-surface-container p-2.5 rounded-lg border border-stone-100 dark:border-outline-variant">
            <span className="text-xs text-gray-500 dark:text-on-surface-variant mb-1">Network</span>
            <span className="text-sm font-semibold">{dashboardMetrics.total} km</span>
          </div>
          <div className="flex flex-col bg-stone-50 dark:bg-surface-container p-2.5 rounded-lg border border-stone-100 dark:border-outline-variant text-emerald-600 dark:text-emerald-400">
            <span className="text-xs text-gray-500 dark:text-on-surface-variant mb-1">Usable</span>
            <span className="text-sm font-semibold">{dashboardMetrics.passable} km</span>
          </div>
          <div className="flex flex-col bg-stone-50 dark:bg-surface-container p-2.5 rounded-lg border border-stone-100 dark:border-outline-variant text-red-600 dark:text-red-400">
            <span className="text-xs text-gray-500 dark:text-on-surface-variant mb-1">Submerged</span>
            <span className="text-sm font-semibold">{dashboardMetrics.submerged} km</span>
          </div>
        </div>
      </motion.div>


      {/* 6. LEGEND PANEL */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="pointer-events-auto mt-auto bg-white/95 dark:bg-[rgba(23,27,26,0.92)] backdrop-blur-md border border-stone-200 dark:border-outline-variant rounded-xl shadow-xl p-4 w-[240px] text-gray-900 dark:text-on-surface font-sans shrink-0"
      >
        <div className="flex items-center gap-2 mb-3 border-b border-stone-200 dark:border-outline-variant pb-2">
          <Layers className="text-gray-500 dark:text-on-surface-variant" size={16} />
          <h3 className="text-sm font-semibold">Map Legend</h3>
        </div>
        
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={visibleLayers.clear}
              onChange={(e) => setVisibleLayers(prev => ({ ...prev, clear: e.target.checked }))}
              className="accent-primary"
            />
            <div className="w-5 h-1 rounded-full bg-[#64748b]"></div>
            <span className="text-xs text-gray-700 dark:text-on-surface-variant group-hover:text-gray-900 dark:group-hover:text-on-surface">Clear Road</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={visibleLayers.partial}
              onChange={(e) => setVisibleLayers(prev => ({ ...prev, partial: e.target.checked }))}
              className="accent-primary"
            />
            <div className="w-5 h-1 rounded-full bg-[#f59e0b]"></div>
            <span className="text-xs text-gray-700 dark:text-on-surface-variant group-hover:text-gray-900 dark:group-hover:text-on-surface">Partially Flooded</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={visibleLayers.submerged}
              onChange={(e) => setVisibleLayers(prev => ({ ...prev, submerged: e.target.checked }))}
              className="accent-primary"
            />
            <div className="w-5 h-1 rounded-full bg-[#ef4444]"></div>
            <span className="text-xs text-gray-700 dark:text-on-surface-variant group-hover:text-gray-900 dark:group-hover:text-on-surface">Submerged Road</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={visibleLayers.flood}
              onChange={(e) => setVisibleLayers(prev => ({ ...prev, flood: e.target.checked }))}
              className="accent-primary"
            />
            <div className="w-5 h-2 rounded-sm bg-[#00E5FF] opacity-40 border border-[#00E5FF]"></div>
            <span className="text-xs text-gray-700 dark:text-on-surface-variant group-hover:text-gray-900 dark:group-hover:text-on-surface">Flood Areas</span>
          </label>

          <div className="mt-1 pt-2 border-t border-stone-200 dark:border-outline-variant flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-5 h-1.5 rounded-full bg-[#22C55E]"></div>
              <span className="text-xs font-medium">Safe Route</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-0 border-t-2 border-dashed border-[#ef4444]"></div>
              <span className="text-xs line-through text-gray-500 dark:text-on-surface-variant">Baseline Route</span>
            </div>
          </div>
        </div>
      </motion.div>
      </div>

      {/* RIGHT PANELS WRAPPER */}
      <div className="absolute right-5 top-5 bottom-10 flex flex-col justify-between pointer-events-none z-10 w-[340px]">
      {/* 5. ROUTE RESULTS PANEL */}
      <AnimatePresence>
        {routeResult && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="pointer-events-auto bg-white/95 dark:bg-[rgba(23,27,26,0.92)] backdrop-blur-md border border-stone-200 dark:border-outline-variant rounded-xl shadow-2xl flex flex-col p-5 max-h-[50vh] overflow-y-auto text-gray-900 dark:text-on-surface font-sans shrink-0 mb-4"
          >
            <div className="flex items-center justify-between mb-5 border-b border-stone-200 dark:border-outline-variant pb-4">
              <div className="flex items-center gap-2">
                <Route className="text-primary" size={20} />
                <h2 className="text-lg font-semibold">Route Analysis</h2>
              </div>
              <button 
                onClick={onClearRoute}
                className="text-xs text-gray-500 hover:text-gray-900 dark:text-on-surface-variant dark:hover:text-on-surface transition-colors"
              >
                Clear
              </button>
            </div>

            {routeResult.status === 'ERROR' && (
              <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
                <AlertTriangle className="text-red-500" size={40} />
                <h3 className="font-semibold text-red-600 dark:text-red-400">Routing Error</h3>
                <p className="text-sm text-gray-600 dark:text-on-surface-variant">An error occurred while generating the route.</p>
              </div>
            )}

            {routeResult.status === 'DESTINATION_ISOLATED' && (
              <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
                <AlertTriangle className="text-amber-500 dark:text-secondary" size={40} />
                <h3 className="font-semibold text-amber-600 dark:text-secondary">Destination Isolated</h3>
                <p className="text-sm text-gray-600 dark:text-on-surface-variant">No safe route exists. All paths are flooded.</p>
              </div>
            )}

            {routeResult.status === 'SUCCESS' && (
              <div className="flex flex-col gap-5">
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3.5 flex items-center gap-3">
                  <CheckCircle className="text-primary" size={20} />
                  <div>
                    <div className="text-primary font-semibold text-sm">Route Secured</div>
                    <div className="text-primary/70 text-xs">Safe path established</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-stone-50 dark:bg-surface-container border border-stone-100 dark:border-outline-variant rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-xs text-gray-500 dark:text-on-surface-variant">Distance</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-on-surface">
                      {routeResult.safe_route?.distance_km != null 
                        ? `${routeResult.safe_route.distance_km.toFixed(2)} km` 
                        : '—'}
                    </span>
                  </div>
                  <div className="bg-stone-50 dark:bg-surface-container border border-stone-100 dark:border-outline-variant rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-xs text-gray-500 dark:text-on-surface-variant">Est. Time</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-on-surface">
                      {routeResult.safe_route?.distance_km != null 
                        ? `${(routeResult.safe_route.distance_km * 2).toFixed(0)} min` 
                        : '—'}
                    </span>
                  </div>
                  <div className="bg-stone-50 dark:bg-surface-container border border-stone-100 dark:border-outline-variant rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-xs text-gray-500 dark:text-on-surface-variant">Flooded Areas</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-on-surface">
                      {routeResult.safe_route?.submerged_segments_crossed != null 
                        ? routeResult.safe_route.submerged_segments_crossed 
                        : '—'}
                    </span>
                  </div>
                  <div className="bg-stone-50 dark:bg-surface-container border border-stone-100 dark:border-outline-variant rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-xs text-gray-500 dark:text-on-surface-variant">Detour</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-on-surface">
                      {routeResult.analytics?.detour_overhead_km != null 
                        ? `+${routeResult.analytics.detour_overhead_km.toFixed(2)} km` 
                        : '—'}
                    </span>
                  </div>
                </div>

                {routeResult.analytics?.recommendation && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-stone-200 dark:border-outline-variant">
                    <span className="text-xs font-medium text-gray-600 dark:text-on-surface-variant flex items-center gap-1.5">
                      <Info size={14} /> Tactical Assessment
                    </span>
                    <p className="text-sm text-gray-800 dark:text-on-surface bg-stone-50 dark:bg-surface-container p-3.5 rounded-lg border-l-2 border-primary/50 italic leading-relaxed">
                      "{routeResult.analytics.recommendation}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. DATA INTELLIGENCE PANEL */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="pointer-events-auto mt-auto self-end bg-white/95 dark:bg-[rgba(23,27,26,0.92)] backdrop-blur-md border border-stone-200 dark:border-outline-variant rounded-xl shadow-xl p-4 w-[260px] text-gray-900 dark:text-on-surface font-sans shrink-0"
      >
        <div className="flex items-center gap-2 mb-3 border-b border-stone-200 dark:border-outline-variant pb-2">
          <Info className="text-primary" size={16} />
          <h3 className="text-sm font-semibold">Data Intelligence</h3>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 bg-stone-50 dark:bg-surface-container rounded-lg p-2.5 border border-stone-100 dark:border-outline-variant">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-gray-500 dark:text-on-surface-variant">
                {origin ? `Weather (${origin.properties?.name || 'Origin'})` : 'Live Weather (Regional)'}
              </span>
              <span className="text-[10px] text-primary font-mono">Live</span>
            </div>
            {liveWeather && liveWeather.data ? (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900 dark:text-on-surface">
                  {liveWeather.data.temperature}&deg;C &bull; Wind {liveWeather.data.windspeed} km/h
                </span>
                <span className="text-[10px] text-gray-400 dark:text-on-surface-variant font-mono mt-0.5">
                  Source: Open-Meteo &bull; {liveWeather.data.observation_time ? new Date(liveWeather.data.observation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified'}
                </span>
              </div>
            ) : (
              <span className="text-xs text-amber-500/80 font-mono">
                Connecting to Open-Meteo...
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1 bg-stone-50 dark:bg-surface-container rounded-lg p-2.5 border border-stone-100 dark:border-outline-variant">
            <span className="text-xs text-gray-500 dark:text-on-surface-variant">Hazard Reports</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-on-surface flex items-center justify-between">
              <span>{hazards ? hazards.length : 0} Active</span>
              <span className="text-[10px] text-amber-500 font-mono font-normal">Crowdsourced</span>
            </span>
          </div>

          <div className="flex flex-col gap-1 bg-stone-50 dark:bg-surface-container rounded-lg p-2.5 border border-stone-100 dark:border-outline-variant">
            <span className="text-xs text-gray-500 dark:text-on-surface-variant">Satellite Flood Observation</span>
            <span className="text-xs font-semibold text-gray-800 dark:text-on-surface">
              {flood && flood.message ? (
                <span className="text-amber-600 dark:text-secondary">{flood.message}</span>
              ) : (
                <span className="text-primary font-mono text-[11px]">Sentinel-1 SAR Verified</span>
              )}
            </span>
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}