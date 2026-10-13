import type { FrameLoopHandle, Gpu } from "vgpu";

/** Renders the gilded dusk into `canvas`, tracking the pointer over `area`. Returns a cleanup function. */
export function startGildedDusk(canvas: HTMLCanvasElement, area: HTMLElement): () => void {
  if (!("gpu" in navigator)) return () => {};

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    const [{ effect, frame, frameLoop, init, surface }, { default: shader }] = await Promise.all([
      import("vgpu"),
      import("./gilded-dusk.wgsl"),
    ]);
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

    const target = surface(gpu, canvas, { dpr: [1, 2] });
    const aspect = () => target.size[0] / Math.max(target.size[1], 1);
    const dusk = effect(gpu, shader, {
      label: "gilded-dusk",
      set: { params: { time: 12, aspect: aspect(), pointer: [0.5, 0.5], glow: 0 } },
    });
    await dusk.compile(target);
    if (disposed) return;
    target.onResize(() => dusk.set({ params: { aspect: aspect() } }));

    if (still) {
      frame(gpu, (f) => f.pass(target, dusk));
      canvas.dataset.ready = "";
      return;
    }

    area.addEventListener("pointermove", move);
    area.addEventListener("pointerleave", leave);
    const start = () => {
      loop ??= frameLoop(gpu!, (f) => {
        pointer.glow += (pointer.target - pointer.glow) * 0.08;
        dusk.set({
          params: {
            time: 12 + performance.now() / 1000,
            pointer: [pointer.x, pointer.y],
            glow: pointer.glow,
          },
        });
        f.pass(target, dusk);
        canvas.dataset.ready = "";
      });
    };
    observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) return start();
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
