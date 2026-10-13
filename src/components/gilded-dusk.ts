import type { FrameLoopHandle, Gpu } from "vgpu";

/** The sky pass renders at this fraction of the canvas size in each direction. */
const SKY_SCALE = 1 / 4;

/** Renders the gilded dusk into `canvas`, tracking the pointer over `area`. Returns a cleanup function. */
export function startGildedDusk(canvas: HTMLCanvasElement, area: HTMLElement): () => void {
  if (!("gpu" in navigator)) return () => {};

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Phones get half the frame rate; the motes drift slowly enough that it does not show.
  const fps = matchMedia("(pointer: coarse)").matches ? 30 : 60;
  const pointer = { x: 0.5, y: 0.5, target: 0, glow: 0 };
  let disposed = false;
  let gpu: Gpu | undefined;
  let loop: FrameLoopHandle | undefined;
  let observer: IntersectionObserver | undefined;

  const move = (event: PointerEvent) => {
    const rect = area.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width;
    pointer.y = (event.clientY - rect.top) / rect.height;
    pointer.target = 1;
  };
  const leave = () => (pointer.target = 0);

  const run = async () => {
    // Loaded on demand so the renderer never delays the page itself.
    const [vgpu, { default: skyShader }, { default: duskShader }] = await Promise.all([
      import("vgpu"),
      import("./gilded-dusk-sky.wgsl"),
      import("./gilded-dusk.wgsl"),
    ]);
    const { effect, frame, frameLoop, init, sampler, surface, target } = vgpu;
    if (disposed) return;
    gpu = await init();
    if (disposed) return gpu.dispose();
    const fail = () => {
      observer?.disconnect();
      loop?.stop();
      delete canvas.dataset.ready;
    };
    gpu.onError(fail);
    void gpu.lost.then(fail);

    const output = surface(gpu, canvas, { dpr: [1, 2] });
    const skySize = (): [number, number] => [
      Math.max(1, Math.ceil(output.size[0] * SKY_SCALE)),
      Math.max(1, Math.ceil(output.size[1] * SKY_SCALE)),
    ];
    const aspect = () => output.size[0] / Math.max(output.size[1], 1);
    const params = { time: 12, aspect: aspect(), pointer: [0.5, 0.5], glow: 0 };
    const sky = target(gpu, { size: skySize() });
    const skyPass = effect(gpu, skyShader, { label: "gilded-dusk-sky", set: { params } });
    const dusk = effect(gpu, duskShader, {
      label: "gilded-dusk",
      set: { params, sky, skySampler: sampler(gpu, { minFilter: "linear", magFilter: "linear" }) },
    });
    await Promise.all([skyPass.compile(sky), dusk.compile(output)]);
    if (disposed) return;
    output.onResize(() => {
      sky.resize(skySize());
      params.aspect = aspect();
      skyPass.set({ params });
      dusk.set({ params, sky });
    });

    const render = () =>
      frame(gpu!, (f) => {
        f.pass(sky, skyPass);
        f.pass(output, dusk);
      });

    if (still) {
      render();
      canvas.dataset.ready = "";
      return;
    }

    area.addEventListener("pointermove", move);
    area.addEventListener("pointerleave", leave);
    let last = performance.now();
    const start = () => {
      loop ??= frameLoop(
        gpu!,
        (f) => {
          const now = performance.now();
          // Eases toward the pointer at the same speed whatever the frame rate.
          pointer.glow += (pointer.target - pointer.glow) * (1 - Math.exp(-(now - last) / 200));
          last = now;
          params.time = 12 + now / 1000;
          params.pointer = [pointer.x, pointer.y];
          params.glow = pointer.glow;
          skyPass.set({ params });
          dusk.set({ params });
          f.pass(sky, skyPass);
          f.pass(output, dusk);
          canvas.dataset.ready = "";
        },
        { fps },
      );
    };
    observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        last = performance.now();
        return start();
      }
      loop?.stop();
      loop = undefined;
    });
    observer.observe(canvas);
  };

  // Any failure leaves the CSS gradient in place.
  run().catch(() => gpu?.dispose());

  return () => {
    disposed = true;
    observer?.disconnect();
    area.removeEventListener("pointermove", move);
    area.removeEventListener("pointerleave", leave);
    loop?.stop();
    gpu?.dispose();
  };
}
