"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PitchSample } from "@/lib/pitch-track";

function toThree([x, y, z]: [number, number, number]): THREE.Vector3 {
  // Contract: +x toward first base, +y toward center field, +z up.
  // Three: +x right, +y up, +z toward the camera behind the plate.
  return new THREE.Vector3(x, z, -y);
}

function CameraRig() {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.lookAt(0, 0.95, -10);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function Field() {
  const plate = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.2165, -0.2165);
    shape.lineTo(0.2165, -0.2165);
    shape.lineTo(0.2165, 0.05);
    shape.lineTo(0, 0.2165);
    shape.lineTo(-0.2165, 0.05);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  const strikeZone = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.43, 0.6, 0.02)),
    [],
  );

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color="#0e3524" roughness={1} />
      </mesh>

      <gridHelper args={[80, 40, "#1d5138", "#15402c"]} position-y={0.002} />

      <mesh geometry={plate} rotation-x={-Math.PI / 2} position-y={0.012}>
        <meshStandardMaterial color="#e8e2cf" roughness={0.8} />
      </mesh>

      <lineSegments geometry={strikeZone} position={[0, 0.75, -0.05]}>
        <lineBasicMaterial color="#e06a45" transparent opacity={0.85} />
      </lineSegments>

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          rotation-x={-Math.PI / 2}
          position={[side * 0.95, 0.006, 0.75]}
        >
          <planeGeometry args={[1.2, 1.8]} />
          <meshBasicMaterial color="#d9d2bd" transparent opacity={0.25} />
        </mesh>
      ))}

      {[-1, 1].map((side) => (
        <mesh
          key={`foul-${side}`}
          position={[side * 10.6, 0.004, -10.6]}
          rotation-y={side * -Math.PI / 4}
        >
          <boxGeometry args={[0.06, 0.002, 30]} />
          <meshBasicMaterial color="#d9d2bd" transparent opacity={0.28} />
        </mesh>
      ))}

      <mesh position={[0, 0.1, -18.44]}>
        <cylinderGeometry args={[2.7, 2.7, 0.2, 48]} />
        <meshStandardMaterial color="#174a32" roughness={1} />
      </mesh>

      <mesh position={[0, 0.22, -18.44]}>
        <boxGeometry args={[0.61, 0.04, 0.15]} />
        <meshStandardMaterial color="#e8e2cf" />
      </mesh>

      <pointLight position={[0, 1.4, 0.4]} intensity={0.7} distance={4} color="#f2d8b0" />
    </group>
  );
}

function PitchPath({ samples, replayKey }: { samples: PitchSample[]; replayKey: number }) {
  const ball = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.Line>(null);
  const progress = useRef(0);
  const reducedMotion = useRef(false);

  const points = useMemo(() => samples.map((sample) => toThree(sample.p)), [samples]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setDrawRange(0, 1);
    const material = new THREE.LineBasicMaterial({
      color: "#e06a45",
      transparent: true,
      opacity: 0.55,
    });
    return new THREE.Line(geometry, material);
  }, [points]);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    progress.current = 0;
    line.geometry.setDrawRange(0, 1);
  }, [replayKey, line]);

  useEffect(() => {
    return () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, [line]);

  useFrame((_, delta) => {
    progress.current = Math.min(progress.current + delta / 0.9, 1);
    if (reducedMotion.current) progress.current = Math.max(progress.current, 0.85);

    const t = progress.current;
    const position = curve.getPointAt(t);
    ball.current?.position.copy(position);
    line.geometry.setDrawRange(0, Math.max(2, Math.round(t * points.length)));
  });

  return (
    <group>
      <primitive object={line} />
      <mesh ref={ball} position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.045, 24, 24]} />
        <meshStandardMaterial
          color="#f5ead2"
          emissive="#e0cba0"
          emissiveIntensity={0.35}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

export default function PitchScene({
  samples,
  replayKey,
}: {
  samples: PitchSample[];
  replayKey: number;
}) {
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 1.45, 3.2], fov: 45, near: 0.1, far: 140 }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 10, 4]} intensity={1.35} />
        <directionalLight position={[-6, 6, -8]} intensity={0.5} color="#9fd4b4" />
        <CameraRig />
        <Field />
        <PitchPath samples={samples} replayKey={replayKey} />
      </Canvas>
    </div>
  );
}
