
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface ThreeSceneProps {
  onLoad: () => void;
}

export interface ThreeSceneRef {
  updateHandInteraction: (x: number, y: number, isPinching: boolean) => void;
  addMemory: (url: string) => void;
}

const ThreeScene = forwardRef<ThreeSceneRef, ThreeSceneProps>(({ onLoad }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainGroupRef = useRef<THREE.Group>(new THREE.Group());
  const memoriesGroupRef = useRef<THREE.Group>(new THREE.Group());
  const trailGroupRef = useRef<THREE.Group>(new THREE.Group());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const clock = useRef(new THREE.Clock());
  
  // 交互状态
  const targetHandPos = useRef(new THREE.Vector3(0, 0, 0));
  const currentHandPos = useRef(new THREE.Vector3(0, 0, 0));
  const isPinchingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    updateHandInteraction: (x, y, isPinching) => {
      // 将归一化坐标转换为3D场景空间坐标
      // x: 0~1 -> -25~25, y: 0~1 -> 20~-20
      targetHandPos.current.set((x - 0.5) * 50, (0.5 - y) * 40, 10);
      isPinchingRef.current = isPinching;
      
      // 同时也保留基础旋转逻辑
      const targetRX = (y - 0.5) * 0.3;
      const targetRY = (x - 0.5) * 0.6;
      mainGroupRef.current.rotation.x += (targetRX - mainGroupRef.current.rotation.x) * 0.05;
      mainGroupRef.current.rotation.y += (targetRY - mainGroupRef.current.rotation.y) * 0.05;
    },
    addMemory: (url) => {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(url, (texture) => {
        const geo = new THREE.PlaneGeometry(4, 4);
        const mat = new THREE.MeshBasicMaterial({ 
          map: texture, 
          transparent: true, 
          opacity: 0,
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        const angle = Math.random() * Math.PI * 2;
        const radius = 12 + Math.random() * 5;
        const height = Math.random() * 25 - 5;
        mesh.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
        mesh.lookAt(0, height, 0);
        (mesh.userData as any).birth = clock.current.getElapsedTime();
        memoriesGroupRef.current.add(mesh);
      });
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 55);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 2.5;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.4, 0.85);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // --- 灯光 ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const mainLight = new THREE.SpotLight(0xd4af37, 2000);
    mainLight.position.set(20, 50, 30);
    scene.add(mainLight);

    // --- 圣诞树主体 ---
    const mainGroup = mainGroupRef.current;
    scene.add(mainGroup);

    const treeMat = new THREE.MeshStandardMaterial({ 
      color: 0xd4af37, 
      metalness: 1.0, 
      roughness: 0.2,
      emissive: 0x221100
    });

    const treeGroup = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const radius = (7 - i) * 2.8;
      const geo = new THREE.ConeGeometry(radius, 6, 32, 1, true);
      const layer = new THREE.Mesh(geo, treeMat);
      layer.position.y = i * 3.8;
      treeGroup.add(layer);
    }
    mainGroup.add(treeGroup);
    mainGroup.add(memoriesGroupRef.current);
    mainGroup.add(trailGroupRef.current);

    // --- 粒子系统 1: 星尘涡流 (Vortex) ---
    const vortexCount = 3000;
    const vGeo = new THREE.BufferGeometry();
    const vPos = new Float32Array(vortexCount * 3);
    const vVel = new Float32Array(vortexCount); // 旋转速度
    for (let i = 0; i < vortexCount; i++) {
      const r = 5 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      vPos[i * 3] = Math.cos(theta) * r;
      vPos[i * 3 + 1] = (Math.random() - 0.2) * 40;
      vPos[i * 3 + 2] = Math.sin(theta) * r;
      vVel[i] = 0.2 + Math.random() * 0.5;
    }
    vGeo.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
    const vMat = new THREE.PointsMaterial({ color: 0xfceea7, size: 0.12, transparent: true, opacity: 0.4 });
    const vortex = new THREE.Points(vGeo, vMat);
    scene.add(vortex);

    // --- 粒子系统 2: 手部灵迹 (Spirit Trail) ---
    const trailCount = 100;
    const tGeo = new THREE.BufferGeometry();
    const tPos = new Float32Array(trailCount * 3);
    for (let i = 0; i < trailCount * 3; i++) tPos[i] = 0;
    tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    const tMat = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: 0.4, 
      transparent: true, 
      opacity: 0.8,
      blending: THREE.AdditiveBlending 
    });
    const trailParticles = new THREE.Points(tGeo, tMat);
    scene.add(trailParticles);

    const animate = () => {
      requestAnimationFrame(animate);
      const elapsed = clock.current.getElapsedTime();
      
      // 1. 涡流旋转
      const vPositions = vGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < vortexCount; i++) {
        const x = vPositions[i * 3];
        const z = vPositions[i * 3 + 2];
        const angle = vVel[i] * 0.01;
        vPositions[i * 3] = x * Math.cos(angle) - z * Math.sin(angle);
        vPositions[i * 3 + 2] = x * Math.sin(angle) + z * Math.cos(angle);
        vPositions[i * 3 + 1] += Math.sin(elapsed + i) * 0.01;
      }
      vGeo.attributes.position.needsUpdate = true;

      // 2. 手部轨迹平滑跟随
      currentHandPos.current.lerp(targetHandPos.current, 0.15);
      const tPositions = tGeo.attributes.position.array as Float32Array;
      // 简单的延迟跟随效果
      for (let i = trailCount - 1; i > 0; i--) {
        tPositions[i * 3] = tPositions[(i - 1) * 3];
        tPositions[i * 3 + 1] = tPositions[(i - 1) * 3 + 1];
        tPositions[i * 3 + 2] = tPositions[(i - 1) * 3 + 2];
      }
      tPositions[0] = currentHandPos.current.x;
      tPositions[1] = currentHandPos.current.y;
      tPositions[2] = currentHandPos.current.z;
      tGeo.attributes.position.needsUpdate = true;

      // 3. 捏合手势反馈 (让星尘变亮)
      vMat.opacity = isPinchingRef.current ? 0.8 : 0.4;
      vMat.size = isPinchingRef.current ? 0.25 : 0.12;

      // 4. 记忆相片动画
      memoriesGroupRef.current.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const age = elapsed - (mesh.userData.birth || 0);
        if (age < 2) mat.opacity = age / 2;
        mesh.position.y += Math.sin(elapsed + mesh.position.x) * 0.01;
      });

      composer.render();
    };

    animate();
    onLoad();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div ref={containerRef} className="fixed inset-0 z-0 touch-none" />;
});

export default ThreeScene;
