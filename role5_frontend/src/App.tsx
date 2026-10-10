import { useState, useEffect, useRef, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl, Marker, Popup } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchFacilities, fetchRoads, fetchFlood, calculateRoute } from './api';
import type { RouteRequest } from './api';
import { Navigation, ShieldAlert, Activity, Circle, Info, TriangleAlert, MapPin, Building2, AlertOctagon, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import bbox from '@turf/bbox';

function App() {
  const mapRef = useRef<MapRef>(null);

  const [facilities, setFacilities] = useState<any>(null);
  const [roads, setRoads] = useState<any>(null);
  const [flood, setFlood] = useState<any>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [origin, setOrigin] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  
  const [routeResult, setRouteResult] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const [hoverInfo, setHoverInfo] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      setDataError(null);
      
      const [fac, rds, fld] = await Promise.all([
        fetchFacilities(),
        fetchRoads(),
        fetchFlood()
      ]);

      if (!fac || !rds || !fld) {
        setDataError('Failed to connect to ORBITRA7 backend. Ensure the FastAPI server is running on localhost:8000.');
      } else {
        setFacilities(fac);
        setRoads(rds);
        setFlood(fld);
        
        // Auto fit bounds to the road network
        try {
          const boundingBox = bbox(rds);
          mapRef.current?.fitBounds(
            [boundingBox[0], boundingBox[1], boundingBox[2], boundingBox[3]],
            { padding: 100, duration: 1000 }
          );
        } catch (e) {
          console.warn("Could not calculate bounding box for roads");
        }
      }
      setIsLoadingData(false);
    };
    loadData();
  }, []);

  const handleCalculateRoute = async () => {
    if (!origin || !destination) return;
    setIsCalculating(true);
    setRouteResult(null);
    
    const request: RouteRequest = {
      origin: origin.geometry.coordinates,
      destination: destination.geometry.coordinates,
      scenario_id: 'kerala_2018_event'
    };
    
    const result = await calculateRoute(request);
    setRouteResult(result);
    setIsCalculating(false);

    // Auto pan/zoom to the safe route
    if (result && result.safe_route && result.safe_route.geojson) {
      try {
        const routeBbox = bbox(result.safe_route.geojson);
        mapRef.current?.fitBounds(
          [routeBbox[0], routeBbox[1], routeBbox[2], routeBbox[3]],
          { padding: 120, duration: 1500 }
        );
      } catch (e) {
        console.warn("Could not calculate bounding box for route");
      }
    }
  };

  const roadLayerStyle = {
    id: 'roads-layer',
    type: 'line',
    paint: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 4],
      'line-color': [
        'match',
        ['get', 'status'],
        'Clear', '#64748b',
        'Partially Flooded', '#f59e0b',
        'Submerged', '#ef4444',
        '#64748b'
      ]
    }
  };

  const floodLayerStyle = {
    id: 'flood-layer',
    type: 'fill',
    paint: {
      'fill-color': '#06b6d4',
      'fill-opacity': 0.3,
      'fill-outline-color': '#22d3ee'
    }
  };
  
  const baselineRouteStyle = {
    id: 'baseline-route',
    type: 'line',
    paint: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 6],
      'line-color': '#ef4444',
      'line-dasharray': [2, 2]
    }
  };
  
  const safeRouteStyle = {
    id: 'safe-route',
    type: 'line',
    paint: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
      'line-color': '#10b981',
      'line-opacity': 0.9,
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    }
  };

  // Memoize marker rendering to avoid unnecessary re-renders
  const markers = useMemo(() => {
    if (!facilities?.features) return null;
    return facilities.features.map((fac: any) => {
      const isOrigin = origin?.properties.id === fac.properties.id;
      const isDest = destination?.properties.id === fac.properties.id;
      const isRelief = fac.properties.type === 'relief_centre';
      
      let markerColor = 'text-outline-variant';
      let bgColor = 'bg-surface-container';
      
      if (isOrigin) {
        markerColor = 'text-primary-container';
        bgColor = 'bg-primary-container/20 border-primary-container shadow-neon-cyan';
      } else if (isDest) {
        markerColor = 'text-status-safe';
        bgColor = 'bg-status-safe/20 border-status-safe';
      }

      return (
        <Marker 
          key={fac.properties.id} 
          longitude={fac.geometry.coordinates[0]} 
          latitude={fac.geometry.coordinates[1]}
          anchor="bottom"
          onClick={e => {
            e.originalEvent.stopPropagation();
            setHoverInfo(fac);
          }}
        >
          <div className={clsx(
            "p-2 rounded-full border cursor-pointer transition-all hover:scale-110",
            bgColor
          )}>
            {isRelief ? <Building2 className={clsx("w-5 h-5", markerColor)} /> : <MapPin className={clsx("w-5 h-5", markerColor)} />}
          </div>
        </Marker>
      );
    });
  }, [facilities, origin, destination]);

  return (
    <div className="w-screen h-screen flex relative overflow-hidden bg-surface text-on-surface font-sans">
      <div className="absolute inset-0 z-0">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: 76.25,
            latitude: 9.95,
            zoom: 12,
            pitch: 45,
            bearing: -17.6
          }}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          mapLib={maplibregl as any}
          interactive={true}
        >
          <NavigationControl position="bottom-right" />
          
          {flood && (
            <Source id="flood" type="geojson" data={flood}>
              <Layer {...floodLayerStyle as any} />
            </Source>
          )}
          
          {roads && (
            <Source id="roads" type="geojson" data={roads}>
              <Layer {...roadLayerStyle as any} />
            </Source>
          )}
          
          {routeResult?.baseline_route && (
            <Source id="baseline" type="geojson" data={routeResult.baseline_route.geojson}>
              <Layer {...baselineRouteStyle as any} />
            </Source>
          )}
          
          {routeResult?.safe_route && (
            <Source id="safe" type="geojson" data={routeResult.safe_route.geojson}>
              <Layer {...safeRouteStyle as any} />
            </Source>
          )}

          {markers}

          {hoverInfo && (
            <Popup
              longitude={hoverInfo.geometry.coordinates[0]}
              latitude={hoverInfo.geometry.coordinates[1]}
              anchor="top"
              onClose={() => setHoverInfo(null)}
              closeOnClick={false}
              className="z-50"
              maxWidth="300px"
            >
              <div className="bg-surface-container border border-outline-variant rounded p-3 text-sm text-on-surface">
                <h4 className="font-bold text-primary-container mb-1 font-mono">{hoverInfo.properties.name}</h4>
                <div className="text-xs text-on-surface-variant flex flex-col gap-1">
                  <span className="uppercase tracking-wider">Type: {hoverInfo.properties.type.replace('_', ' ')}</span>
                  <span>Status: {hoverInfo.properties.status}</span>
                  {hoverInfo.properties.capacity && <span>Capacity: {hoverInfo.properties.capacity}</span>}
                </div>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      <header className="absolute top-0 left-0 right-0 h-14 bg-surface-container-highest/90 backdrop-blur border-b border-outline-variant/50 z-20 flex items-center justify-between px-6 shadow-md">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-primary-container" />
          <h1 className="font-semibold tracking-wide text-sm">ORBITRA7 // <span className="text-outline">DEFENSE CIVIL PROTECTION (TACTICAL)</span></h1>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-xs font-mono bg-surface-container/50 px-3 py-1 rounded border border-outline-variant">
            <div className="w-2 h-2 rounded-full bg-status-safe animate-pulse"></div>
            SAR FLOOD MODEL: V4.2 LIVE
          </div>
        </div>
      </header>

      <aside className="absolute top-20 left-6 w-[420px] max-h-[calc(100vh-100px)] glass-panel z-10 flex flex-col overflow-y-auto">
        <div className="p-5 border-b border-outline-variant/50 flex items-center justify-between sticky top-0 bg-surface-container-high/90 backdrop-blur z-10">
          <h2 className="text-sm font-semibold tracking-wider text-on-surface-variant flex items-center gap-2">
            <Navigation className="w-4 h-4" /> MISSION DIRECTIVE // ROUTER
          </h2>
          {isCalculating && (
            <span className="text-xs font-mono text-primary-container animate-pulse flex items-center gap-1">
               <Circle className="w-3 h-3" /> COMPUTING
            </span>
          )}
        </div>

        <div className="p-5 flex flex-col gap-5">
          {isLoadingData ? (
            <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary-container" />
              <p className="text-xs font-mono tracking-wider animate-pulse">INITIALIZING GEODATA...</p>
            </div>
          ) : dataError ? (
            <div className="p-4 bg-error-container/20 border border-error rounded-md text-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 text-error font-semibold">
                <AlertOctagon className="w-5 h-5" /> 
                <span>SYSTEM OFFLINE</span>
              </div>
              <p className="text-on-error-container/90">{dataError}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-mono text-outline uppercase mb-1.5 block">Origin Staging Ground</label>
                  <select 
                    className="w-full glass-input font-sans text-sm appearance-none cursor-pointer"
                    onChange={(e) => setOrigin(facilities?.features.find((f: any) => f.properties.id === e.target.value))}
                    value={origin?.properties.id || ""}
                  >
                    <option value="" disabled>Select Origin</option>
                    {facilities?.features.filter((f: any) => f.properties.type === 'relief_centre').map((f: any) => (
                      <option key={f.properties.id} value={f.properties.id}>{f.properties.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-mono text-outline uppercase mb-1.5 block">Destination</label>
                  <select 
                    className="w-full glass-input font-sans text-sm appearance-none cursor-pointer"
                    onChange={(e) => setDestination(facilities?.features.find((f: any) => f.properties.id === e.target.value))}
                    value={destination?.properties.id || ""}
                  >
                    <option value="" disabled>Select Destination</option>
                    {facilities?.features.filter((f: any) => f.properties.type === 'hospital' || f.properties.type === 'village').map((f: any) => (
                      <option key={f.properties.id} value={f.properties.id}>{f.properties.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                className={clsx("glass-button w-full mt-2 py-3", (isCalculating || !origin || !destination) && "opacity-50 cursor-not-allowed")}
                onClick={handleCalculateRoute}
                disabled={isCalculating || !origin || !destination}
              >
                {isCalculating ? 'Computing Vectors...' : 'Calculate Safe Passage Route'}
              </button>

              <div className="mt-2 pt-5 border-t border-outline-variant/30">
                <h3 className="text-xs font-mono text-outline mb-4">ROAD ACCESSIBILITY STATUS</h3>
                <div className="flex flex-col gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-1.5 bg-status-clear rounded"></div>
                    <span className="text-on-surface-variant font-medium">Clear (Passable)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-1.5 bg-status-partial rounded"></div>
                    <span className="text-status-partial font-medium">Partially Flooded (Hazard)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-1.5 bg-status-submerged rounded"></div>
                    <span className="text-status-submerged font-bold tracking-wide">Submerged (Impassable)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-1.5 bg-status-safe rounded shadow-neon-cyan"></div>
                    <span className="text-primary-container font-bold tracking-wide shadow-sm">Active AI Safe Corridor</span>
                  </div>
                </div>
              </div>

              {routeResult && (
                <div className="mt-2 p-5 bg-surface-container border border-outline-variant/60 rounded-xl shadow-lg">
                  <h3 className="text-xs font-mono text-primary-container mb-4 flex items-center gap-2">
                    <Info className="w-4 h-4" /> TACTICAL ROUTE METRICS
                  </h3>
                  
                  {routeResult.status === 'SUCCESS' ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/40 flex flex-col gap-1">
                        <span className="block text-[10px] text-outline font-mono uppercase tracking-wider">Safe Distance</span>
                        <span className="font-mono text-primary-container text-lg">{routeResult.safe_route?.distance_km.toFixed(1)} km</span>
                      </div>
                      <div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/40 flex flex-col gap-1">
                        <span className="block text-[10px] text-outline font-mono uppercase tracking-wider">Est Time</span>
                        <span className="font-mono text-on-surface text-lg">{routeResult.safe_route?.estimated_time_min.toFixed(1)} min</span>
                      </div>
                      <div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/40 flex flex-col gap-1">
                        <span className="block text-[10px] text-outline font-mono uppercase tracking-wider">Submerged Crossed</span>
                        <span className="font-mono text-status-safe text-lg">0</span>
                      </div>
                      <div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/40 flex flex-col gap-1">
                        <span className="block text-[10px] text-outline font-mono uppercase tracking-wider">Detour Delta</span>
                        <span className="font-mono text-status-partial text-lg">+{routeResult.analytics?.detour_overhead_km.toFixed(1)} km</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-error-container/20 border-l-4 border-error text-error rounded shadow-md">
                      <div className="flex items-center gap-2 mb-2 font-bold tracking-wide">
                        <TriangleAlert className="w-5 h-5" /> DESTINATION ISOLATED
                      </div>
                      <p className="text-xs text-on-error-container/90 mt-1 leading-relaxed">{routeResult.analytics?.recommendation || routeResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
         <div className="bg-surface-container-highest/85 backdrop-blur-md border border-outline-variant text-[10px] font-mono text-on-surface-variant px-5 py-2 rounded-full shadow-2xl flex items-center gap-2 transition-all hover:bg-surface-container-highest">
            <ShieldAlert className="w-3.5 h-3.5 text-status-partial" />
            <span className="tracking-widest">PROXY INUNDATION DISPLAY ONLY. SATELLITE SAR CANNOT MEASURE TRUE DEPTH.</span>
         </div>
      </div>
    </div>
  );
}

export default App;
