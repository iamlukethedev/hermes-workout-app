import * as THREE from 'three';

/** Depth-buffered CPU fallback for the exact same posed skinned mesh as WebGL. */
export function createSoftwareScene(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  let width = 1,
    height = 1,
    pixels: ImageData,
    background: Uint8ClampedArray,
    depth: Float32Array;
  const light = new THREE.Vector3(-0.4, 0.8, 0.7).normalize(),
    p = new THREE.Vector3(),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    n = new THREE.Vector3();
  const linearToByte = (v: number) =>
    Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  return {
    setSize(w: number, h: number) {
      const scale = Math.min(1.35, 720 / w);
      width = Math.max(1, Math.round(w * scale));
      height = Math.max(1, Math.round(h * scale));
      canvas.width = width;
      canvas.height = height;
      const gradient = ctx.createRadialGradient(
        width * 0.5,
        height * 0.35,
        0,
        width * 0.5,
        height * 0.4,
        width * 0.7,
      );
      gradient.addColorStop(0, '#29483c');
      gradient.addColorStop(1, '#13251f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      pixels = ctx.getImageData(0, 0, width, height);
      background = pixels.data.slice();
      depth = new Float32Array(width * height);
    },
    render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
      if (!pixels) return;
      pixels.data.set(background);
      depth.fill(Infinity);
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || !obj.visible || obj.userData.skipSoftware) return;
        let parent = obj.parent;
        while (parent) {
          if (!parent.visible) return;
          parent = parent.parent;
        }
        if (obj instanceof THREE.SkinnedMesh) obj.skeleton.update();
        const g = obj.geometry,
          pos = g.getAttribute('position'),
          colors = g.getAttribute('color'),
          index = g.index;
        if (!pos) return;
        const mat = (
            Array.isArray(obj.material) ? obj.material[0] : obj.material
          ) as THREE.MeshStandardMaterial,
          base = mat.color || new THREE.Color('#87998d');
        const count = pos.count,
          world = new Float32Array(count * 3),
          screen = new Float32Array(count * 3),
          normals = new Float32Array(count * 3),
          rgb = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          obj.getVertexPosition(i, p);
          p.applyMatrix4(obj.matrixWorld);
          world.set([p.x, p.y, p.z], i * 3);
          p.project(camera);
          screen.set([((p.x + 1) * width) / 2, ((1 - p.y) * height) / 2, p.z], i * 3);
        }
        const triangles = index ? index.count : count;
        for (let i = 0; i < triangles; i += 3) {
          const ia = (index ? index.getX(i) : i) * 3,
            ib = (index ? index.getX(i + 1) : i + 1) * 3,
            ic = (index ? index.getX(i + 2) : i + 2) * 3;
          a.set(
            world[ib] - world[ia],
            world[ib + 1] - world[ia + 1],
            world[ib + 2] - world[ia + 2],
          );
          b.set(
            world[ic] - world[ia],
            world[ic + 1] - world[ia + 1],
            world[ic + 2] - world[ia + 2],
          );
          n.crossVectors(a, b);
          for (const j of [ia, ib, ic]) {
            normals[j] += n.x;
            normals[j + 1] += n.y;
            normals[j + 2] += n.z;
          }
        }
        for (let i = 0; i < count; i++) {
          const j = i * 3;
          n.set(normals[j], normals[j + 1], normals[j + 2]).normalize();
          const shade = 0.44 + 0.56 * Math.max(0, n.dot(light));
          rgb[j] = linearToByte((colors && mat.vertexColors ? colors.getX(i) : 1) * base.r * shade);
          rgb[j + 1] = linearToByte(
            (colors && mat.vertexColors ? colors.getY(i) : 1) * base.g * shade,
          );
          rgb[j + 2] = linearToByte(
            (colors && mat.vertexColors ? colors.getZ(i) : 1) * base.b * shade,
          );
        }
        for (let i = 0; i < triangles; i += 3) {
          const ia = (index ? index.getX(i) : i) * 3,
            ib = (index ? index.getX(i + 1) : i + 1) * 3,
            ic = (index ? index.getX(i + 2) : i + 2) * 3;
          const ax = screen[ia],
            ay = screen[ia + 1],
            az = screen[ia + 2],
            bx = screen[ib],
            by = screen[ib + 1],
            bz = screen[ib + 2],
            cx = screen[ic],
            cy = screen[ic + 1],
            cz = screen[ic + 2];
          if (az > 1 || bz > 1 || cz > 1 || az < -1 || bz < -1 || cz < -1) continue;
          const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
          if (Math.abs(denominator) < 0.001) continue;
          const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))),
            maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx))),
            minY = Math.max(0, Math.floor(Math.min(ay, by, cy))),
            maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
          const waX = (by - cy) / denominator,
            waY = (cx - bx) / denominator,
            wbX = (cy - ay) / denominator,
            wbY = (ax - cx) / denominator;
          for (let y = minY; y <= maxY; y++) {
            let wa = waX * (minX + 0.5 - cx) + waY * (y + 0.5 - cy),
              wb = wbX * (minX + 0.5 - cx) + wbY * (y + 0.5 - cy);
            for (let x = minX; x <= maxX; x++, wa += waX, wb += wbX) {
              const wc = 1 - wa - wb;
              if (wa < -0.00001 || wb < -0.00001 || wc < -0.00001) continue;
              const z = wa * az + wb * bz + wc * cz,
                k = y * width + x;
              if (z >= depth[k]) continue;
              depth[k] = z;
              const j = k * 4;
              pixels.data[j] = wa * rgb[ia] + wb * rgb[ib] + wc * rgb[ic];
              pixels.data[j + 1] = wa * rgb[ia + 1] + wb * rgb[ib + 1] + wc * rgb[ic + 1];
              pixels.data[j + 2] = wa * rgb[ia + 2] + wb * rgb[ib + 2] + wc * rgb[ic + 2];
            }
          }
        }
      });
      ctx.putImageData(pixels, 0, 0);
    },
    dispose() {
      canvas.width = 1;
      canvas.height = 1;
    },
  };
}
