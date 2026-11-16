import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Pause, Play, RotateCcw, ZoomIn, ZoomOut, Rotate3D } from 'lucide-react';
import { createTrainerRig } from '../lib/trainer-rig';
import { createSoftwareScene } from '../lib/software-scene';
import './movement-demo.css';

const phases: Record<string, [string, string]> = {
  squat: ['Sit softly', 'Stand tall'],
  press: ['Lower with control', 'Press smoothly'],
  row: ['Lower with control', 'Pull elbows towards hips'],
  bridge: ['Lower gently', 'Lift your hips'],
  heel: ['Return your heel', 'Slide heel away'],
  calf: ['Lower your heels', 'Rise onto toes'],
  split: ['Lower gently', 'Stand up'],
  pushup: ['Move towards the wall', 'Push away'],
  bird: ['Return your knee', 'Slide foot back'],
  curl: ['Lower with control', 'Curl smoothly'],
  march: ['Step softly', 'Switch legs'],
};
const focusLabels: Record<string, string> = {
  squat: 'Thighs & hips',
  press: 'Chest & arms',
  row: 'Upper back & arms',
  bridge: 'Hips',
  heel: 'Trunk control',
  calf: 'Lower legs',
  split: 'Thighs & hips',
  pushup: 'Chest & arms',
  bird: 'Trunk control',
  curl: 'Arms',
  march: 'Legs',
};
const unilateral = ['heel', 'bird', 'split'];
const ACCENT = '#ffffff';
const DEFAULT_AZIMUTH = 0.65;
// The wall push-up wall stands in front of the trainer, so view it from the side.
const angleFor = (exercise: string) => (exercise === 'pushup' ? 1.95 : DEFAULT_AZIMUTH);
const presetAzimuth: Record<string, number> = {
  Front: 0,
  Side: Math.PI / 2,
  Angle: DEFAULT_AZIMUTH,
};
const smoother = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Rep tempo: quicker lift, pause at the top, slower lowering, settle at the bottom. */
function repProfile(exercise: string, cycle: number) {
  if (exercise === 'bird') {
    if (cycle < 0.31) return { t: smoother(cycle / 0.31), phase: 1 };
    if (cycle < 0.69) return { t: 1, phase: 2 };
    return { t: 1 - smoother((cycle - 0.69) / 0.31), phase: 0 };
  }
  if (cycle < 0.38) return { t: smoother(cycle / 0.38), phase: 1 };
  if (cycle < 0.5) return { t: 1, phase: 1 };
  if (cycle < 0.92) return { t: 1 - smoother((cycle - 0.5) / 0.42), phase: 0 };
  return { t: 0, phase: 0 };
}

function gradientTexture(
  size: number,
  stops: [number, string][],
  opts: { colorSpace?: THREE.ColorSpace; center?: [number, number]; radius?: number } = {},
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!,
    [cx, cy] = opts.center ?? [0.5, 0.5],
    g = ctx.createRadialGradient(
      size * cx,
      size * cy,
      0,
      size * cx,
      size * cy,
      size * (opts.radius ?? 0.5),
    );
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = opts.colorSpace ?? THREE.SRGBColorSpace;
  return texture;
}

type Engine = {
  playing: boolean;
  speed: number;
  time: number;
  side: 'left' | 'right';
  focus: boolean;
  camera?: (view: string) => void;
  zoom?: (factor: number) => void;
};

type Pulse = { value: number };

/** Adds a per-vertex focus mask so the highlight can glow on the GPU without repainting colours. */
function glowOnMask(material: THREE.Material, pulse: Pulse) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPulse = pulse;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aActive;\nvarying float vActive;',
      )
      .replace('#include <color_vertex>', '#include <color_vertex>\nvActive = aActive;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uPulse;\nvarying float vActive;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.46, 0.55, 0.2) * vActive * uPulse;`,
      );
  };
}

function bodyColors(model: THREE.Object3D, exercise: string, highlight: boolean, pulse: Pulse) {
  const v = new THREE.Vector3(),
    skin = new THREE.Color('#d2d2d2'),
    shirt = new THREE.Color('#2a2a2a'),
    shorts = new THREE.Color('#121212'),
    accent = new THREE.Color(ACCENT);
  model.updateMatrixWorld(true);
  model.traverse((obj) => {
    if (!(obj instanceof THREE.SkinnedMesh)) return;
    const g = obj.geometry,
      pos = g.getAttribute('position');
    if (!g.userData.restWorld) {
      const coords: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
        coords.push(v.x, v.y, v.z);
      }
      g.userData.restWorld = coords;
    }
    const coords = g.userData.restWorld as number[],
      arr = new Float32Array(pos.count * 3),
      mask = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = Math.abs(coords[i * 3]),
        y = coords[i * 3 + 1],
        z = coords[i * 3 + 2];
      let c =
        y < 0.13
          ? shorts
          : y > 0.65 && y < 1.01
            ? shorts
            : y >= 1.01 && y < 1.48 && x < 0.3
              ? shirt
              : skin;
      let active = false;
      if (['squat', 'split', 'march'].includes(exercise)) active = y > 0.52 && y < 1.03 && x < 0.29;
      if (exercise === 'calf') active = y > 0.15 && y < 0.53;
      if (exercise === 'bridge') active = y > 0.8 && y < 1.04;
      if (['heel', 'bird'].includes(exercise)) active = y > 1.02 && y < 1.27 && x < 0.23;
      if (['press', 'pushup'].includes(exercise))
        active = y > 1.26 && y < 1.48 && x < 0.31 && z > 0;
      if (exercise === 'row') active = y > 1.18 && y < 1.48 && x < 0.32 && z < 0.04;
      if (exercise === 'curl') active = x > 0.24 && y > 0.98 && y < 1.43;
      if (highlight && active) c = accent;
      arr.set([c.r, c.g, c.b], i * 3);
      mask[i] = active ? 1 : 0;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.setAttribute('aActive', new THREE.BufferAttribute(mask, 1));
    if (!obj.userData.materialReplaced) {
      const old = Array.isArray(obj.material) ? obj.material : [obj.material];
      old.forEach((m) => m.dispose());
      const eye = obj.name.toLowerCase().includes('eye');
      obj.material = new THREE.MeshPhysicalMaterial({
        color: eye ? '#2d2d2d' : '#ffffff',
        vertexColors: !eye,
        roughness: eye ? 0.35 : 0.64,
        metalness: 0,
        sheen: eye ? 0 : 0.7,
        sheenRoughness: 0.55,
        sheenColor: new THREE.Color('#d4d4d4'),
      });
      if (!eye) glowOnMask(obj.material, pulse);
      obj.userData.materialReplaced = true;
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

export default function MovementDemo({
  exercise,
  compact = false,
}: {
  exercise: string;
  compact?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Engine>({ playing: true, speed: 1, time: 0, side: 'right', focus: false });
  const [playing, setPlaying] = useState(true),
    [speed, setSpeed] = useState(1),
    [progress, setProgress] = useState(0),
    [phase, setPhase] = useState(1),
    [side, setSide] = useState<'left' | 'right'>('right'),
    [focus, setFocus] = useState(false),
    [status, setStatus] = useState('Loading trainer…'),
    [software, setSoftware] = useState(false),
    [retry, setRetry] = useState(0),
    [view, setView] = useState('Angle');
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let disposed = false,
      raf = 0,
      loaded = false,
      visible = true,
      paintedFocus = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    engine.current.time = 0;
    if (reduced) {
      engine.current.playing = false;
      setPlaying(false);
    }
    setStatus('Loading trainer…');
    const disposables: { dispose(): void }[] = [];
    const own = <T extends { dispose(): void }>(item: T) => (disposables.push(item), item);
    const pulse: Pulse = { value: 0 };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 40);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', `Interactive 3D ${exercise} demonstration`);
    canvas.style.touchAction = compact ? 'pan-y' : 'none';
    root.appendChild(canvas);
    let gpu: THREE.WebGLRenderer | undefined,
      cpu: ReturnType<typeof createSoftwareScene> | undefined;
    try {
      gpu = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
      gpu.setPixelRatio(Math.min(devicePixelRatio, 2));
      gpu.shadowMap.enabled = true;
      // Soft-filtered in three >= 0.18x (PCFSoftShadowMap was folded into PCFShadowMap).
      gpu.shadowMap.type = THREE.PCFShadowMap;
      gpu.outputColorSpace = THREE.SRGBColorSpace;
      gpu.toneMapping = THREE.ACESFilmicToneMapping;
      gpu.toneMappingExposure = 0.95;
      setSoftware(false);
    } catch {
      canvas.remove();
      const fallback = document.createElement('canvas');
      fallback.setAttribute('aria-label', `Interactive 3D ${exercise} demonstration`);
      fallback.style.touchAction = compact ? 'pan-y' : 'none';
      root.appendChild(fallback);
      cpu = createSoftwareScene(fallback);
      setSoftware(true);
    }
    scene.background = own(
      gradientTexture(
        256,
        [
          [0, '#3b3b3b'],
          [0.55, '#212121'],
          [1, '#0e0e0e'],
        ],
        { center: [0.5, 0.62], radius: 0.78 },
      ),
    );
    if (gpu) {
      const pmrem = new THREE.PMREMGenerator(gpu);
      const room = new RoomEnvironment();
      const envMap = pmrem.fromScene(room, 0.04).texture;
      scene.environment = envMap;
      scene.environmentIntensity = 0.55;
      own(pmrem);
      own(envMap);
      room.dispose();
    }
    const surface = gpu?.domElement || root.querySelector('canvas')!;
    const controls = new OrbitControls(camera, surface);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.enableZoom = !compact;
    controls.enableRotate = !compact;
    controls.minDistance = 2.1;
    controls.maxDistance = 8;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI * 0.53;
    const floorPose = ['bridge', 'heel', 'bird', 'press', 'row'].includes(exercise);
    controls.target.set(0, floorPose ? 0.62 : 0.92, 0);
    let width = 1,
      height = 1,
      baseDistance = 3.7,
      orbitClock = 0;
    // Damped camera move toward a goal expressed around the orbit target.
    let goal: { theta: number; h: number; y: number } | null = null;
    const place = (theta: number, h: number, y: number) =>
      camera.position.set(
        controls.target.x + Math.sin(theta) * h,
        controls.target.y + y,
        controls.target.z + Math.cos(theta) * h,
      );
    const polar = () => {
      const o = camera.position.clone().sub(controls.target);
      return { theta: Math.atan2(o.x, o.z), h: Math.hypot(o.x, o.z), y: o.y };
    };
    const fit = (angle: number, instant: boolean) => {
      const extent = floorPose ? 1.25 : 0.83;
      baseDistance = Math.max(
        3.7,
        extent / (Math.tan(THREE.MathUtils.degToRad(17.5)) * Math.max(camera.aspect, 0.4)),
      );
      if (instant) {
        goal = null;
        place(angle, baseDistance, baseDistance * 0.2);
        controls.update();
      } else goal = { theta: angle, h: baseDistance, y: baseDistance * 0.2 };
    };
    const resize = () => {
      width = Math.max(root.clientWidth, 1);
      height = Math.max(root.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      gpu?.setSize(width, height, false);
      cpu?.setSize(width, height);
      const current = polar();
      fit(current.h < 1e-3 || compact ? angleFor(exercise) : current.theta, true);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();
    engine.current.camera = (name) => {
      fit(name === 'Angle' ? angleFor(exercise) : (presetAzimuth[name] ?? DEFAULT_AZIMUTH), false);
      dirty = true;
    };
    engine.current.zoom = (factor) => {
      const now = polar(),
        r = Math.hypot(now.h, now.y),
        scale = THREE.MathUtils.clamp(r * factor, controls.minDistance, controls.maxDistance) / r;
      goal = { theta: now.theta, h: now.h * scale, y: now.y * scale };
      dirty = true;
    };
    const lights = new THREE.Group();
    scene.add(lights);
    lights.add(new THREE.HemisphereLight('#f9f9f9', '#272727', 0.9));
    const key = new THREE.DirectionalLight('#fafafa', 3.1);
    key.position.set(-3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -2.4,
      right: 2.4,
      top: 2.4,
      bottom: -2.4,
      near: 1,
      far: 14,
    });
    key.shadow.radius = 3.5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    lights.add(key);
    const rim = new THREE.DirectionalLight('#efefef', 1.9);
    rim.position.set(3.5, 3, -3.5);
    lights.add(rim);
    const fill = new THREE.DirectionalLight('#cecece', 0.9);
    fill.position.set(4, 2, 3);
    lights.add(fill);
    const props = new THREE.Group();
    scene.add(props);
    const steel = own(
      new THREE.MeshStandardMaterial({ color: '#d2d2d2', metalness: 0.85, roughness: 0.28 }),
    );
    const box = (
      position: number[],
      size: number[],
      color: string,
      rotation = 0,
      radius = 0.014,
    ) => {
      const [w, h, d] = size,
        m = new THREE.Mesh(
          new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2.2, h / 2.2, d / 2.2)),
          new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
        );
      m.position.set(...(position as [number, number, number]));
      m.rotation.x = rotation;
      m.castShadow = true;
      m.receiveShadow = true;
      props.add(m);
      return m;
    };
    const decor = (mesh: THREE.Mesh) => {
      mesh.userData.skipSoftware = true;
      scene.add(mesh);
      return mesh;
    };
    const floor = decor(
      new THREE.Mesh(
        new THREE.CircleGeometry(7, 64),
        new THREE.MeshStandardMaterial({
          color: '#252525',
          roughness: 0.95,
          transparent: true,
          alphaMap: own(
            gradientTexture(
              256,
              [
                [0, '#ffffff'],
                [0.2, '#ffffff'],
                [0.78, '#000000'],
              ],
              { colorSpace: THREE.NoColorSpace },
            ),
          ),
        }),
      ),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.045;
    floor.receiveShadow = true;
    const pool = decor(
      new THREE.Mesh(
        new THREE.CircleGeometry(2.1, 48),
        new THREE.MeshBasicMaterial({
          map: own(
            gradientTexture(128, [
              [0, 'rgba(156, 156, 156, 0.34)'],
              [1, 'rgba(156, 156, 156, 0)'],
            ]),
          ),
          transparent: true,
          depthWrite: false,
        }),
      ),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = -0.043;
    for (const [radius, opacity] of [
      [1.55, 0.2],
      [2.35, 0.1],
    ]) {
      const ring = decor(
        new THREE.Mesh(
          new THREE.RingGeometry(radius, radius + 0.008, 96),
          new THREE.MeshBasicMaterial({
            color: ACCENT,
            transparent: true,
            opacity,
            depthWrite: false,
          }),
        ),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.042;
    }
    box([0, -0.03, 0], [1.5, 0.025, floorPose ? 2.8 : 1.5], '#393939', 0, 0.011);
    const contact = decor(
      new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: own(
            gradientTexture(128, [
              [0, 'rgba(3, 3, 3, 0.62)'],
              [0.55, 'rgba(3, 3, 3, 0.28)'],
              [1, 'rgba(3, 3, 3, 0)'],
            ]),
          ),
          transparent: true,
          depthWrite: false,
        }),
      ),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = -0.0165;
    contact.scale.set(floorPose ? 1.15 : 1.05, floorPose ? 2.3 : 1.05, 1);
    const rubber = own(new THREE.MeshStandardMaterial({ color: '#1e1e1e', roughness: 0.55 }));
    const dumbbellGeometry = {
      handle: own(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16)),
      head: own(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 6)),
      cap: own(new THREE.CylinderGeometry(0.045, 0.045, 0.082, 20)),
    };
    const dumbbells = [new THREE.Group(), new THREE.Group()];
    dumbbells.forEach((group) => {
      const handle = new THREE.Mesh(dumbbellGeometry.handle, steel);
      handle.rotation.z = Math.PI / 2;
      handle.castShadow = true;
      group.add(handle);
      for (const x of [-0.145, 0.145]) {
        for (const [geometry, material] of [
          [dumbbellGeometry.head, rubber],
          [dumbbellGeometry.cap, steel],
        ] as const) {
          const part = new THREE.Mesh(geometry, material);
          part.rotation.z = Math.PI / 2;
          part.rotation.y = Math.PI / 6;
          part.position.x = x;
          part.castShadow = true;
          group.add(part);
        }
      }
      scene.add(group);
      group.visible = ['press', 'row', 'curl'].includes(exercise);
    });
    let rig: ReturnType<typeof createTrainerRig> | undefined, model: THREE.Object3D | undefined;
    const release = (obj: THREE.Object3D) =>
      obj.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
        if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
      });
    new GLTFLoader().load(
      `${import.meta.env.BASE_URL}models/trainer.glb`,
      (gltf) => {
        if (disposed) {
          release(gltf.scene);
          return;
        }
        model = gltf.scene;
        bodyColors(model, exercise, false, pulse);
        scene.add(model);
        rig = createTrainerRig(model);
        rig.getEquipment(exercise).forEach((e) => {
          const pad = '#7f7f7f',
            frame = '#333333';
          const mesh = box(
            e.position,
            e.size,
            e.kind === 'bench' ? pad : e.kind === 'wall' ? '#2a2a2a' : frame,
            e.rotationX || 0,
            e.kind === 'bench' ? 0.04 : 0.01,
          );
          if (e.kind === 'wall') {
            // Frosted so the trainer stays visible from the front preset.
            const material = mesh.material as THREE.MeshStandardMaterial;
            material.transparent = true;
            material.opacity = 0.42;
            material.depthWrite = false;
            mesh.castShadow = false;
          }
          if (e.kind === 'bench') {
            for (const z of [-e.size[2] * 0.34, e.size[2] * 0.34]) {
              const y = Math.max(0.1, (e.position[1] - Math.tan(e.rotationX || 0) * z - 0.045) / 2);
              box([e.position[0], y, e.position[2] + z], [0.06, y * 2, 0.065], '#c3c3c3');
              box(
                [e.position[0], 0.035, e.position[2] + z],
                [0.62, 0.055, 0.12],
                '#333333',
                0,
                0.02,
              );
            }
          }
          if (e.kind === 'support')
            box(
              [e.position[0], e.position[1] / 2, e.position[2] + 0.24],
              [0.055, e.position[1], 0.055],
              '#828282',
            );
        });
        loaded = true;
        setStatus('');
      },
      undefined,
      () => {
        if (!disposed) setStatus('Trainer could not load. Check your connection and try again.');
      },
    );
    const intersect = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    intersect.observe(root);
    let lastRender = 0,
      lastUI = 0,
      lastTime = -1,
      shownSide: 'left' | 'right' = engine.current.side,
      sideFade = 1,
      breathClock = 0,
      dirty = true;
    controls.addEventListener('change', () => {
      dirty = true;
    });
    controls.addEventListener('start', () => {
      goal = null;
    });
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!loaded || !visible || document.hidden || (cpu && now - lastRender < 75)) return;
      const dt = Math.min((now - lastRender) / 1000, 0.1);
      lastRender = now;
      const e = engine.current;
      if (e.focus !== paintedFocus) {
        bodyColors(model!, exercise, e.focus, pulse);
        paintedFocus = e.focus;
        dirty = true;
      }
      const orbiting = compact && e.playing && !reduced;
      const switching = e.side !== shownSide || sideFade < 1;
      if (
        !e.playing &&
        !goal &&
        !switching &&
        !(e.focus && gpu && !reduced) &&
        e.time === lastTime &&
        !dirty
      )
        return;
      dirty = false;
      if (e.playing) {
        e.time = (e.time + (dt * e.speed) / (exercise === 'bird' ? 8.4 : 6.4)) % 1;
        breathClock += dt;
      }
      // Switching sides eases the working limb back to rest before swapping it.
      if (e.side !== shownSide) {
        sideFade = Math.max(0, sideFade - dt / 0.22);
        if (sideFade === 0) shownSide = e.side;
      } else if (sideFade < 1) sideFade = Math.min(1, sideFade + dt / 0.3);
      const cycle = e.time,
        { t, phase: ph } = repProfile(exercise, cycle);
      rig!.update(exercise, t * smoother(sideFade), shownSide, {
        breath: Math.sin((breathClock * Math.PI * 2) / 4.4),
        sway: Math.sin((breathClock * Math.PI * 2) / 9.5),
      });
      rig!.getHandPositions().forEach((p, i) => dumbbells[i].position.copy(p));
      pulse.value = e.focus ? (reduced ? 0.3 : 0.28 + 0.2 * Math.sin((now / 1000) * 3.9)) : 0;
      if (orbiting) {
        orbitClock += dt;
        place(
          angleFor(exercise) + 0.5 * Math.sin(orbitClock * 0.32),
          baseDistance,
          baseDistance * 0.2,
        );
      } else if (goal) {
        const now2 = polar(),
          k = 1 - Math.exp(-dt * 7),
          dTheta = wrapAngle(goal.theta - now2.theta);
        place(
          now2.theta + dTheta * k,
          now2.h + (goal.h - now2.h) * k,
          now2.y + (goal.y - now2.y) * k,
        );
        if (Math.abs(dTheta) < 0.002 && Math.abs(goal.h - now2.h) < 0.003) goal = null;
      }
      controls.update();
      gpu?.render(scene, camera);
      cpu?.render(scene, camera);
      lastTime = e.time;
      if (!e.playing || now - lastUI > 100) {
        setProgress(Math.round(cycle * 100));
        setPhase(ph);
        lastUI = now;
      }
    };
    raf = requestAnimationFrame(frame);
    const loss = (event: Event) => {
      event.preventDefault();
      setStatus('Graphics paused. Reload the trainer to continue.');
      loaded = false;
    };
    surface.addEventListener('webglcontextlost', loss);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersect.disconnect();
      controls.dispose();
      rig?.dispose();
      release(scene);
      disposables.forEach((d) => d.dispose());
      gpu?.dispose();
      cpu?.dispose();
      surface.removeEventListener('webglcontextlost', loss);
      surface.remove();
      delete engine.current.camera;
      delete engine.current.zoom;
    };
  }, [exercise, compact, retry]);
  const pause = () => {
    engine.current.playing = false;
    setPlaying(false);
  };
  return (
    <div className={`trainer-studio ${compact ? 'trainer-compact' : ''}`}>
      {!compact && (
        <div className="trainer-top">
          <span>
            <i /> INTERACTIVE 3D
          </span>
          <span>{software ? 'COMPATIBILITY VIEW' : 'HUMAN MOTION STUDIO'}</span>
        </div>
      )}
      <div className="trainer-stage" ref={host} />
      {status && (
        <div className="trainer-status" role="status">
          <span>{status}</span>
          {!status.startsWith('Loading') && (
            <button onClick={() => setRetry((n) => n + 1)}>Reload trainer</button>
          )}
        </div>
      )}
      {!compact && (
        <>
          <div className="trainer-stage-footer">
            <span>
              <Rotate3D size={14} /> Drag to orbit · pinch to zoom
            </span>
            <div>
              <button aria-label="Zoom in" onClick={() => engine.current.zoom?.(0.88)}>
                <ZoomIn size={17} />
              </button>
              <button aria-label="Zoom out" onClick={() => engine.current.zoom?.(1.14)}>
                <ZoomOut size={17} />
              </button>
              <button
                aria-label="Reset camera"
                onClick={() => {
                  engine.current.camera?.('Angle');
                  setView('Angle');
                }}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
          <div className="trainer-panel">
            <div className="trainer-phase">
              <span className="trainer-phase-number">
                {phase === 0 ? '02' : phase === 2 ? 'HOLD' : '01'}
              </span>
              <strong>
                {phase === 2
                  ? 'Hold gently for 3 seconds'
                  : (phases[exercise] || phases.squat)[phase]}
              </strong>
              <span>CONTROLLED PACE</span>
            </div>
            <label className="trainer-timeline">
              <span className="sr-only">Movement timeline</span>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(ev) => {
                  pause();
                  const n = Number(ev.target.value);
                  engine.current.time = n / 100;
                  setProgress(n);
                }}
              />
              <span>{progress}%</span>
            </label>
            <div className="trainer-controls">
              <button
                className="trainer-play"
                aria-label={playing ? 'Pause animation' : 'Play animation'}
                onClick={() => {
                  engine.current.playing = !playing;
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />} {playing ? 'Pause' : 'Play'}
              </button>
              <label className="trainer-speed">
                <span className="sr-only">Playback speed</span>
                <select
                  value={speed}
                  onChange={(ev) => {
                    const n = Number(ev.target.value);
                    engine.current.speed = n;
                    setSpeed(n);
                  }}
                >
                  <option value={0.25}>0.25×</option>
                  <option value={0.5}>0.5×</option>
                  <option value={1}>1× speed</option>
                </select>
              </label>
              <div className="trainer-views" role="group" aria-label="Camera angle">
                {['Front', 'Side', 'Angle'].map((v) => (
                  <button
                    key={v}
                    aria-pressed={view === v}
                    onClick={() => {
                      engine.current.camera?.(v);
                      setView(v);
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="trainer-options">
              <button
                aria-pressed={focus}
                onClick={() => {
                  engine.current.focus = !focus;
                  setFocus(!focus);
                }}
              >
                <i className={focus ? 'on' : ''} /> Focus areas
              </button>
              {unilateral.includes(exercise) && (
                <button
                  onClick={() => {
                    const s = side === 'left' ? 'right' : 'left';
                    setSide(s);
                    engine.current.side = s;
                  }}
                >
                  Showing {side} side ↔
                </button>
              )}
              <span>{focus ? focusLabels[exercise] : 'Move within your comfortable range'}</span>
            </div>
            <p className="trainer-caption">
              Illustrative motion, not a technique assessment. Focus colours show broad body
              regions, not measured muscle activity.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
