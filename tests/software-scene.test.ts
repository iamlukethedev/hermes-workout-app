import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createSoftwareScene } from '../src/lib/software-scene';

it('keeps foreground geometry visible regardless of scene insertion order', () => {
  let output = new Uint8ClampedArray();
  const ctx = {
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: (image: { data: Uint8ClampedArray }) => {
      output = image.data.slice();
    },
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const renderer = createSoftwareScene(canvas as unknown as HTMLCanvasElement);
  renderer.setSize(100, 100);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: '#ff0000' }),
  );
  front.position.z = 1;
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshStandardMaterial({ color: '#0000ff' }),
  );

  const scene = new THREE.Scene();
  scene.add(front, back);
  renderer.render(scene, camera);
  const first = output.slice();
  const middle = (Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2)) * 4;
  expect(first[middle]).toBeGreaterThan(100);
  expect(first[middle + 2]).toBe(0);

  scene.remove(front, back);
  scene.add(back, front);
  renderer.render(scene, camera);
  expect(output).toEqual(first);

  renderer.dispose();
  expect(canvas.width).toBe(1);
});
