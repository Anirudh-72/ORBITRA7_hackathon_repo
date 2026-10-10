import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import HeroScene from './components/HeroScene';
import CommandCenter from './components/CommandCenter';
import { fetchFacilities, fetchRoads, fetchFlood, calculateRoute, fetchLiveWeather, fetchHazards, reportHazard } from './api';
import type { RouteRequest } from './api';
import { motion } from 'framer-motion';
import { 
  ChevronDown, Activity, ArrowRight, 
  Satellite, Route, MapPin, Shield,
  Sun, Moon, Menu
} from 'lucide-react';
import clsx from 'clsx';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ────────────────────────────────────────────
   SCENE CARDS — used in the scroll storytelling
   ──────────────────────────────────────────── */

interface SceneCardProps {
  step: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentClass?: string;
}

function SceneCard({ step, title, description, icon, accentClass = 'text-primary' }: SceneCardProps) {
  return (
    <div className="scene-card flex flex-col gap-5 max-w-xl mx-auto px-6 md:px-0">
      <div className="flex items-center gap-3">
        <div className={clsx("w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center", accentClass)}>
          {icon}
        </div>
        <span className="text-xs font-mono tracking-[0.2em] text-on-surface-variant uppercase">{step}</span>
      </div>
      <h3 className="text-3xl md:text-4xl font-semibold text-on-surface tracking-tight leading-tight">
        {title}
      </h3>
      <p className="text-base md:text-lg text-on-surface-variant leading-relaxed">
        {description}
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────
   INTRO VIEW — hero + scroll storytelling
   ──────────────────────────────────────────── */

function IntroView({ onLaunch, theme }: { onLaunch: () => void, theme: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const scenesRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // Hero parallax fade on scroll
      if (heroRef.current) {
        gsap.to(heroRef.current, {
          opacity: 0,
          y: -60,
          scale: 0.96,
          ease: 'none',
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      // Scene cards stagger in
      const cards = gsap.utils.toArray<HTMLElement>('.scene-card');
      cards.forEach((card) => {
        gsap.fromTo(card,
          { opacity: 0, y: 50 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 80%',
              end: 'top 50%',
              scrub: false,
              toggleActions: 'play none none reverse',
            },
          }
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="w-full bg-background flex flex-col relative z-0">
      {/* ── Hero Section ── */}
      <section ref={heroRef} className="relative w-full h-screen flex items-center justify-center overflow-hidden">
        {/* 3D Globe background */}
        <div className="absolute inset-0 z-0">
          <HeroScene className="w-full h-full" theme={theme as 'light' | 'dark'} />
        </div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-outline-variant bg-surface-container/60 text-on-surface-variant text-xs font-mono tracking-[0.15em] uppercase mb-8 backdrop-blur-sm"
          >
            <Satellite size={14} className="text-primary" /> Sentinel-1 SAR Analysis
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.5 }}
            className="text-4xl md:text-6xl lg:text-7xl font-semibold text-on-surface tracking-tight leading-[1.1] mb-6"
          >
            When Roads Disappear,{' '}
            <span className="text-primary">Intelligence</span>{' '}
            Finds a Way.
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="text-base md:text-lg text-on-surface-variant max-w-xl mb-10 leading-relaxed"
          >
            ORBITRA7 processes satellite radar imagery to map flood-affected road networks 
            and compute risk-aware emergency logistics routes.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            <button 
              onClick={onLaunch}
              className="group px-7 py-3.5 bg-primary text-on-primary-container font-medium rounded-lg hover:bg-primary/90 transition-all duration-200 flex items-center gap-3 text-sm tracking-wide"
            >
              Enter Command Center
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-on-surface-variant"
        >
          <span className="text-[11px] font-mono tracking-[0.15em] uppercase opacity-60">Scroll to learn more</span>
          <ChevronDown size={18} className="animate-bounce" />
        </motion.div>
      </section>

      {/* ── Scroll Storytelling Scenes ── */}
      <section ref={scenesRef} className="relative z-10 w-full py-24 md:py-32 flex flex-col gap-32 md:gap-44">
        
        {/* Subtle divider */}
        <div className="w-16 h-px bg-outline-variant mx-auto" />

        {/* Scene 1: Observe */}
        <SceneCard
          step="01 — Observe"
          title="Orbital Radar Sees Through the Storm"
          description="Sentinel-1 Synthetic Aperture Radar penetrates cloud cover during active flooding events. Unlike optical imagery, SAR backscatter signatures remain usable in severe weather, providing the foundational observation layer."
          icon={<Satellite size={20} />}
          accentClass="text-primary"
        />

        {/* Scene 2: Detect */}
        <SceneCard
          step="02 — Detect"
          title="Flood Boundaries Extracted from Radar"
          description="By comparing pre-flood and post-flood backscatter, ORBITRA7 extracts precise inundation polygons. These vector geometries define where surface water has accumulated and at what extent."
          icon={<Activity size={20} />}
          accentClass="text-secondary"
        />

        {/* Scene 3: Analyze */}
        <SceneCard
          step="03 — Analyze"
          title="Road Segments Classified by Exposure"
          description="Flood polygons are intersected with OpenStreetMap road networks. Each segment is classified as Clear, Partially Flooded, or Submerged based on its measured exposure ratio to floodwater."
          icon={<Route size={20} />}
          accentClass="text-status-partial"
        />

        {/* Scene 4: Respond */}
        <SceneCard
          step="04 — Respond"
          title="Hazard-Aware Routes for Emergency Access"
          description="Using risk-penalized graph algorithms, ORBITRA7 calculates routes that avoid submerged road segments and minimize exposure to partially flooded areas. The goal is guaranteed arrival, not minimal distance."
          icon={<Shield size={20} />}
          accentClass="text-status-safe"
        />

        {/* Subtle divider */}
        <div className="w-16 h-px bg-outline-variant mx-auto" />

        {/* Final CTA */}
        <div className="flex flex-col items-center justify-center text-center py-12 px-6 max-w-xl mx-auto">
          <MapPin size={36} className="text-primary mb-5 opacity-70" />
          <h2 className="text-2xl md:text-3xl font-semibold text-on-surface mb-4 tracking-tight">
            Enter the Operational Map
          </h2>
          <p className="text-on-surface-variant mb-8 leading-relaxed text-sm md:text-base">
            The interactive dashboard uses cached satellite analysis from the Kerala 2018 flood event 
            to demonstrate tactical routing capabilities. Sample data only.
          </p>
          <button 
            onClick={onLaunch}
            className="group px-7 py-3.5 border border-primary text-primary font-medium rounded-lg hover:bg-primary/10 transition-all duration-200 flex items-center gap-3 text-sm tracking-wide"
          >
            Launch Dashboard
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────
   MAIN APP — state management + view switching
   ──────────────────────────────────────────── */

function App() {
  // ── Data state (PRESERVED) ──
  const [facilities, setFacilities] = useState<any>(null);
  const [roads, setRoads] = useState<any>(null);
  const [flood, setFlood] = useState<any>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [origin, setOrigin] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [routeResult, setRouteResult] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const [activeView, setActiveView] = useState<'intro' | 'app'>('intro');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [liveWeather, setLiveWeather] = useState<any>(null);
  const [hazards, setHazards] = useState<any[]>([]);

  // ── Theme persistence (PRESERVED) ──
  useEffect(() => {
    const saved = localStorage.getItem('orbitra7-theme');
    if (saved === 'light' || (!saved && window.matchMedia('(prefers-color-scheme: light)').matches)) {
      setTheme('light');
      document.documentElement.classList.add('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('orbitra7-theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  // ── Data loading ──
  const loadData = async (lat?: number, lon?: number) => {
    setIsLoadingData(true);
    setDataError(null);
    
    const [fac, rds, fld, haz] = await Promise.all([
      fetchFacilities(lat, lon),
      fetchRoads(lat, lon),
      fetchFlood(lat, lon),
      fetchHazards()
    ]);

    if (!fac || !rds || !fld) {
      setDataError('Failed to connect to ORBITRA7 backend. Ensure the FastAPI server is running on localhost:8000.');
    } else {
      setFacilities(fac);
      setRoads(rds);
      setFlood(fld);
      setHazards(haz?.data || []);
    }
    setIsLoadingData(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (origin && origin.geometry && origin.geometry.coordinates) {
      const [lon, lat] = origin.geometry.coordinates;
      fetchLiveWeather(lat, lon).then(data => setLiveWeather(data)).catch(console.error);
      loadData(lat, lon);
    }
  }, [origin]);

  const handleReportHazard = async (lat: number, lon: number, type: string, description: string) => {
    try {
      await reportHazard(lat, lon, type, description);
      const updatedHazards = await fetchHazards();
      setHazards(updatedHazards?.data || []);
    } catch (e) {
      console.error("Error reporting hazard", e);
    }
  };

  // ── Route calculation (PRESERVED) ──
  const handleCalculateRoute = async () => {
    if (!origin || !destination) return;
    setIsCalculating(true);
    setRouteResult(null);
    
    const request: RouteRequest = {
      origin: origin.geometry.coordinates,
      destination: destination.geometry.coordinates,
      scenario_id: 'kerala_2018'
    };
    
    const result = await calculateRoute(request);
    setRouteResult(result);
    setIsCalculating(false);
  };

  return (
    <div className="w-full h-screen bg-background text-on-background font-sans overflow-hidden flex flex-col relative">
      {/* ── Global Header ── */}
      <header className="absolute top-0 left-0 right-0 h-14 bg-background/80 backdrop-blur-xl border-b border-outline-variant/40 z-50 flex items-center justify-between px-5 transition-colors">
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setActiveView('intro')}>
          <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center border border-primary/30">
            <Satellite className="text-primary" size={15} />
          </div>
          <h1 className="font-semibold tracking-[0.12em] text-sm text-on-surface">
            ORBITRA<span className="text-primary">7</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-on-surface-variant px-3 py-1 rounded-md border border-outline-variant/50 bg-surface-container/50">
            <div className="w-1.5 h-1.5 rounded-full bg-status-safe"></div>
            Operational
          </div>

          {activeView === 'app' && (
            <button 
              onClick={() => setActiveView('intro')}
              className="text-[11px] font-mono text-on-surface-variant hover:text-on-surface transition-colors tracking-wide"
            >
              ← Overview
            </button>
          )}
        </div>
      </header>

      {/* 
        CRITICAL STABILITY FIX (PRESERVED): 
        Instead of using AnimatePresence to mount/unmount IntroView and CommandCenter,
        we keep both in the DOM and toggle their opacity and pointer-events.
        Unmounting CommandCenter destroys the WebGL context of MapLibre, 
        and unmounting HeroScene destroys its WebGL context. Doing this repeatedly 
        hits the browser's active context limit and crashes the website. 
      */}

      {/* Intro View */}
      <motion.div
        animate={{ 
          opacity: activeView === 'intro' ? 1 : 0,
          pointerEvents: activeView === 'intro' ? 'auto' : 'none',
          zIndex: activeView === 'intro' ? 20 : 10
        }}
        transition={{ duration: 0.4 }}
        className="absolute inset-0 pt-14 overflow-y-auto overflow-x-hidden bg-background"
      >
        <IntroView theme={theme} onLaunch={() => {
          setActiveView('app');
        }} />
      </motion.div>

      {/* App View */}
      <motion.div
        animate={{ 
          opacity: activeView === 'app' ? 1 : 0,
          scale: activeView === 'app' ? 1 : 1.02,
          pointerEvents: activeView === 'app' ? 'auto' : 'none',
          zIndex: activeView === 'app' ? 20 : 10
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed inset-0 pt-14"
      >
        <CommandCenter 
          theme={theme}
          facilities={facilities}
          roads={roads}
          flood={flood}
          routeResult={routeResult}
          origin={origin}
          destination={destination}
          isCalculating={isCalculating}
          isLoadingData={isLoadingData}
          dataError={dataError}
          liveWeather={liveWeather}
          hazards={hazards}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          onCalculateRoute={handleCalculateRoute}
          onClearRoute={() => setRouteResult(null)}
          onReportHazard={handleReportHazard}
        />
      </motion.div>
    </div>
  );
}

export default App;
