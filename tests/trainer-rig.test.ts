import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { createTrainerRig, getTrainerEquipment } from '../src/lib/trainer-rig';

async function loadTrainer() {
  const data = readFileSync(new URL('../public/models/trainer.glb', import.meta.url));
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene;
}

const exercises = [
  'squat',
  'press',
  'row',
  'bridge',
  'heel',
  'calf',
  'split',
  'pushup',
  'bird',
  'curl',
  'march',
];
const wp = (model: THREE.Object3D, name: string) =>
  model.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
const near = (a: number, b: number, tolerance = 1e-5) =>
  expect(Math.abs(a - b), `${a} differs from ${b}`).toBeLessThan(tolerance);

describe('trainer rig', () => {
  it('retains every bone length and produces bounded, finite skinned geometry', async () => {
    const model = await loadTrainer();
    const rig = createTrainerRig(model);
    const links: [string, string, number][] = [];
    model.traverse((b) => {
      if ((b as THREE.Bone).isBone && (b.parent as THREE.Bone)?.isBone && b.name !== 'pelvis')
        links.push([
          b.name,
          b.parent!.name,
          wp(model, b.name).distanceTo(wp(model, b.parent!.name)),
        ]);
    });
    for (const exercise of exercises)
      for (const side of ['left', 'right'] as const)
        for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
          rig.update(exercise, progress, side);
          for (const [child, parent, length] of links)
            near(wp(model, child).distanceTo(wp(model, parent)), length);
          model.traverse((obj) => {
            const mesh = obj as THREE.SkinnedMesh;
            if (!mesh.isSkinnedMesh) return;
            mesh.skeleton.update();
            mesh.computeBoundingBox();
            const box = mesh.boundingBox!;
            for (const value of [...box.min.toArray(), ...box.max.toArray()])
              expect(Number.isFinite(value)).toBe(true);
            const size = box.getSize(new THREE.Vector3());
            expect(size.x < 2 && size.y < 2.2 && size.z < 2.6, `${exercise} mesh distorted`).toBe(
              true,
            );
            expect(box.min.y, `${exercise} sinks below the floor`).toBeGreaterThan(-0.05);
          });
        }
  });

  it('keeps bridge shoulders planted while the hips rise', async () => {
    const model = await loadTrainer();
    const rig = createTrainerRig(model);
    rig.update('bridge', 0);
    const left = wp(model, 'upperarm_l');
    const right = wp(model, 'upperarm_r');
    const hip = wp(model, 'pelvis').y;
    for (const t of [0.25, 0.5, 0.75, 1]) {
      rig.update('bridge', t);
      near(wp(model, 'upperarm_l').distanceTo(left), 0);
      near(wp(model, 'upperarm_r').distanceTo(right), 0);
      expect(wp(model, 'pelvis').y).toBeGreaterThan(hip);
    }
  });

  it('pivots the calf raise about stationary toe balls', async () => {
    const model = await loadTrainer();
    const rig = createTrainerRig(model);
    rig.update('calf', 0);
    const toe = wp(model, 'ball_l');
    const ankle = wp(model, 'foot_l').y;
    rig.update('calf', 1);
    near(wp(model, 'ball_l').distanceTo(toe), 0, 1e-4);
    expect(wp(model, 'foot_l').y).toBeGreaterThan(ankle + 0.05);
  });

  it('keeps the other leg and both hands fixed for bird dog and heel slide', async () => {
    const model = await loadTrainer();
    const rig = createTrainerRig(model);
    for (const exercise of ['bird', 'heel']) {
      rig.update(exercise, 0, 'right');
      const hand = wp(model, 'hand_l');
      const left = wp(model, 'foot_l');
      const right = wp(model, 'foot_r');
      rig.update(exercise, 1, 'right');
      near(wp(model, 'hand_l').distanceTo(hand), 0);
      near(wp(model, 'foot_l').distanceTo(left), 0);
      expect(wp(model, 'foot_r').distanceTo(right)).toBeGreaterThan(0.25);
      near(wp(model, 'foot_r').y, right.y);
    }
  });

  it('keeps wall push-up palms and feet fixed', async () => {
    const model = await loadTrainer();
    const rig = createTrainerRig(model);
    rig.update('pushup', 0);
    const hand = wp(model, 'hand_l');
    const foot = wp(model, 'foot_l');
    rig.update('pushup', 1);
    near(wp(model, 'hand_l').distanceTo(hand), 0, 0.003);
    near(wp(model, 'foot_l').distanceTo(foot), 0);
  });

  it('keeps limbs rigid and feet planted while breathing and swaying', async () => {
    const model = await loadTrainer();
    const rig = createTrainerRig(model);
    const links: [string, string, number][] = [];
    model.traverse((b) => {
      if ((b as THREE.Bone).isBone && (b.parent as THREE.Bone)?.isBone && b.name !== 'pelvis')
        links.push([
          b.name,
          b.parent!.name,
          wp(model, b.name).distanceTo(wp(model, b.parent!.name)),
        ]);
    });
    for (const exercise of exercises)
      for (const life of [
        { breath: 1, sway: 1 },
        { breath: -1, sway: -1 },
      ]) {
        rig.update(exercise, 0.5, 'right', life);
        for (const [child, parent, length] of links)
          near(wp(model, child).distanceTo(wp(model, parent)), length);
      }
    rig.update('squat', 0.5, 'right', { breath: 0, sway: 0 });
    const foot = wp(model, 'foot_l');
    rig.update('squat', 0.5, 'right', { breath: 1, sway: 1 });
    near(wp(model, 'foot_l').distanceTo(foot), 0, 1e-4);
    rig.update('pushup', 1, 'right', { breath: 0, sway: 0 });
    const hand = wp(model, 'hand_l');
    rig.update('pushup', 1, 'right', { breath: 1, sway: 1 });
    // Arms are fully extended at the top, so the chest lift can drag a palm a few millimetres.
    near(wp(model, 'hand_l').distanceTo(hand), 0, 0.008);
  });

  it('survives a transformed parent and restores the bind pose on dispose', async () => {
    const model = await loadTrainer();
    const parent = new THREE.Group();
    parent.add(model);
    parent.position.set(2, 0.5, -3);
    parent.rotation.y = 0.4;
    parent.scale.setScalar(1.3);
    parent.updateMatrixWorld(true);
    const before = model.getObjectByName('upperarm_l')!.quaternion.clone();
    const rig = createTrainerRig(model);
    for (const exercise of exercises) {
      rig.update(exercise, 0.7);
      for (const hand of rig.getHandPositions())
        expect(hand.toArray().every(Number.isFinite)).toBe(true);
    }
    rig.dispose();
    expect(model.getObjectByName('upperarm_l')!.quaternion.toArray()).toEqual(before.toArray());
    expect(getTrainerEquipment('press')[0].kind).toBe('bench');
    expect(getTrainerEquipment('pushup')[0].kind).toBe('wall');
  });
});
