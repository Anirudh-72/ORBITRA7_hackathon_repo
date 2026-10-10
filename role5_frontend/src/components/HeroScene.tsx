import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';

export interface HeroSceneProps {
  className?: string;
  theme: 'light' | 'dark';
}

const DataPoint = React.memo(({ position }: { position: THREE.Vector3 }) => {
  const ref = useRef<THREE.Mesh>(null);
  const timeOffset = useMemo(() => Math.random() * Math.PI * 2, []);
  
  useFrame((state) => {
    if (ref.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2 + timeOffset) * 0.3;
      ref.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <mesh position={position} ref={ref}>
      <sphereGeometry args={[0.025, 16, 16]} />
      <meshBasicMaterial color="#D5B477" />
    </mesh>
  );
});

const ScanLine = React.memo(() => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group ref={ref} rotation={[0.35, 0, 0]}>
      <mesh>
        <torusGeometry args={[1.4, 0.003, 16, 100]} />
        <meshBasicMaterial color="#78958A" transparent opacity={0.3} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
});

const Atmosphere = React.memo(({ theme }: { theme: 'light' | 'dark' }) => {
  return (
    <mesh>
      <sphereGeometry args={[1.35, 40, 40]} />
      <meshBasicMaterial 
        color="#78958A" 
        transparent 
        opacity={theme === 'dark' ? 0.1 : 0.06}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
});

const Globe = React.memo(({ theme }: { theme: 'light' | 'dark' }) => {
  const globeRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.05;
    }
  });

  const { geometry, pts, cityGeo } = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.2, 45);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    const colors = new Float32Array(pos.count * 3);
    
    const oceanC = new THREE.Color(theme === 'dark' ? '#172220' : '#D0D8D6');
    const landC = new THREE.Color(theme === 'dark' ? '#2c3a35' : '#E2E8E6');
    
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.normalize();
      
      const nx = v.x * 2.5;
      const ny = v.y * 2.5;
      const nz = v.z * 2.5;
      
      let n = Math.sin(nx + Math.cos(ny)) 
            + Math.sin(ny + Math.cos(nz)) 
            + Math.sin(nz + Math.cos(nx));
      n /= 3;
      
      let n2 = Math.sin(nx*2.5 + Math.cos(ny*2.5)) 
             + Math.sin(ny*2.5 + Math.cos(nz*2.5)) 
             + Math.sin(nz*2.5 + Math.cos(nx*2.5));
      n2 /= 3;
      
      let noiseVal = n + n2 * 0.4;
            
      let h = 0;
      if (noiseVal > 0.15) {
        h = (noiseVal - 0.15) * 0.06;
        landC.toArray(colors, i * 3);
      } else {
        oceanC.toArray(colors, i * 3);
      }
      
      v.multiplyScalar(1.2 + h);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const dataPts: THREE.Vector3[] = [];
    const cityPts: THREE.Vector3[] = [];
    let attempts = 0;
    while(dataPts.length < 15 && attempts < 1000) {
      attempts++;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      
      const nx = x * 2.5;
      const ny = y * 2.5;
      const nz = z * 2.5;
      
      let n = Math.sin(nx + Math.cos(ny)) + Math.sin(ny + Math.cos(nz)) + Math.sin(nz + Math.cos(nx)); n /= 3;
      let n2 = Math.sin(nx*2.5 + Math.cos(ny*2.5)) + Math.sin(ny*2.5 + Math.cos(nz*2.5)) + Math.sin(nz*2.5 + Math.cos(nx*2.5)); n2 /= 3;
      let noiseVal = n + n2 * 0.4;
            
      if (noiseVal > 0.15) {
        let h = (noiseVal - 0.15) * 0.06;
        if (Math.random() > 0.7) {
          dataPts.push(new THREE.Vector3(x * (1.2 + h), y * (1.2 + h), z * (1.2 + h)));
        } else {
          cityPts.push(new THREE.Vector3(x * (1.2 + h + 0.005), y * (1.2 + h + 0.005), z * (1.2 + h + 0.005)));
        }
      }
    }

    // Create a geometry for city lights
    const cityGeo = new THREE.BufferGeometry().setFromPoints(cityPts);

    return { geometry: geo, pts: dataPts, cityGeo };
  }, [theme]);

  return (
    <group ref={globeRef}>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.7} metalness={0.2} />
      </mesh>
      
      <mesh geometry={geometry}>
        <meshBasicMaterial 
          color="#78958A" 
          wireframe 
          transparent 
          opacity={theme === 'dark' ? 0.08 : 0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* City lights */ }
      {theme === 'dark' && (
        <points geometry={cityGeo}>
          <pointsMaterial size={0.012} color="#D5B477" transparent opacity={0.6} blending={THREE.AdditiveBlending} sizeAttenuation={true} />
        </points>
      )}

      {pts.map((p, i) => (
        <DataPoint key={i} position={p} />
      ))}
    </group>
  );
});

const SceneLights = React.memo(({ theme }: { theme: 'light' | 'dark' }) => {
  return (
    <>
      <ambientLight intensity={theme === 'dark' ? 0.8 : 1.2} />
      <directionalLight position={[5, 3, 2]} intensity={theme === 'dark' ? 2.5 : 3.5} color="#fffcf5" />
      <pointLight position={[-5, -5, -5]} intensity={theme === 'dark' ? 1.5 : 2.0} color="#78958A" />
      <pointLight position={[0, -5, 0]} intensity={theme === 'dark' ? 1.5 : 2.0} color="#78958A" />
    </>
  );
});

export default function HeroScene({ className, theme = 'dark' }: HeroSceneProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.5, 4.5], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <SceneLights theme={theme} />
        <Globe theme={theme} />
        <Atmosphere theme={theme} />
        <ScanLine />
      </Canvas>
    </div>
  );
}
