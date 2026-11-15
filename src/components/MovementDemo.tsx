import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pause, Play, RotateCcw, ZoomIn, ZoomOut, Rotate3D } from 'lucide-react';
import { createTrainerRig } from '../lib/trainer-rig';
import { createSoftwareScene } from '../lib/software-scene';

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
type Engine = {
  playing: boolean;
  speed: number;
  time: number;
  side: 'left' | 'right';
  focus: boolean;
  camera?: (view: string) => void;
  zoom?: (factor: number) => void;
};

function bodyColors(model: THREE.Object3D, exercise: string, highlight: boolean) {
  const v = new THREE.Vector3(),
    skin = new THREE.Color('#c4d3c9'),
    shirt = new THREE.Color('#769c87'),
    shorts = new THREE.Color('#263e36'),
    accent = new THREE.Color('#d5ee92');
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
      arr = new Float32Array(pos.count * 3);
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
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!obj.userData.materialReplaced) {
      const old = Array.isArray(obj.material) ? obj.material : [obj.material];
      old.forEach((m) => m.dispose());
      obj.material = new THREE.MeshStandardMaterial({
        color: obj.name.toLowerCase().includes('eye') ? '#263e36' : '#ffffff',
        vertexColors: !obj.name.toLowerCase().includes('eye'),
        roughness: 0.72,
        metalness: 0.02,
      });
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
    engine.current.time = 0;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      engine.current.playing = false;
      setPlaying(false);
    }
    setStatus('Loading trainer…');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#13251f');
    scene.fog = new THREE.Fog('#13251f', 8, 18);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 40);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', `Interactive 3D ${exercise} demonstration`);
    canvas.style.touchAction = compact ? 'pan-y' : 'none';
    root.appendChild(canvas);
    let gpu: THREE.WebGLRenderer | undefined,
      cpu: ReturnType<typeof createSoftwareScene> | undefined;
    try {
      gpu = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
      gpu.setPixelRatio(Math.min(devicePixelRatio, 1.6));
      gpu.shadowMap.enabled = true;
      gpu.shadowMap.type = THREE.PCFSoftShadowMap;
      gpu.outputColorSpace = THREE.SRGBColorSpace;
      gpu.toneMapping = THREE.ACESFilmicToneMapping;
      gpu.toneMappingExposure = 1.2;
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
    const surface = gpu?.domElement || root.querySelector('canvas')!;
    const controls = new OrbitControls(camera, surface);
    controls.enableDamping = true;
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
      height = 1;
    const fit = (angle: number) => {
      const extent = floorPose ? 1.25 : 0.83,
        d = Math.max(
          3.7,
          extent / (Math.tan(THREE.MathUtils.degToRad(17.5)) * Math.max(camera.aspect, 0.4)),
        );
      camera.position.set(Math.sin(angle) * d, controls.target.y + d * 0.2, Math.cos(angle) * d);
      controls.update();
    };
    const resize = () => {
      width = Math.max(root.clientWidth, 1);
      height = Math.max(root.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      gpu?.setSize(width, height, false);
      cpu?.setSize(width, height);
      fit(0.65);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();
    engine.current.camera = (name) => {
      fit(name === 'Side' ? Math.PI / 2 : name === 'Front' ? 0 : 0.65);
    };
    engine.current.zoom = (factor) => {
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
      offset.clampLength(controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    };
    scene.add(new THREE.HemisphereLight('#eaffef', '#223e31', 2.1));
    const key = new THREE.DirectionalLight('#fff3df', 3.3);
    key.position.set(-3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -3;
    key.shadow.normalBias = 0.025;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#c4e9cb', 2.3);
    rim.position.set(3, 3, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight('#b1cad2', 1);
    fill.position.set(4, 2, 3);
    scene.add(fill);
    const props = new THREE.Group();
    scene.add(props);
    const box = (position: number[], size: number[], color: string, rotation = 0) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(...(size as [number, number, number])),
        new THREE.MeshStandardMaterial({ color, roughness: 0.75 }),
      );
      m.position.set(...(position as [number, number, number]));
      m.rotation.x = rotation;
      m.castShadow = true;
      m.receiveShadow = true;
      props.add(m);
      return m;
    };
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: '#18372a', roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.045;
    floor.receiveShadow = true;
    floor.userData.skipSoftware = true;
    scene.add(floor);
    box([0, -0.03, 0], [1.5, 0.025, floorPose ? 2.8 : 1.5], '#29493b');
    const grid = new THREE.GridHelper(12, 24, '#355142', '#243d31');
    grid.position.y = -0.043;
    grid.userData.skipSoftware = true;
    scene.add(grid);
    const dumbbells = [new THREE.Group(), new THREE.Group()];
    dumbbells.forEach((group) => {
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.28, 10),
        new THREE.MeshStandardMaterial({ color: '#c2ccc7', metalness: 0.8, roughness: 0.25 }),
      );
      handle.rotation.z = Math.PI / 2;
      group.add(handle);
      for (const x of [-0.14, 0.14]) {
        const plate = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.09, 0.065, 6),
          new THREE.MeshStandardMaterial({ color: '#46594e', metalness: 0.45, roughness: 0.4 }),
        );
        plate.rotation.z = Math.PI / 2;
        plate.position.x = x;
        plate.castShadow = true;
        group.add(plate);
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
      '/models/trainer.glb',
      (gltf) => {
        if (disposed) {
          release(gltf.scene);
          return;
        }
        model = gltf.scene;
        bodyColors(model, exercise, false);
        scene.add(model);
        rig = createTrainerRig(model);
        rig.getEquipment(exercise).forEach((e) => {
          box(e.position, e.size, e.kind === 'bench' ? '#657c66' : '#3a5547', e.rotationX || 0);
          if (e.kind === 'bench') {
            for (const z of [-e.size[2] * 0.34, e.size[2] * 0.34]) {
              const y = Math.max(0.1, (e.position[1] - Math.tan(e.rotationX || 0) * z - 0.045) / 2);
              box([e.position[0], y, e.position[2] + z], [0.06, y * 2, 0.065], '#a8b5ac');
              box([e.position[0], 0.035, e.position[2] + z], [0.62, 0.055, 0.12], '#718478');
            }
          }
          if (e.kind === 'support')
            box(
              [e.position[0], e.position[1] / 2, e.position[2] + 0.24],
              [0.055, e.position[1], 0.055],
              '#718478',
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
      lastSide = '',
      dirty = true;
    controls.addEventListener('change', () => {
      dirty = true;
    });
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (
        !loaded ||
        !visible ||
        document.hidden ||
        now - lastRender < (cpu ? 75 : compact ? 40 : 25)
      )
        return;
      const elapsed = Math.min((now - lastRender) / 1000, 0.1);
      lastRender = now;
      const e = engine.current;
      if (
        !e.playing &&
        e.time === lastTime &&
        e.side === lastSide &&
        e.focus === paintedFocus &&
        !dirty
      )
        return;
      dirty = false;
      if (e.playing)
        e.time = (e.time + (elapsed * e.speed) / (exercise === 'bird' ? 7.8 : 5.6)) % 1;
      const cycle = e.time;
      let t = (1 - Math.cos(cycle * Math.PI * 2)) / 2;
      let ph = cycle < 0.5 ? 1 : 0;
      if (exercise === 'bird') {
        t =
          cycle < 0.31
            ? (1 - Math.cos((cycle / 0.31) * Math.PI)) / 2
            : cycle < 0.69
              ? 1
              : (1 + Math.cos(((cycle - 0.69) / 0.31) * Math.PI)) / 2;
        ph = cycle < 0.31 ? 1 : cycle < 0.69 ? 2 : 0;
      }
      rig!.update(exercise, t, e.side);
      rig!.getHandPositions().forEach((p, i) => dumbbells[i].position.copy(p));
      if (e.focus !== paintedFocus) {
        bodyColors(model!, exercise, e.focus);
        paintedFocus = e.focus;
      }
      controls.update();
      gpu?.render(scene, camera);
      cpu?.render(scene, camera);
      lastTime = e.time;
      lastSide = e.side;
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
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
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
