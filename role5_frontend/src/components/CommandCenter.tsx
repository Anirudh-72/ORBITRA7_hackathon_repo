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
  CheckCircle, Loader2, Navigation, Layers, Info
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
  onOriginChange: (facility: any) => void;
  onDestinationChange: (facility: any) => void;
  onCalculateRoute: () => void;
  onClearRoute: () => void;
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
  onOriginChange,
  onDestinationChange,
  onCalculateRoute,
  onClearRoute,
}: CommandCenterProps) {
  const mapRef = useRef<MapRef>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number, y: number, feature: any } | null>(null);

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

  const markers = useMemo(() => {
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
        glowClass = 'shadow-[0_0_15px_rgba(6,182,212,0.8)] rounded-full bg-surface/50';
      } else if (isDestination) {
        markerColor = '#10b981'; // green
        glowClass = 'shadow-[0_0_15px_rgba(16,185,129,0.8)] rounded-full bg-surface/50';
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
        style={{ width: '100%', height: '100%' }}
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
        {markers}
      </Map>

      {/* Cut-off Alert Banner */}
      <AnimatePresence>
        {dashboardMetrics.cutoffCount > 0 && (
          <motion.div
            initial={{ y: -100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: -100, opacity: 0, x: '-50%' }}
            className="absolute top-4 left-1/2 z-50 bg-red-600/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-lg border border-red-400 flex items-center gap-3"
          >
            <AlertTriangle size={20} className="animate-pulse" />
            <span className="font-bold tracking-wide">CRITICAL ALERT: {dashboardMetrics.cutoffCount} FACILITIES CUT-OFF BY FLOODWATERS</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip for hovering over map features */}
      {hoverInfo && hoverInfo.feature && (
        <div 
          className="absolute z-50 pointer-events-none bg-white/90 dark:bg-[rgba(17,19,24,0.9)] backdrop-blur-md border border-gray-200 dark:border-[rgba(59,73,75,0.4)] rounded text-xs text-gray-900 dark:text-gray-100 p-2 shadow-lg"
          style={{ left: hoverInfo.x + 10, top: hoverInfo.y + 10 }}
        >
          <div className="font-semibold mb-1 text-cyan-600 dark:text-primary-container border-b border-gray-200 dark:border-outline-variant pb-1">
            Road Segment
          </div>
          <div className="flex flex-col gap-1">
            <span><strong>Status:</strong> {hoverInfo.feature.properties?.status || 'Unknown'}</span>
            <span><strong>Water Level:</strong> {hoverInfo.feature.properties?.water_level_m?.toFixed(2) || '0.00'} m</span>
          </div>
        </div>
      )}

      {/* 4. LEFT PANEL (DECLUTTERED) */}
      <motion.div 
        initial={{ x: -400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute top-20 left-6 w-[400px] z-10 bg-white/90 dark:bg-[rgba(17,19,24,0.85)] backdrop-blur-xl border border-gray-200 dark:border-[rgba(59,73,75,0.4)] rounded-xl shadow-2xl flex flex-col p-5 text-gray-900 dark:text-white"
      >
        <div className="flex items-center gap-3 mb-4 border-b border-gray-200 dark:border-outline-variant pb-4">
          <Navigation className="text-cyan-600 dark:text-primary-container" size={24} />
          <h2 className="text-lg font-bold tracking-wider uppercase">ORBITRA DISASTER ROUTING</h2>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 relative">
            <label className="text-xs font-semibold text-gray-500 dark:text-on-surface-variant uppercase tracking-wider">Origin</label>
            <input 
              className="w-full bg-gray-50 dark:bg-surface-container-highest border border-gray-200 dark:border-outline-variant rounded-lg p-2.5 text-sm focus:outline-none focus:border-cyan-500"
              placeholder="Search for origin..."
              value={originSearch}
              onChange={(e) => {
                setOriginSearch(e.target.value);
                handleSearch(e.target.value, setOriginResults);
              }}
            />
            {originResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white dark:bg-surface-container border border-gray-200 dark:border-outline-variant mt-1 rounded shadow-xl z-50 max-h-[200px] overflow-y-auto">
                {originResults.map(r => (
                  <div 
                    key={r.place_id} 
                    className="p-2 text-xs hover:bg-cyan-50 dark:hover:bg-primary/20 cursor-pointer border-b border-gray-100 dark:border-outline-variant/30 last:border-b-0"
                    onClick={() => {
                      setOrigin({ properties: { id: r.place_id, type: 'relief_centre' }, geometry: { coordinates: [parseFloat(r.lon), parseFloat(r.lat)] } });
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

          <div className="flex flex-col gap-1 relative">
            <label className="text-xs font-semibold text-gray-500 dark:text-on-surface-variant uppercase tracking-wider">Destination</label>
            <input 
              className="w-full bg-gray-50 dark:bg-surface-container-highest border border-gray-200 dark:border-outline-variant rounded-lg p-2.5 text-sm focus:outline-none focus:border-cyan-500"
              placeholder="Search for destination..."
              value={destSearch}
              onChange={(e) => {
                setDestSearch(e.target.value);
                handleSearch(e.target.value, setDestResults);
              }}
            />
            {destResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white dark:bg-surface-container border border-gray-200 dark:border-outline-variant mt-1 rounded shadow-xl z-50 max-h-[200px] overflow-y-auto">
                {destResults.map(r => (
                  <div 
                    key={r.place_id} 
                    className="p-2 text-xs hover:bg-cyan-50 dark:hover:bg-primary/20 cursor-pointer border-b border-gray-100 dark:border-outline-variant/30 last:border-b-0"
                    onClick={() => {
                      setDestination({ properties: { id: r.place_id, type: 'hospital' }, geometry: { coordinates: [parseFloat(r.lon), parseFloat(r.lat)] } });
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
              "w-full py-3 px-4 mt-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2",
              (!origin || !destination || isCalculating)
                ? "bg-gray-100 dark:bg-surface-container border border-gray-200 dark:border-outline-variant text-gray-400 dark:text-on-surface-variant opacity-50 cursor-not-allowed"
                : "bg-cyan-50 dark:bg-[rgba(0,240,255,0.08)] border border-cyan-500 dark:border-primary-container text-cyan-700 dark:text-primary-container hover:bg-cyan-100 shadow-sm"
            )}
          >
            {isCalculating ? (
              <><Loader2 size={18} className="animate-spin" /> CALCULATING...</>
            ) : (
              <><Route size={18} /> GENERATE SAFE ROUTE</>
            )}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-outline-variant grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 dark:text-on-surface-variant uppercase font-bold">Total Network</span>
            <span className="text-lg font-bold">{dashboardMetrics.total} km</span>
          </div>
          <div className="flex flex-col text-green-600 dark:text-green-400">
            <span className="text-[10px] uppercase font-bold">Usable Roads</span>
            <span className="text-lg font-bold">{dashboardMetrics.passable} km</span>
          </div>
          <div className="flex flex-col text-red-600 dark:text-red-400">
            <span className="text-[10px] uppercase font-bold">Submerged</span>
            <span className="text-lg font-bold">{dashboardMetrics.submerged} km</span>
          </div>
        </div>
      </motion.div>

      {/* 5. ROUTE RESULTS PANEL */}
      <AnimatePresence>
        {routeResult && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="absolute top-20 right-6 w-[360px] z-10 bg-white/90 dark:bg-[rgba(17,19,24,0.85)] backdrop-blur-xl border border-gray-200 dark:border-[rgba(59,73,75,0.4)] rounded-xl shadow-2xl flex flex-col p-5 max-h-[calc(100vh-160px)] overflow-y-auto text-gray-900 dark:text-white"
          >
            <div className="flex items-center gap-3 mb-5 border-b border-gray-200 dark:border-outline-variant pb-4">
              <Route className="text-cyan-600 dark:text-primary-container" size={24} />
              <h2 className="text-lg font-bold tracking-wider">ROUTE ANALYSIS</h2>
            </div>

            {routeResult.status === 'ERROR' && (
              <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
                <AlertTriangle className="text-red-500" size={48} />
                <h3 className="font-bold text-red-400 text-lg">Routing Error</h3>
                <p className="text-sm text-red-300">An error occurred while generating the route.</p>
              </div>
            )}

            {routeResult.status === 'DESTINATION_ISOLATED' && (
              <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
                <AlertTriangle className="text-orange-500" size={48} />
                <h3 className="font-bold text-orange-400 text-lg">Destination Isolated</h3>
                <p className="text-sm text-orange-200">No safe route exists. All paths are flooded.</p>
              </div>
            )}

            {routeResult.status === 'SUCCESS' && (
              <div className="flex flex-col gap-6">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle className="text-emerald-400" size={24} />
                  <div>
                    <div className="text-emerald-400 font-bold text-sm uppercase tracking-wide">Route Secured</div>
                    <div className="text-emerald-200/70 text-xs">Safe path established</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container-highest border border-outline-variant rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant uppercase">Distance</span>
                    <span className="text-xl font-bold text-on-surface">
                      {routeResult.safe_route?.distance_km != null 
                        ? `${routeResult.safe_route.distance_km.toFixed(2)} km` 
                        : '—'}
                    </span>
                  </div>
                  <div className="bg-surface-container-highest border border-outline-variant rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant uppercase">Est. Time</span>
                    <span className="text-xl font-bold text-on-surface">
                      {routeResult.safe_route?.distance_km != null 
                        ? `${(routeResult.safe_route.distance_km * 2).toFixed(0)} min` 
                        : '—'}
                    </span>
                  </div>
                  <div className="bg-surface-container-highest border border-outline-variant rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant uppercase">Flooded Areas</span>
                    <span className="text-xl font-bold text-on-surface">
                      {routeResult.safe_route?.submerged_segments_crossed != null 
                        ? routeResult.safe_route.submerged_segments_crossed 
                        : '—'}
                    </span>
                  </div>
                  <div className="bg-surface-container-highest border border-outline-variant rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant uppercase">Detour</span>
                    <span className="text-xl font-bold text-on-surface">
                      {routeResult.analytics?.detour_overhead_km != null 
                        ? `+${routeResult.analytics.detour_overhead_km.toFixed(2)} km` 
                        : '—'}
                    </span>
                  </div>
                </div>

                {routeResult.analytics?.recommendation && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <Info size={14} /> Tactical Assessment
                    </span>
                    <p className="text-sm text-on-surface bg-surface-container-highest p-3 rounded-lg border border-outline-variant leading-relaxed">
                      {routeResult.analytics.recommendation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. LEGEND PANEL */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="absolute bottom-10 left-6 z-10 bg-white/90 dark:bg-[rgba(17,19,24,0.85)] backdrop-blur-xl border border-gray-200 dark:border-[rgba(59,73,75,0.4)] rounded-lg shadow-xl p-4 w-[240px] text-gray-900 dark:text-white"
      >
        <div className="flex items-center gap-2 mb-3 border-b border-gray-200 dark:border-outline-variant pb-2">
          <Layers className="text-gray-500 dark:text-on-surface-variant" size={16} />
          <h3 className="text-xs font-bold uppercase tracking-wider">Map Legend</h3>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-6 h-1 rounded-full bg-[#64748b]"></div>
            <span className="text-xs">Clear Road</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-1 rounded-full bg-[#f59e0b]"></div>
            <span className="text-xs">Partially Flooded</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-1 rounded-full bg-[#ef4444]"></div>
            <span className="text-xs">Submerged Road</span>
          </div>
          <div className="flex items-center gap-3 mt-1 pt-2 border-t border-gray-200 dark:border-outline-variant/50">
            <div className="w-6 h-1.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
            <span className="text-xs font-medium">Safe Route</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-0 border-t-2 border-dashed border-[#ef4444]"></div>
            <span className="text-xs line-through opacity-70">Baseline Route</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
