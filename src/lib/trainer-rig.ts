import * as THREE from 'three';

/** Programme coordinates are metres, Y-up, with the trainer facing +Z. */
export type TrainerEquipment = {
  kind: 'bench' | 'support' | 'wall';
  position: [number, number, number];
  size: [number, number, number];
  rotationX?: number;
};
/** Idle motion layered on a pose: both in -1..1, zero leaves the pose untouched. */
export type TrainerLife = { breath: number; sway: number };
export type TrainerRig = {
  update(exercise: string, progress: number, side?: 'left' | 'right', life?: TrainerLife): void;
  /** Fresh world-space palm/grip centres, in left/right order, for attached weights. */
  getHandPositions(): [THREE.Vector3, THREE.Vector3];
  getEquipment(exercise: string): TrainerEquipment[];
  /** Restore bind transforms. Geometry/material disposal belongs to the renderer. */
  dispose(): void;
};

export function getTrainerEquipment(exercise: string): TrainerEquipment[] {
  if (exercise === 'press')
    return [{ kind: 'bench', position: [0, 0.55, -0.12], size: [0.42, 0.12, 1.3] }];
  if (exercise === 'row')
    return [
      { kind: 'bench', position: [0, 0.686, 0.02], size: [0.36, 0.1, 1.0], rotationX: -0.67 },
    ];
  if (exercise === 'squat')
    return [{ kind: 'bench', position: [0, 0.425, -0.26], size: [0.48, 0.1, 0.44] }];
  if (exercise === 'curl')
    return [{ kind: 'bench', position: [0, 0.42, 0], size: [0.48, 0.1, 0.44] }];
  if (exercise === 'pushup')
    return [{ kind: 'wall', position: [0, 1, 0.49], size: [1.3, 2, 0.06] }];
  if (exercise === 'calf')
    return [{ kind: 'support', position: [0, 1.18, 0.31], size: [0.85, 0.06, 0.06] }];
  if (exercise === 'split')
    return [{ kind: 'support', position: [0.55, 1.02, 0.12], size: [0.06, 0.06, 0.6] }];
  return [];
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const tuple = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const qx = (angle: number) => new THREE.Quaternion().setFromAxisAngle(X, angle);

/**
 * Pose adapter for Quaternius Superhero Male. All animation is skeletal rotation;
 * no limb scaling, mesh replacement, or animated bone-length changes are used.
 * Create after any initial asset normalisation. Parent/model transforms are allowed.
 * Two-bone IK clamps unreachable targets, preventing stretching at extension.
 */
export function createTrainerRig(model: THREE.Object3D): TrainerRig {
  model.updateWorldMatrix(true, true);
  const bones = new Map<string, THREE.Bone>();
  model.traverse((node) => {
    if ((node as THREE.Bone).isBone) bones.set(node.name, node as THREE.Bone);
  });
  const required = [
    'pelvis',
    'neck_01',
    'Head',
    'spine_01',
    'spine_02',
    'spine_03',
    ...['l', 'r'].flatMap((s) => [
      `thigh_${s}`,
      `calf_${s}`,
      `foot_${s}`,
      `ball_${s}`,
      `upperarm_${s}`,
      `lowerarm_${s}`,
      `hand_${s}`,
    ]),
  ];
  for (const name of required)
    if (!bones.has(name)) throw new Error(`Trainer skeleton is missing ${name}`);
  const bone = (name: string) => bones.get(name)!;
  const bind = new Map<
    string,
    {
      position: THREE.Vector3;
      quaternion: THREE.Quaternion;
      scale: THREE.Vector3;
      orientation: THREE.Quaternion;
    }
  >();
  const initialModelQ = model.getWorldQuaternion(new THREE.Quaternion());
  for (const [name, node] of bones)
    bind.set(name, {
      position: node.position.clone(),
      quaternion: node.quaternion.clone(),
      scale: node.scale.clone(),
      orientation: initialModelQ
        .clone()
        .invert()
        .multiply(node.getWorldQuaternion(new THREE.Quaternion())),
    });
  const world = (node: THREE.Object3D) => node.getWorldPosition(new THREE.Vector3());
  const localPosition = (node: THREE.Object3D) => model.worldToLocal(world(node));
  const bindPelvis = localPosition(bone('pelvis'));
  const bindShoulder = localPosition(bone('upperarm_l'))
    .add(localPosition(bone('upperarm_r')))
    .multiplyScalar(0.5);
  const shoulderOffset = bindShoulder.clone().sub(bindPelvis);
  const footToBall = localPosition(bone('ball_l')).sub(localPosition(bone('foot_l')));
  let modelQ = initialModelQ.clone();
  let disposed = false;

  const reset = () => {
    for (const [name, node] of bones) {
      const b = bind.get(name)!;
      node.position.copy(b.position);
      node.quaternion.copy(b.quaternion);
      node.scale.copy(b.scale);
    }
    model.updateWorldMatrix(true, true);
  };
  const toWorld = (point: THREE.Vector3) => model.localToWorld(point.clone());
  const setWorldQuaternion = (node: THREE.Object3D, desired: THREE.Quaternion) => {
    const parentQ =
      node.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    node.quaternion.copy(parentQ.invert().multiply(desired));
    node.updateWorldMatrix(false, true);
  };
  const setModelOrientation = (name: string, delta: THREE.Quaternion) =>
    setWorldQuaternion(
      bone(name),
      modelQ.clone().multiply(delta).multiply(bind.get(name)!.orientation),
    );
  const aim = (node: THREE.Bone, child: THREE.Bone, target: THREE.Vector3) => {
    const start = world(node),
      currentDirection = world(child).sub(start),
      desiredDirection = target.clone().sub(start);
    if (currentDirection.lengthSq() < 1e-12 || desiredDirection.lengthSq() < 1e-12) return;
    const swing = new THREE.Quaternion().setFromUnitVectors(
      currentDirection.normalize(),
      desiredDirection.normalize(),
    );
    setWorldQuaternion(node, swing.multiply(node.getWorldQuaternion(new THREE.Quaternion())));
  };
  const ik = (
    upperName: string,
    lowerName: string,
    endName: string,
    targetLocal: THREE.Vector3,
    poleLocal: THREE.Vector3,
  ) => {
    const upper = bone(upperName),
      lower = bone(lowerName),
      end = bone(endName);
    const start = world(upper),
      mid = world(lower),
      tip = world(end);
    const firstLength = start.distanceTo(mid),
      secondLength = mid.distanceTo(tip);
    const desired = toWorld(targetLocal),
      axis = desired.clone().sub(start);
    const requested = axis.length();
    if (requested < 1e-9) return;
    axis.multiplyScalar(1 / requested);
    const distance = THREE.MathUtils.clamp(
      requested,
      Math.abs(firstLength - secondLength) + 0.002,
      firstLength + secondLength - 0.002,
    );
    const along =
      (firstLength * firstLength - secondLength * secondLength + distance * distance) /
      (2 * distance);
    const height = Math.sqrt(Math.max(0, firstLength * firstLength - along * along));
    const bend = toWorld(poleLocal).sub(start);
    bend.addScaledVector(axis, -bend.dot(axis));
    if (bend.lengthSq() < 1e-10) {
      bend.copy(Y).applyQuaternion(modelQ);
      bend.addScaledVector(axis, -bend.dot(axis));
    }
    if (bend.lengthSq() < 1e-10) {
      bend.copy(X).applyQuaternion(modelQ);
      bend.addScaledVector(axis, -bend.dot(axis));
    }
    bend.normalize();
    const elbow = start.clone().addScaledVector(axis, along).addScaledVector(bend, height);
    aim(upper, lower, elbow);
    aim(lower, end, start.clone().addScaledVector(axis, distance));
  };
  const orientHand = (s: 'l' | 'r', forward: THREE.Vector3, palmNormal: THREE.Vector3) => {
    const sign = s === 'l' ? 1 : -1;
    const restForward = tuple(sign, 0, 0),
      restNormal = tuple(0, -1, 0);
    const f = forward.clone().normalize(),
      n = palmNormal.clone().addScaledVector(f, -palmNormal.dot(f)).normalize();
    const from = new THREE.Matrix4().makeBasis(
      restForward,
      restNormal,
      restForward.clone().cross(restNormal),
    );
    const to = new THREE.Matrix4().makeBasis(f, n, f.clone().cross(n));
    const delta = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.invert()));
    setModelOrientation(`hand_${s}`, delta);
  };
  const grip = (s: 'l' | 'r') => {
    for (const finger of ['index', 'middle', 'ring', 'pinky'])
      for (const [joint, radians] of [
        ['01', 0.75],
        ['02', 1.15],
        ['03', 0.85],
      ] as const) {
        const n = bones.get(`${finger}_${joint}_${s}`);
        if (n) n.quaternion.multiply(qx(radians));
      }
  };

  const swayable = ['squat', 'split', 'calf', 'march', 'curl'];
  const update = (
    exercise: string,
    progress: number,
    side: 'left' | 'right' = 'right',
    life: TrainerLife = { breath: 0, sway: 0 },
  ) => {
    if (disposed) return;
    const t = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1),
      active = side === 'left' ? 'l' : 'r';
    reset();
    modelQ = model.getWorldQuaternion(new THREE.Quaternion());
    let pelvis = tuple(0, 0.94, -0.043),
      pitch = 0;
    if (exercise === 'squat') {
      pelvis = tuple(0, 0.6 + 0.34 * t, -0.24 + 0.197 * t);
      pitch = 0.22 * (1 - t);
    }
    if (exercise === 'press') {
      pelvis = tuple(0, 0.72, 0.25);
      pitch = -Math.PI / 2;
    }
    if (exercise === 'row') {
      pelvis = tuple(0, 0.75, -0.25);
      pitch = 0.9;
    }
    if (exercise === 'curl') pelvis = tuple(0, 0.55, 0);
    if (exercise === 'split') {
      pelvis = tuple(0, 0.6 + 0.18 * t, -0.02);
      pitch = 0.06;
    }
    if (exercise === 'pushup') {
      pelvis = tuple(0, 0.91, -0.1 * t);
      pitch = 0.38 - 0.26 * t;
    }
    if (exercise === 'heel') {
      pelvis = tuple(0, 0.17, 0);
      pitch = -Math.PI / 2;
    }
    if (exercise === 'bird') {
      pelvis = tuple(0, 0.48, -0.22);
      pitch = Math.PI / 2;
    }
    if (exercise === 'bridge') {
      const anchorY = 0.17,
        anchorZ = -0.42,
        hipY = 0.2 + 0.28 * t;
      const length = Math.hypot(shoulderOffset.y, shoulderOffset.z),
        dy = anchorY - hipY,
        dz = -Math.sqrt(Math.max(0.01, length * length - dy * dy));
      pitch = Math.atan2(dz, dy) - Math.atan2(shoulderOffset.z, shoulderOffset.y);
      pelvis = tuple(0, hipY, anchorZ - dz);
    }
    const calfPitch = 0.62 * t;
    const calfOffset = footToBall.clone().applyQuaternion(qx(calfPitch));
    const calfAnkle = tuple(0.114, 0.015, 0.055).sub(calfOffset);
    if (exercise === 'calf') pelvis.add(tuple(0, calfAnkle.y - 0.086, calfAnkle.z + 0.088));
    // A few millimetres of weight shift on standing poses; feet stay planted by IK below.
    if (swayable.includes(exercise)) pelvis.x += 0.007 * life.sway;
    const pelvisBone = bone('pelvis');
    pelvisBone.position.copy(pelvisBone.parent!.worldToLocal(toWorld(pelvis)));
    setModelOrientation('pelvis', qx(pitch));
    // Breathing lifts the chest slightly. Applied before limb IK so reach targets stay exact.
    if (life.breath !== 0) {
      bone('spine_02').quaternion.multiply(qx(-0.014 * life.breath));
      bone('spine_03').quaternion.multiply(qx(-0.02 * life.breath));
      bone('spine_02').updateWorldMatrix(false, true);
    }
    // Keep the head comfortable on the floor when the pelvis rises into a bridge.
    if (exercise === 'bridge') {
      setModelOrientation('neck_01', qx(-Math.PI / 2));
      setModelOrientation('Head', qx(-Math.PI / 2));
    }

    for (const s of ['l', 'r'] as const) {
      const sign = s === 'l' ? 1 : -1;
      let ankle = tuple(sign * 0.14, 0.086, -0.088),
        kneePole = tuple(sign * 0.17, 0.5, 0.65),
        footRotation = new THREE.Quaternion();
      if (exercise === 'squat') ankle.x = sign * 0.16;
      if (exercise === 'press') {
        ankle = tuple(sign * 0.27, 0.086, 0.55);
        kneePole = tuple(sign * 0.32, 0.65, 0.8);
      }
      if (exercise === 'row') {
        ankle = tuple(sign * 0.24, 0.086, -0.63);
        kneePole = tuple(sign * 0.29, 0.48, -0.2);
      }
      if (exercise === 'curl') {
        ankle = tuple(sign * 0.18, 0.086, 0.42);
        kneePole = tuple(sign * 0.2, 0.56, 0.58);
      }
      if (exercise === 'split') {
        const front = s === active;
        ankle = tuple(sign * 0.14, front ? 0.086 : 0.13, front ? 0.3 : -0.45);
        kneePole = tuple(sign * 0.15, 0.45, front ? 0.6 : 0.1);
        if (!front) footRotation = qx(0.32);
      }
      if (exercise === 'pushup') ankle = tuple(sign * 0.15, 0.086, -0.24);
      if (exercise === 'bridge') {
        ankle = tuple(sign * 0.15, 0.086, 0.65);
        kneePole = tuple(sign * 0.17, 0.8, 0.4);
      }
      if (exercise === 'heel') {
        ankle = tuple(sign * 0.15, 0.086, 0.53 + (s === active ? 0.32 * t : 0));
        kneePole = tuple(sign * 0.16, 0.65, 0.4);
      }
      if (exercise === 'bird') {
        ankle = tuple(sign * 0.15, 0.086, -0.63 - (s === active ? 0.32 * t : 0));
        kneePole = tuple(sign * 0.15, -0.25, -0.2);
        footRotation.setFromAxisAngle(Y, Math.PI);
      }
      if (exercise === 'calf') {
        ankle = calfAnkle.clone();
        ankle.x = sign * 0.114;
        footRotation = qx(calfPitch);
      }
      if (exercise === 'march' && s === active) {
        ankle.y += 0.17 * t;
        ankle.z += 0.12 * t;
        kneePole.z = 0.65;
      }
      ik(`thigh_${s}`, `calf_${s}`, `foot_${s}`, ankle, kneePole);
      setModelOrientation(`foot_${s}`, footRotation);
      if (exercise === 'calf') setModelOrientation(`ball_${s}`, new THREE.Quaternion());

      const shoulder = localPosition(bone(`upperarm_${s}`));
      let wrist = shoulder.clone().add(tuple(sign * 0.055, -0.47, 0.055));
      let elbowPole = shoulder.clone().add(tuple(sign * 0.3, -0.2, 0.25));
      if (exercise === 'squat') {
        wrist = shoulder.clone().add(tuple(-sign * 0.08, -0.04, 0.43));
        elbowPole = shoulder.clone().add(tuple(sign * 0.3, -0.2, 0.25));
      }
      if (exercise === 'press') {
        wrist = tuple(sign * (0.38 - 0.16 * t), shoulder.y + 0.15 + 0.31 * t, shoulder.z + 0.035);
        elbowPole = shoulder.clone().add(tuple(sign * 0.55, -0.14, 0.22));
      }
      if (exercise === 'row') {
        wrist = shoulder.clone().add(tuple(sign * 0.035, -0.48 + 0.2 * t, -0.18 * t));
        elbowPole = shoulder.clone().add(tuple(sign * 0.35, 0.1, -0.4));
      }
      if (exercise === 'calf') {
        wrist = tuple(sign * 0.23, 1.18, 0.27);
        elbowPole = tuple(sign * 0.42, 1.0, 0.2);
      }
      if (exercise === 'split' && s === 'l') {
        wrist = tuple(0.52, 1.02, 0.12);
        elbowPole = tuple(0.45, 1.03, 0.02);
      }
      if (exercise === 'pushup') {
        wrist = tuple(sign * 0.25, 1.3, 0.415);
        elbowPole = tuple(sign * 0.55, 1.1, 0.27);
      }
      if (exercise === 'bridge' || exercise === 'heel') {
        wrist = shoulder.clone().add(tuple(sign * 0.08, 0.065 - shoulder.y, 0.43));
        elbowPole = shoulder.clone().add(tuple(sign * 0.22, -0.08, 0.2));
      }
      if (exercise === 'bird') {
        wrist = tuple(sign * 0.23, 0.065, 0.34);
        elbowPole = tuple(sign * 0.31, 0.28, 0.22);
      }
      if (exercise === 'march') {
        const swing = s === active ? -1 : 1;
        wrist = shoulder.clone().add(tuple(sign * 0.06, -0.45, swing * 0.14 * t));
      }
      if (exercise === 'curl') {
        // Fixed upper arms and a circular forearm path give an actual elbow curl.
        const upper = bone(`upperarm_${s}`),
          lower = bone(`lowerarm_${s}`),
          hand = bone(`hand_${s}`);
        const upperLength = localPosition(upper).distanceTo(localPosition(lower)),
          lowerLength = localPosition(lower).distanceTo(localPosition(hand));
        const elbow = shoulder.clone().add(
          tuple(sign * 0.04, -0.245, 0.02)
            .normalize()
            .multiplyScalar(upperLength),
        );
        aim(upper, lower, toWorld(elbow));
        const angle = -Math.PI / 2 + t * 2.45;
        wrist = elbow
          .clone()
          .add(tuple(0, Math.sin(angle) * lowerLength, Math.cos(angle) * lowerLength));
        aim(lower, hand, toWorld(wrist));
      } else ik(`upperarm_${s}`, `lowerarm_${s}`, `hand_${s}`, wrist, elbowPole);

      if (exercise === 'bird') orientHand(s, Z, tuple(0, -1, 0));
      else if (exercise === 'pushup') orientHand(s, Y, Z);
      else if (exercise === 'bridge' || exercise === 'heel') orientHand(s, Z, tuple(0, -1, 0));
      else if (exercise === 'press') {
        orientHand(s, Y, tuple(0, 0, -1));
        grip(s);
      } else if (exercise === 'row') {
        orientHand(s, tuple(0, -1, 0), tuple(-sign, 0, 0));
        grip(s);
      } else if (exercise === 'curl') {
        const forearm = localPosition(bone(`hand_${s}`))
          .sub(localPosition(bone(`lowerarm_${s}`)))
          .normalize();
        orientHand(s, forearm, tuple(0, 0, 1));
        grip(s);
      } else if (exercise === 'calf' || (exercise === 'split' && s === 'l')) {
        orientHand(s, Z, tuple(0, -1, 0));
        grip(s);
      }
    }
    model.updateWorldMatrix(true, true);
  };
  return {
    update,
    getHandPositions: () =>
      ['l', 'r'].map((s) => world(bone(`hand_${s}`)).lerp(world(bone(`middle_01_${s}`)), 0.55)) as [
        THREE.Vector3,
        THREE.Vector3,
      ],
    getEquipment: getTrainerEquipment,
    dispose: () => {
      if (!disposed) {
        reset();
        disposed = true;
      }
    },
  };
}
