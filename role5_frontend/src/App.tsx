import React, { useState, useEffect, useRef } from 'react';
import HeroScene from './components/HeroScene';
import CommandCenter from './components/CommandCenter';
import { fetchFacilities, fetchRoads, fetchFlood, calculateRoute } from './api';
import type { RouteRequest } from './api';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ShieldAlert, Activity, ArrowRight, 
  Map as MapIcon, Database, Navigation, Layers,
  Sun, Moon
} from 'lucide-react';
import clsx from 'clsx';

function HorizontalScrollSection() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: targetRef });
  
  // We have 4 panels, so we move -75% horizontally when scrolled to the end
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-75%"]);
  
  return (
    <section ref={targetRef} className="relative h-[400vh] bg-background">
      <div className="sticky top-0 h-screen flex items-center overflow-hidden border-y border-outline-variant/30 bg-surface-container-lowest/50 backdrop-blur-sm">
        <motion.div style={{ x }} className="flex w-[400vw]">
          <div className="w-screen flex-shrink-0 flex items-center justify-center px-12 md:px-24">
            <StoryBlock 
              icon={<Database className="text-secondary" size={40} />}
              title="Flood Intelligence"
              content="During severe natural disasters, ground reports become unreliable. Existing routing engines blindly direct emergency responders into submerged terrain, causing critical delays. ORBITRA7 observes the earth from orbit and maps it to the road network."
            />
          </div>
          <div className="w-screen flex-shrink-0 flex items-center justify-center px-12 md:px-24">
            <StoryBlock 
              icon={<Layers className="text-emerald-500" size={40} />}
              title="Geospatial Processing"
              content="ORBITRA7 ingests Sentinel-1 Synthetic Aperture Radar (SAR) imagery, which can penetrate cloud cover during active storms. By comparing pre-flood and post-flood backscatter signatures, we extract precise inundation polygons."
            />
          </div>
          <div className="w-screen flex-shrink-0 flex items-center justify-center px-12 md:px-24">
            <StoryBlock 
              icon={<MapIcon className="text-orange-500" size={40} />}
              title="Road Classification"
              content="We intersect the flood polygons with OpenStreetMap networks. Segments are dynamically classified as Clear, Partially Flooded (Hazard), or Submerged (Impassable), creating a real-time risk topology."
            />
          </div>
          <div className="w-screen flex-shrink-0 flex items-center justify-center px-12 md:px-24">
            <StoryBlock 
              icon={<Navigation className="text-primary-container" size={40} />}
              title="Hazard-Aware Pathfinding"
              content="Using NetworkX, we apply exponential distance penalties to flooded segments. The engine calculates paths that prioritize safety and guaranteed arrival over absolute physical distance, preventing stranded relief convoys."
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function StoryBlock({ icon, title, content }: { icon: React.ReactNode, title: string, content: string }) {
  return (
    <div className="flex flex-col gap-6 max-w-3xl glass-panel-strong p-10 md:p-16 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-2 h-full bg-primary/40 group-hover:bg-primary transition-colors"></div>
      <div className="p-5 rounded-2xl bg-surface-container-highest border border-outline-variant shadow-lg inline-flex self-start">
        {icon}
      </div>
      <h3 className="text-3xl md:text-5xl font-bold text-on-surface tracking-tight">{title}</h3>
      <p className="text-xl text-on-surface-variant leading-relaxed">{content}</p>
    </div>
  );
}

function IntroView({ onLaunch, theme }: { onLaunch: () => void, theme: string }) {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  return (
    <div className="w-full bg-background flex flex-col relative z-0">
      {/* Hero Section */}
      <section className="relative w-full h-screen flex items-center justify-center overflow-hidden">
        <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className="absolute inset-0 z-0">
          <HeroScene className="w-full h-full" theme={theme} />
        </motion.div>
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-4xl mx-auto mt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary-container text-xs font-mono uppercase tracking-widest mb-8 backdrop-blur-md"
          >
            <Activity size={14} /> Sentinel-1 SAR Integration Active
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="text-5xl md:text-7xl font-bold text-on-surface tracking-tight leading-tight mb-6"
          >
            Tactical <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Geospatial</span> Intelligence
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="text-lg md:text-xl text-on-surface-variant max-w-2xl mb-12 leading-relaxed"
          >
            ORBITRA7 dynamically analyzes satellite imagery to identify post-flood road accessibility and compute risk-penalized emergency logistics routes.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-6"
          >
            <button 
              onClick={onLaunch}
              className="px-8 py-4 bg-primary text-on-primary-container font-semibold rounded-lg shadow-glow-cyan hover:shadow-glow-cyan-strong hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 group"
            >
              LAUNCH COMMAND CENTER
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-on-surface-variant animate-bounce"
        >
          <span className="text-xs font-mono tracking-widest uppercase opacity-70">Scroll to brief</span>
          <ChevronDown size={20} />
        </motion.div>
      </section>

      {/* Horizontal Scrollytelling */}
      <HorizontalScrollSection />

      {/* Final transition to app */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 py-32 flex flex-col gap-16">
        <div className="flex flex-col items-center justify-center text-center py-20 px-6 glass-panel border-t border-primary/20 bg-[color-mix(in_srgb,var(--color-primary)_5%,transparent)]">
          <ShieldAlert size={48} className="text-primary-container mb-6 opacity-80" />
          <h2 className="text-3xl font-bold text-on-surface mb-6">Enter the Operational Map</h2>
          <p className="text-on-surface-variant max-w-2xl mb-10 leading-relaxed">
            The following interface is a live prototype. It uses cached satellite analysis from the devastating Kerala 2018 flood event to demonstrate the tactical routing capabilities.
          </p>
          <button 
            onClick={onLaunch}
            className="px-8 py-4 border border-primary text-primary-container font-semibold rounded-lg hover:bg-primary/10 hover:shadow-glow-cyan transition-all duration-300 flex items-center gap-3 group"
          >
            INITIALIZE PROTOTYPE
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>
    </div>
  );
}

function App() {
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

  // Load theme on mount
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

  // Load data immediately on mount to prevent lag when switching views
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
      scenario_id: 'kerala_2018'
    };
    
    const result = await calculateRoute(request);
    setRouteResult(result);
    setIsCalculating(false);
  };

  return (
    <div className="w-full h-screen bg-background text-on-background font-sans overflow-hidden flex flex-col relative">
      {/* Global Header */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-b border-outline-variant/30 z-50 flex items-center justify-between px-6 transition-colors">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveView('intro')}>
          <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center border border-primary/50 shadow-glow-cyan">
            <Activity className="text-primary-container" size={18} />
          </div>
          <h1 className="font-bold tracking-widest text-sm uppercase">ORBITRA<span className="text-primary">7</span></h1>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-surface-container-low px-3 py-1.5 rounded-md border border-outline-variant">
            <div className="w-2 h-2 rounded-full bg-status-safe animate-pulse shadow-glow-cyan"></div>
            SYSTEM OPERATIONAL
          </div>
          {activeView === 'app' && (
            <button 
              onClick={() => setActiveView('intro')}
              className="text-xs font-mono text-on-surface-variant hover:text-on-surface transition-colors uppercase tracking-wider"
            >
              Back to Briefing
            </button>
          )}
        </div>
      </header>

      {/* 
        CRITICAL STABILITY FIX: 
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
        transition={{ duration: 0.5 }}
        className="absolute inset-0 pt-16 overflow-y-auto overflow-x-hidden bg-background"
      >
        <IntroView theme={theme} onLaunch={() => {
          setActiveView('app');
        }} />
      </motion.div>

      {/* App View */}
      <motion.div
        animate={{ 
          opacity: activeView === 'app' ? 1 : 0,
          scale: activeView === 'app' ? 1 : 1.05,
          pointerEvents: activeView === 'app' ? 'auto' : 'none',
          zIndex: activeView === 'app' ? 20 : 10
        }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute inset-0 pt-16"
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
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          onCalculateRoute={handleCalculateRoute}
          onClearRoute={() => setRouteResult(null)}
        />
      </motion.div>
    </div>
  );
}

export default App;
