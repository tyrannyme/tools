// Shared three.js pieces for the 3D tool artwork: a transparent studio renderer lit like the
// dusk sky, veined marble, the sample sculpture from src/tools/3d/_shared/models.ts in marble,
// gold, and ink, and the sample stone texture with the normal map pass from texture-processing.ts.
import * as THREE from "three";

export { THREE };

/** A transparent renderer drawn at `scale` times the CSS size, with studio light and dusk rims. */
export function studio(canvas, { width = 1280, height = 800, scale = 2, fov = 32 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(scale);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = duskRoom();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  // Warm key from the glowing horizon, a violet fill from the sky, a rose rim from behind.
  scene.add(new THREE.HemisphereLight(0xb7a2e8, 0x2a1c3c, 0.9));
  const key = new THREE.DirectionalLight(0xffe0b0, 3.6);
  key.position.set(-2.2, 7, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0008;
  key.shadow.radius = 6;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffa8c0, 2.4);
  rim.position.set(4, 2.5, -4);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.05, 100);
  return { renderer, scene, camera, key, rim };
}

/** Reflections of the site's dusk: violet above, apricot at the horizon, warm softboxes. */
function duskRoom() {
  const room = new THREE.Scene();
  const sky = new THREE.SphereGeometry(20, 64, 32);
  const colors = [];
  const top = new THREE.Color(0xdcc8f2),
    horizon = new THREE.Color(0xffe2c4),
    rose = new THREE.Color(0xffd2b8),
    below = new THREE.Color(0xe0b49c);
  const position = sky.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) / 20;
    const color =
      y > 0
        ? rose
            .clone()
            .lerp(top, Math.min(1, y * 1.6))
            .lerp(horizon, Math.max(0, 0.25 - y) * 3)
        : horizon.clone().lerp(below, Math.min(1, -y * 3));
    colors.push(color.r, color.g, color.b);
  }
  sky.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  room.add(
    new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })),
  );
  const softbox = (color, strength, x, y, z, w, h) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength) }),
    );
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    room.add(panel);
  };
  softbox(0xffe4b8, 7, -6, 9, 6, 10, 6);
  softbox(0xfff1dc, 4, 8, 4, 8, 6, 8);
  softbox(0xffa2c0, 4, 7, 5, -8, 8, 8);
  softbox(0xffd29a, 3, 0, -6, 9, 14, 4);
  return room;
}

/**
 * Veined marble that tiles in both directions: white or `ink` (near black), with grey or `gold`
 * veins. The canvas carries a `metal` canvas marking the gold.
 */
export function marbleCanvas(
  size = 512,
  { ink = false, gold = ink, bands = 2, warp = 3.2, seed = 3, wave = 0, fine = 0.35 } = {},
) {
  const canvas = document.createElement("canvas");
  const metal = document.createElement("canvas");
  canvas.width = canvas.height = metal.width = metal.height = size;
  const image = new ImageData(size, size);
  const metalImage = new ImageData(size, size);
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  // Periodic value noise from a small lattice, so the texture wraps.
  const noise = (cells) => {
    const grid = Array.from({ length: cells * cells }, random);
    return (x, y) => {
      const gx = (x / size) * cells,
        gy = (y / size) * cells;
      const x0 = Math.floor(gx),
        y0 = Math.floor(gy),
        fx = gx - x0,
        fy = gy - y0;
      const at = (i, j) => grid[((j + cells) % cells) * cells + ((i + cells) % cells)];
      const sx = fx * fx * (3 - 2 * fx),
        sy = fy * fy * (3 - 2 * fy);
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return top + (bottom - top) * sy;
    };
  };
  const octaves = [2, 4, 8, 16, 32].map((cells) => noise(cells));
  const secondary = noise(5);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let turbulence = 0;
      octaves.forEach((octave, index) => (turbulence += octave(x, y) / 2.6 ** index));
      const phase = wave
        ? (y / size) * Math.PI * bands + wave * Math.sin((x / size) * Math.PI * 2)
        : ((x + y) / size) * Math.PI * bands;
      const vein = Math.pow(1 - Math.abs(Math.sin(phase + turbulence * warp)), 26);
      const thin = Math.pow(1 - Math.abs(Math.sin(phase * 2 + secondary(x, y) * 7)), 90) * fine;
      const cloud = octaves[1](x, y) * 0.5 + octaves[3](x, y) * 0.5;
      const i = (y * size + x) * 4;
      const soft = Math.pow(1 - Math.abs(Math.sin(phase + turbulence * warp)), 4);
      const base = ink
        ? [23 + cloud * 30, 19 + cloud * 24, 37 + cloud * 40]
        : [246 - cloud * 22, 240 - cloud * 24, 232 - cloud * 20];
      let amount, color;
      if (gold) {
        amount = Math.min(1, vein * 1.4 + thin + (ink ? 0 : soft * 0.12));
        color = [230, 192, 114];
        metalImage.data[i] =
          metalImage.data[i + 1] =
          metalImage.data[i + 2] =
            Math.min(1, vein * 1.4 + thin) * 255;
      } else {
        amount = Math.min(1, vein * 0.6 + soft * 0.08 + thin * 0.4);
        color = [96, 90, 97];
      }
      for (let c = 0; c < 3; c++) image.data[i + c] = base[c] + amount * (color[c] - base[c]);
      image.data[i + 3] = metalImage.data[i + 3] = 255;
    }
  canvas.getContext("2d").putImageData(image, 0, 0);
  metal.getContext("2d").putImageData(metalImage, 0, 0);
  canvas.metal = metal;
  return canvas;
}

export const materials = () => ({
  marble: new THREE.MeshPhysicalMaterial({
    color: 0xe9e1d6,
    map: canvasTexture(marbleCanvas(), { repeatX: 6, repeat: 1 }),
    roughness: 0.3,
    metalness: 0.02,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
  }),
  gold: new THREE.MeshStandardMaterial({
    color: 0xf5d27e,
    roughness: 0.22,
    metalness: 1,
    envMapIntensity: 1.6,
  }),
  ink: new THREE.MeshStandardMaterial({ color: 0x241c3a, roughness: 0.32, metalness: 0.55 }),
});

/** The tool's sample model: a torus knot in a tilted ring over a round base, 2.9 units tall. */
export function sculpture(mats = materials(), detail = 1) {
  const group = new THREE.Group();
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.78, 0.24, Math.round(180 * detail), Math.round(28 * detail)),
    mats.marble,
  );
  knot.position.y = 1.5;
  knot.name = "knot";
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.38, 0.045, Math.round(16 * detail), Math.round(100 * detail)),
    mats.gold,
  );
  ring.position.y = 1.5;
  ring.rotation.x = Math.PI / 3;
  ring.name = "ring";
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.2, 0.22, Math.round(80 * detail)),
    mats.ink,
  );
  base.position.y = 0.11;
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.95, 0.06, Math.round(80 * detail)),
    mats.gold,
  );
  foot.position.y = 0.25;
  group.add(knot, ring, base, foot);
  group.traverse((node) => {
    if (node.isMesh) node.castShadow = node.receiveShadow = true;
  });
  return group;
}

/** Waits for a promise before export: `whenReady(render())`. */
export function whenReady(promise) {
  window.automedia?.registerRenderer(() => promise);
  return promise;
}

/** The tool's sample texture: a stone wall under uneven light. */
export function stoneTexture({ size = 1024 } = {}) {
  const rowHeight = size / 8,
    brickWidth = size / 4,
    mortar = (6 * size) / 1024;
  let seed = 7;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shades = Array.from({ length: 64 }, () => 0.5 + random() * 0.3);
  const data = new ImageData(size, size);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / rowHeight),
      inRow = y % rowHeight;
    for (let x = 0; x < size; x++) {
      const shifted = x + (row % 2 ? brickWidth / 2 : 0),
        column = Math.floor(shifted / brickWidth) % 4,
        inBrick = shifted % brickWidth;
      const edge = Math.min(inRow, rowHeight - 1 - inRow, inBrick, brickWidth - 1 - inBrick);
      const grain = random() * 0.16 - 0.08;
      const bevel = Math.min(1, Math.max(0, (edge - mortar) / ((5 * size) / 1024)));
      const shade = (0.22 + bevel * (shades[row * 8 + column] - 0.22) + grain) * 255;
      const light = 1.1 - (x + y) / size / 4;
      const i = (y * size + x) * 4;
      data.data[i] = Math.min(255, shade * light * 1.05);
      data.data[i + 1] = Math.min(255, shade * light * 0.93);
      data.data[i + 2] = Math.min(255, shade * light * 0.82);
      data.data[i + 3] = 255;
    }
  }
  return data;
}

/** The tool's Sobel normal map, wrapping at the edges. */
export function normalMap(source, strength = 2, blur = 1) {
  const { width: w, height: h, data } = source;
  let heights = new Float32Array(w * h);
  for (let i = 0; i < heights.length; i++)
    heights[i] = (data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722) / 255;
  for (let pass = 0; pass < blur; pass++) {
    const next = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            sum += heights[((y + dy + h) % h) * w + ((x + dx + w) % w)];
        next[y * w + x] = sum / 9;
      }
    heights = next;
  }
  const output = new ImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const at = (dx, dy) => heights[((y + dy + h) % h) * w + ((x + dx + w) % w)];
      const dx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
      const dy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
      const nx = -dx * strength,
        ny = dy * strength,
        scale = 127.5 / Math.sqrt(nx * nx + ny * ny + 1),
        i = (y * w + x) * 4;
      output.data[i] = nx * scale + 127.5;
      output.data[i + 1] = ny * scale + 127.5;
      output.data[i + 2] = scale + 127.5;
      output.data[i + 3] = 255;
    }
  return output;
}

export function toCanvas(data) {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext("2d").putImageData(data, 0, 0);
  return canvas;
}

export function canvasTexture(canvas, { color = true, repeat = 1, repeatX = repeat } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeat);
  texture.anisotropy = 8;
  return texture;
}
