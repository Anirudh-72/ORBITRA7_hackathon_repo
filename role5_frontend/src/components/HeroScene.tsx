import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const Terrain = React.memo(({ theme }: { theme: 'light' | 'dark' }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const scanLineRef = useRef<THREE.Mesh>(null);
  const isLight = theme === 'light';

  // Generate displaced terrain geometry
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(30, 30, 128, 128);
    const pos = geo.attributes.position;
    
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      
      // Simple pseudo-noise using trig functions
      let z = Math.sin(x * 0.2) * Math.cos(y * 0.2) * 1.5;
      z += Math.sin(x * 0.5 + y * 0.8) * 0.5;
      z += Math.cos(x * 1.2 - y * 0.4) * 0.2;
      
      // Keep edges lower to look like an island/segment
      const dist = Math.sqrt(x*x + y*y);
      const falloff = Math.max(0, 1 - dist / 15);
      
      pos.setZ(i, z * falloff);
    }
    
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame((state) => {
    if (scanLineRef.current) {
      // Sweep scanline across the terrain (Z axis locally since it's rotated)
      const time = state.clock.getElapsedTime();
      const sweep = (time % 8) / 8; // 0 to 1 over 8 seconds
      const yPos = 15 - sweep * 30; // 15 to -15
      scanLineRef.current.position.y = yPos;
    }
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Solid base terrain */}
      <mesh geometry={geometry}>
        <meshStandardMaterial 
          color={isLight ? "#e2e8f0" : "#0a0e17"} 
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>
      
      {/* Wireframe overlay */}
      <mesh geometry={geometry} position={[0, 0, 0.01]}>
        <meshBasicMaterial 
          color={isLight ? "#0284c7" : "#00f0ff"} 
          wireframe={true} 
          transparent={true} 
          opacity={isLight ? 0.2 : 0.06} 
        />
      </mesh>

      {/* Scanning Line Effect */}
      <mesh ref={scanLineRef} position={[0, 15, 0.1]}>
        <planeGeometry args={[30, 0.2]} />
        <meshBasicMaterial 
          color={isLight ? "#0284c7" : "#00f0ff"} 
          transparent={true} 
          opacity={0.3} 
          additiveBlending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
});

Terrain.displayName = 'Terrain';

const Water = React.memo(({ theme }: { theme: 'light' | 'dark' }) => {
  const waterRef = useRef<THREE.Mesh>(null);
  const isLight = theme === 'light';
  
  useFrame((state) => {
    if (waterRef.current) {
      // Gentle undulation
      waterRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
      <planeGeometry args={[30, 30, 32, 32]} />
      <meshStandardMaterial 
        color={isLight ? "#38bdf8" : "#0891b2"} 
        transparent={true} 
        opacity={isLight ? 0.3 : 0.15}
        roughness={0.1}
        metalness={0.8}
      />
    </mesh>
  );
});

Water.displayName = 'Water';

const Particles = React.memo(({ theme }: { theme: 'light' | 'dark' }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const isLight = theme === 'light';
  
  const particleCount = 250;
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30; // x
      pos[i * 3 + 1] = Math.random() * 10;     // y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30; // z
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        // Move upward
        positions[i * 3 + 1] += delta * 0.5;
        // Add subtle horizontal drift
        positions[i * 3] += Math.sin(state.clock.elapsedTime + i) * delta * 0.2;
        
        // Wrap around when reaching top
        if (positions[i * 3 + 1] > 10) {
          positions[i * 3 + 1] = 0;
        }
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute 
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.02} 
        color={isLight ? "#0284c7" : "#e0ffff"} 
        transparent={true} 
        opacity={isLight ? 0.4 : 0.6}
        sizeAttenuation={true}
        blending={isLight ? THREE.NormalBlending : THREE.AdditiveBlending}
      />
    </points>
  );
});

Particles.displayName = 'Particles';

export interface HeroSceneProps {
  className?: string;
  theme: 'light' | 'dark';
}

const HeroScene: React.FC<HeroSceneProps> = ({ className, theme }) => {
  const isLight = theme === 'light';
  
  return (
    <div className={className}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        camera={{ position: [0, 8, 12], fov: 45 }}
      >
        {/* Lighting */}
        <ambientLight intensity={isLight ? 0.6 : 0.15} />
        <directionalLight 
          position={[10, 15, -5]} 
          intensity={isLight ? 2 : 1} 
          color="#ffffff" 
        />
        <pointLight 
          position={[0, -2, 0]} 
          intensity={isLight ? 8 : 5} 
          color={isLight ? "#0284c7" : "#00f0ff"} 
          distance={20}
        />

        {/* Scene Components */}
        <Terrain theme={theme} />
        <Water theme={theme} />
        <Particles theme={theme} />

        {/* Camera Controls */}
        <OrbitControls 
          target={[0, 0, 0]}
          autoRotate 
          autoRotateSpeed={0.1}
          enablePan={false}
          enableZoom={false}
          maxPolarAngle={Math.PI / 2.5}
          minPolarAngle={Math.PI / 4}
        />
      </Canvas>
    </div>
  );
};

export default HeroScene;
