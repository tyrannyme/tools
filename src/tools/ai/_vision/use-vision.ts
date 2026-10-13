import { useCallback, useEffect, useRef, useState } from "react";
import { bytesOf, choose, modelKey, models } from "./types";
import type {
  Backend,
  Device,
  ModelKey,
  VisionPhase,
  VisionRequest,
  VisionResult,
  VisionTask,
  WorkerReply,
} from "./types";

let detected: Promise<Backend> | undefined;
/** Asks the browser for a GPU once per page. No network and no runtime involved. */
function detectBackend() {
  detected ??= (async (): Promise<Backend> => {
    try {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
      // A software adapter (SwiftShader) is far slower than WebAssembly, so skip it.
      if (adapter && !adapter.info.isFallbackAdapter)
        return { device: "webgpu", f16: adapter.features.has("shader-f16") };
    } catch {
      /* WebAssembly works everywhere. */
    }
    return { device: "wasm", f16: false };
  })();
  return detected;
}

/** Whether the model files are in transformers.js's browser cache, without loading it. */
async function cachedFiles(key: ModelKey, backend: Backend) {
  if (typeof caches === "undefined") return { model: false, runtime: false };
  const { variant, id, revision } = choose(models[key], backend);
  const cache = await caches.open("transformers-cache");
  const urls = Object.keys(variant.files).map(
    (file) => `https://huggingface.co/${id}/resolve/${revision}/${file}`,
  );
  const [found, keys] = await Promise.all([
    Promise.all(urls.map((url) => cache.match(url))),
    cache.keys(),
  ]);
  return {
    model: found.every(Boolean),
    runtime: keys.some((request) => request.url.includes("/ort-wasm")),
  };
}

const timingKey = (key: ModelKey, device: Device) => `tyranny-vision-time:${key}:${device}`;
function lastDuration(key: ModelKey, device: Device) {
  try {
    const value = Number(localStorage.getItem(timingKey(key, device)));
    return value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

/** What went wrong, in terms of what to do next. */
function explain(detail: string) {
  if (/fetch|network|load model|locate file|Unable to get/i.test(detail))
    return "The model could not be downloaded. Check your connection and try again.";
  if (/memory|allocat|OOM|out of/i.test(detail))
    return "Your device ran out of memory. Try a smaller image, or close other tabs and try again.";
  return `${detail.replace(/\.?$/, ".")} Try again, or try a smaller image.`;
}

export interface VisionStatus {
  phase: VisionPhase;
  /** When the current phase began, for elapsed time and estimates. */
  since: number;
}

export function useVision(task: VisionTask, scale: 2 | 4 = 2) {
  const key = modelKey(task, scale);
  const worker = useRef<Worker | null>(null);
  const pending = useRef<{
    resolve: (value: VisionResult) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [cached, setCached] = useState<{ model: boolean; runtime: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<VisionStatus | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(
    (next: Backend) =>
      cachedFiles(key, next)
        .then(setCached)
        .catch(() => setCached({ model: false, runtime: false })),
    [key],
  );
  useEffect(() => {
    let stale = false;
    void detectBackend().then((next) => {
      if (stale) return;
      setBackend(next);
      void refresh(next);
    });
    return () => {
      stale = true;
    };
  }, [refresh]);

  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    pending.current?.reject(new Error("Cancelled"));
    pending.current = null;
    setBusy(false);
    setStatus(null);
  };
  useEffect(
    () => () => {
      const current = worker.current;
      if (pending.current) {
        current?.terminate();
        pending.current.reject(new Error("Cancelled"));
        pending.current = null;
      } else if (current) {
        // Let the worker release GPU memory, but never wait on it for long.
        const timeout = setTimeout(() => current.terminate(), 2000);
        current.onmessage = (event: MessageEvent<WorkerReply>) => {
          if (event.data.type === "disposed") {
            clearTimeout(timeout);
            current.terminate();
          }
        };
        current.postMessage({ type: "dispose" });
      }
      worker.current = null;
    },
    [],
  );

  async function run(request: Omit<VisionRequest, "task" | "backend" | "scale">) {
    if (pending.current) throw new Error("Wait for the current image to finish.");
    const chosen = backend ?? (await detectBackend());
    setError("");
    setBusy(true);
    setStatus({ phase: { phase: "runtime" }, since: performance.now() });
    let runStarted = 0;
    let ranOn = choose(models[key], chosen).device;
    try {
      worker.current ??= new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      const active = worker.current;
      const result = await new Promise<VisionResult>((resolve, reject) => {
        pending.current = { resolve, reject };
        active.onmessage = (event: MessageEvent<WorkerReply>) => {
          const message = event.data;
          if (message.type === "progress")
            setStatus((current) => {
              const now = performance.now();
              const same = current?.phase.phase === message.progress.phase;
              if (message.progress.phase === "run" && !same) runStarted = now;
              return { phase: message.progress, since: same ? current.since : now };
            });
          else if (message.type === "device") {
            ranOn = message.device;
            setDevice(message.device);
          } else if (message.type === "result") {
            pending.current = null;
            resolve(message.result);
          } else if (message.type === "error") {
            pending.current = null;
            reject(new Error(message.message));
          }
        };
        active.onerror = (event) => {
          pending.current = null;
          active.terminate();
          worker.current = null;
          reject(new Error(event.message || "The AI worker stopped."));
        };
        active.postMessage({ ...request, task, scale, backend: chosen } satisfies VisionRequest);
      });
      if (runStarted)
        try {
          localStorage.setItem(
            timingKey(key, ranOn),
            String(Math.round(performance.now() - runStarted)),
          );
        } catch {
          /* Storage can be unavailable. Estimates are optional. */
        }
      return result;
    } catch (cause) {
      if (cause instanceof Error && cause.message === "Cancelled") throw cause;
      setError(explain(cause instanceof Error ? cause.message : String(cause)));
      throw cause;
    } finally {
      setBusy(false);
      setStatus(null);
      void refresh(chosen);
    }
  }

  const spec = models[key];
  const planned = backend ? choose(spec, backend) : null;
  const actual = device ?? planned?.device ?? null;
  return {
    run,
    stop,
    busy,
    status,
    error,
    setError,
    /** The model this browser will use. */
    model: {
      name: planned?.name ?? spec.name,
      id: planned?.id ?? spec.id,
      license: spec.license,
    },
    backend,
    /** The device the model runs on, once known. */
    device: actual,
    /** Download size for this browser's variant. */
    bytes: planned ? bytesOf(planned.variant) : null,
    cached,
    /** How long the last run took on this device, in milliseconds. */
    estimate: actual ? lastDuration(key, actual) : undefined,
  };
}
export type VisionEngine = ReturnType<typeof useVision>;
