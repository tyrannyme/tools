import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export interface Model {
  object: THREE.Object3D;
  name: string;
  animations: THREE.AnimationClip[];
}
export const modelAccept = ".gltf,.glb,.obj,.stl,.ply,.fbx,.bin,.mtl,.png,.jpg,.jpeg,.webp";
export function disposeModel(object: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  object.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.Points) {
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material])
        materials.add(material);
    }
  });
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture) textures.add(value);
    });
    material.dispose();
  });
  textures.forEach((texture) => {
    texture.dispose();
  });
}
export function modelStats(object: THREE.Object3D) {
  let vertices = 0,
    triangles = 0;
  const materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  object.updateMatrixWorld(true);
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    vertices += node.geometry.getAttribute("position")?.count ?? 0;
    triangles +=
      (node.geometry.index?.count ?? node.geometry.getAttribute("position")?.count ?? 0) / 3;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    }
  });
  return {
    vertices,
    triangles: Math.floor(triangles),
    materials: materials.size,
    textures: textures.size,
    size: new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()),
  };
}
export function sampleModel(): Model {
  const object = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({
    color: 0xd9d3c9,
    roughness: 0.25,
    metalness: 0.15,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0xb19a70,
    roughness: 0.2,
    metalness: 0.85,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x343637, roughness: 0.4, metalness: 0.5 });
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.78, 0.24, 180, 28), ceramic);
  knot.position.y = 1.5;
  object.add(knot);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.045, 16, 100), metal);
  ring.position.y = 1.5;
  ring.rotation.x = Math.PI / 3;
  object.add(ring);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.22, 80), dark);
  base.position.y = 0.11;
  object.add(base);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 0.06, 80), metal);
  foot.position.y = 0.25;
  object.add(foot);
  object.name = "Orbit sculpture";
  return { object, name: "orbit-sculpture.glb", animations: [] };
}
/** glTF files declare Draco compression in their JSON. GLB keeps that JSON in its first chunk. */
function usesDraco(buffer: ArrayBuffer, extension: string) {
  let bytes = new Uint8Array(buffer);
  if (extension === "glb" && buffer.byteLength >= 20)
    bytes = new Uint8Array(
      buffer,
      20,
      Math.min(new DataView(buffer).getUint32(12, true), buffer.byteLength - 20),
    );
  return new TextDecoder().decode(bytes).includes("KHR_draco_mesh_compression");
}

/** Loads the Draco decoder from this site's own bundle, only when a model needs it. */
async function dracoLoader() {
  const [{ DRACOLoader }, wrapper, wasm] = await Promise.all([
    import("three/examples/jsm/loaders/DRACOLoader.js"),
    import("three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url"),
    import("three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url"),
  ]);
  const files: Record<string, string> = {
    "draco_wasm_wrapper.js": wrapper.default,
    "draco_decoder.wasm": wasm.default,
  };
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => files[url] ?? url);
  return new DRACOLoader(manager);
}

export async function loadModel(files: File[]): Promise<Model> {
  const primary = files.find((file) => /\.(gltf|glb|obj|stl|ply|fbx)$/i.test(file.name));
  if (!primary) throw new Error("Choose a GLB, glTF, OBJ, STL, PLY, or FBX file.");
  if (files.reduce((sum, file) => sum + file.size, 0) > 250 * 1024 * 1024)
    throw new Error("Choose files totaling less than 250 MB.");
  const urls: string[] = [],
    fileUrls = new Map<string, string>();
  for (const file of files) {
    const url = URL.createObjectURL(file);
    urls.push(url);
    fileUrls.set(file.name, url);
    if (file.webkitRelativePath) fileUrls.set(file.webkitRelativePath, url);
  }
  const missing = new Set<string>();
  const manager = new THREE.LoadingManager();
  let pending = 0;
  let finished: (() => void) | undefined;
  const start = manager.itemStart.bind(manager),
    end = manager.itemEnd.bind(manager);
  manager.itemStart = (url) => {
    pending++;
    start(url);
  };
  manager.itemEnd = (url) => {
    end(url);
    pending--;
    if (pending === 0) finished?.();
  };
  let assetFailed = false;
  manager.onError = () => {
    assetFailed = true;
  };
  manager.setURLModifier((url) => {
    if (url.startsWith("data:") || urls.includes(url) || url.startsWith("blob:")) return url;
    const path = decodeURIComponent(url.split("?")[0]!).replace(/^\.\//, "");
    const local = fileUrls.get(path) ?? fileUrls.get(path.split("/").pop()!);
    if (local) return local;
    missing.add(path);
    // No network requests for references in user files.
    return "data:application/octet-stream;base64,";
  });
  const missingError = () =>
    new Error(
      `Missing ${[...missing].join(", ")}. Drop the model together with the files it references.`,
    );
  let object: THREE.Object3D;
  let animations: THREE.AnimationClip[] = [];
  try {
    const buffer = await primary.arrayBuffer();
    const extension = primary.name.split(".").pop()!.toLowerCase();
    if (extension === "gltf" || extension === "glb") {
      const loader = new GLTFLoader(manager);
      const draco = usesDraco(buffer, extension) ? await dracoLoader() : undefined;
      if (draco) loader.setDRACOLoader(draco);
      try {
        const gltf = await loader.parseAsync(buffer, "");
        object = gltf.scene;
        animations = gltf.animations;
      } finally {
        draco?.dispose();
      }
    } else if (extension === "obj") {
      const loader = new OBJLoader(manager);
      const mtl = files.find((file) => /\.mtl$/i.test(file.name));
      if (mtl) loader.setMaterials(new MTLLoader(manager).parse(await mtl.text(), ""));
      object = loader.parse(new TextDecoder().decode(buffer));
    } else if (extension === "fbx") {
      object = new FBXLoader(manager).parse(buffer, "");
      animations = object.animations;
    } else {
      const geometry =
        extension === "stl"
          ? new STLLoader(manager).parse(buffer)
          : new PLYLoader(manager).parse(buffer);
      geometry.computeVertexNormals();
      object = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0xd4d4d4,
          roughness: 0.55,
          vertexColors: !!geometry.getAttribute("color"),
        }),
      );
    }
    // Texture loaders may finish after OBJ and FBX parsing.
    if (pending > 0)
      await new Promise<void>((resolve) => {
        finished = resolve;
      });
  } catch (error) {
    if (missing.size) throw missingError();
    // Parser internals such as JSON syntax errors mean nothing to most people.
    const reason =
      error instanceof Error && !(error instanceof SyntaxError) && !(error instanceof RangeError)
        ? error.message.replace(/^THREE\.\w+: /, "")
        : "";
    throw new Error(
      `Unable to read ${primary.name}${reason ? `: ${reason}` : ""}. Check that the file is complete and not corrupted.`,
    );
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
  if (missing.size || assetFailed || !modelStats(object).vertices) {
    disposeModel(object);
    if (missing.size) throw missingError();
    if (assetFailed) throw new Error("A texture or buffer in this model could not be decoded.");
    throw new Error(`${primary.name} has no mesh geometry to show.`);
  }
  return { object, animations, name: primary.name };
}
