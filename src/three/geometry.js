import * as THREE from 'three';
import { buildGeometry } from '../core/geometry.js';

// three.js BufferGeometry from the shared generators, cached per key.
const cache = new Map();
export function geometry(key) {
  let g = cache.get(key); if (g) return g;
  const src = buildGeometry(key), n = src.data.length / 8;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pos.set(src.data.subarray(i * 8, i * 8 + 3), i * 3); nor.set(src.data.subarray(i * 8 + 3, i * 8 + 6), i * 3); uv.set(src.data.subarray(i * 8 + 6, i * 8 + 8), i * 2);
  }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(src.idx, 1));
  cache.set(key, g); return g;
}
