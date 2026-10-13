import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { cn } from "cn";
import { recordTurntable, type RecordOptions } from "./recording";

export interface StudioHandle {
  screenshot: () => Promise<Blob>;
  record: (resolution: number, options: RecordOptions) => Promise<Blob>;
}

interface Scene {
  setObject: (object: THREE.Object3D) => void;
  screenshot: () => Promise<Blob>;
  record: StudioHandle["record"];
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pixelRatio = () => Math.min(window.devicePixelRatio, 2);

/**
 * A lit WebGL stage for one object. The renderer lives as long as the component, renders only
 * while on screen, and releases its WebGL context on unmount.
 */
export function Studio({
  object,
  handle,
  wireframe = false,
  rotate = false,
  background,
  movingLight = false,
  className,
}: {
  object: THREE.Object3D;
  handle?: RefObject<StudioHandle | null>;
  wireframe?: boolean;
  rotate?: boolean;
  background?: string;
  movingLight?: boolean;
  /** Sizes the stage. Defaults to a 4:3 box. */
  className?: string;
}) {
  const scene = useRef<Scene | null>(null);
  useImperativeHandle(
    handle,
    () => ({
      screenshot: async () => {
        if (!scene.current) throw new Error("The 3D preview is not available.");
        return scene.current.screenshot();
      },
      record: async (...args) => {
        if (!scene.current) throw new Error("The 3D preview is not available.");
        return scene.current.record(...args);
      },
    }),
    [],
  );
  const host = useRef<HTMLDivElement>(null);
  const options = useRef({ wireframe, rotate, background, movingLight });
  const latest = useRef(object);
  const [error, setError] = useState("");
  useEffect(() => {
    options.current = { wireframe, rotate, background, movingLight };
  }, [wireframe, rotate, background, movingLight]);

  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      // WebGL availability is an external browser resource.
      // oxlint-disable-next-line react/set-state-in-effect
      setError("The 3D preview needs WebGL. Turn on hardware acceleration or try another browser.");
      return;
    }
    renderer.setPixelRatio(pixelRatio());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const canvas = renderer.domElement;
    canvas.className = "absolute inset-0 block size-full touch-none outline-none";
    canvas.setAttribute("aria-label", "3D preview. Drag to orbit, scroll or pinch to zoom.");
    container.appendChild(canvas);

    const world = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    const pmrem = new THREE.PMREMGenerator(renderer),
      room = new RoomEnvironment();
    const environment = pmrem.fromScene(room);
    world.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    world.add(new THREE.HemisphereLight(0xffffff, 0x606060, 1.3));
    const light = new THREE.DirectionalLight(0xffffff, 3.5);
    light.position.set(3, 5, 4);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.001;
    world.add(light);
    const pivot = new THREE.Group();
    world.add(pivot);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.18 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    world.add(floor);

    let preview: THREE.Object3D | undefined;
    let materials: THREE.Material[] = [];
    let framedSize: THREE.Vector3 | undefined;
    let recording = false,
      visible = true,
      recordAbort: (() => void) | undefined;
    let previous = performance.now();

    const frame = () => {
      camera.position.set(4, 2.6, 4.8).multiplyScalar(Math.max(1, 1 / camera.aspect));
      controls.target.set(0, 0, 0);
      controls.update();
    };
    const fit = () => {
      const width = container.clientWidth,
        height = container.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(pixelRatio());
      renderer.setSize(width, height, false);
      const aspect = width / height;
      // Keep the same framing when the stage changes shape.
      camera.position.multiplyScalar(Math.max(1, 1 / aspect) / Math.max(1, 1 / camera.aspect));
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      controls.update();
    };
    const draw = (time: number) => {
      const dt = Math.min((time - previous) / 1000, 0.1);
      previous = time;
      const current = options.current;
      if (!recording) {
        controls.update();
        if (current.rotate && !reducedMotion()) pivot.rotation.y += dt * 0.35;
      }
      if (current.movingLight && !reducedMotion())
        light.position.set(Math.sin(time / 1600) * 4, 3, Math.cos(time / 1600) * 4);
      for (const material of materials)
        if ("wireframe" in material) material.wireframe = current.wireframe;
      renderer.setClearColor(current.background || 0x000000, current.background ? 1 : 0);
      renderer.render(world, camera);
    };
    const loop = () => {
      // Off screen or recording: the browser does no per-frame work for this stage.
      renderer.setAnimationLoop(visible && !recording ? draw : null);
      previous = performance.now();
    };

    const resize = new ResizeObserver(() => {
      if (!recording) fit();
    });
    resize.observe(container);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      loop();
    });
    intersection.observe(container);
    // Moving the window to a screen with another pixel density keeps the CSS size the same.
    let density: MediaQueryList | undefined;
    const watchDensity = () => {
      density?.removeEventListener("change", onDensity);
      density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      density.addEventListener("change", onDensity);
    };
    const onDensity = () => {
      if (!recording) fit();
      watchDensity();
    };
    watchDensity();
    camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
    frame();
    fit();
    loop();

    scene.current = {
      setObject(object) {
        if (preview) pivot.remove(preview);
        materials.forEach((material) => material.dispose());
        materials = [];
        preview = clone(object);
        preview.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          node.castShadow = true;
          node.receiveShadow = true;
          const copy = (material: THREE.Material) => {
            const result = material.clone();
            materials.push(result);
            return result;
          };
          node.material = Array.isArray(node.material)
            ? node.material.map(copy)
            : copy(node.material);
        });
        const box = new THREE.Box3().setFromObject(preview),
          size = box.getSize(new THREE.Vector3()),
          center = box.getCenter(new THREE.Vector3());
        const scale = 2.6 / Math.max(size.x, size.y, size.z, 0.0001);
        preview.position.sub(center).multiplyScalar(scale);
        preview.scale.multiplyScalar(scale);
        pivot.add(preview);
        floor.position.y = (-size.y * scale) / 2 - 0.015;
        // A new model gets a fresh view. Edits to the same shape keep where you orbited to.
        const normalized = size.clone().multiplyScalar(scale);
        if (!framedSize || framedSize.distanceTo(normalized) > 0.01) {
          pivot.rotation.y = 0;
          frame();
        }
        framedSize = normalized;
        if (!visible) draw(performance.now());
      },
      screenshot: () =>
        new Promise((resolve, reject) => {
          draw(performance.now());
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Unable to capture the preview."))),
            "image/png",
          );
        }),
      record: async (resolution, recordOptions) => {
        recording = true;
        loop();
        controls.enabled = false;
        const originalPosition = camera.position.clone(),
          originalTarget = controls.target.clone(),
          originalRotation = pivot.rotation.y,
          originalAspect = camera.aspect;
        renderer.setPixelRatio(1);
        renderer.setSize(resolution, resolution, false);
        camera.aspect = 1;
        camera.position.set(4, 2.6, 4.8);
        controls.target.set(0, 0, 0);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        const controller = new AbortController();
        recordAbort = () => controller.abort();
        const { signal } = recordOptions;
        signal.addEventListener("abort", recordAbort, { once: true });
        if (signal.aborted) controller.abort();
        try {
          return await recordTurntable(
            canvas,
            (angle) => {
              pivot.rotation.y = angle;
              draw(performance.now());
            },
            { ...recordOptions, signal: controller.signal },
          );
        } finally {
          signal.removeEventListener("abort", recordAbort);
          recordAbort = undefined;
          recording = false;
          controls.enabled = true;
          pivot.rotation.y = originalRotation;
          if (scene.current) {
            camera.aspect = originalAspect;
            camera.position.copy(originalPosition);
            controls.target.copy(originalTarget);
            fit();
            loop();
          }
        }
      },
    };
    scene.current.setObject(latest.current);

    const lost = (event: Event) => {
      event.preventDefault();
      recordAbort?.();
      setError("The graphics context was lost. Reload the page to restore the preview.");
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      scene.current = null;
      recordAbort?.();
      resize.disconnect();
      intersection.disconnect();
      density?.removeEventListener("change", onDensity);
      renderer.setAnimationLoop(null);
      canvas.removeEventListener("webglcontextlost", lost);
      controls.dispose();
      environment.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      // Browsers cap live WebGL contexts, so release this one now instead of at garbage collection.
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  // Swapping the object reuses the renderer, so live edits never create a new WebGL context.
  useEffect(() => {
    if (latest.current === object) return;
    latest.current = object;
    scene.current?.setObject(object);
  }, [object]);

  return (
    <div
      ref={host}
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted/30",
        className,
      )}
    >
      {error && (
        <p
          role="alert"
          className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground text-balance"
        >
          {error}
        </p>
      )}
    </div>
  );
}
