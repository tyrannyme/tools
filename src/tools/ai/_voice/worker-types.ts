import type { WorkProgress } from "./ui";
export interface Segment {
  text: string;
  start: number;
  end: number;
}
export type WorkerReply =
  | { type: "progress"; progress: WorkProgress }
  | { type: "engine"; device: "webgpu" | "wasm" }
  | { type: "language"; language: string }
  | { type: "segments"; segments: Segment[] }
  | { type: "translation"; text: string }
  | { type: "audio"; samples: Float32Array; rate: number; text: string }
  | { type: "done" }
  | { type: "disposed" }
  | { type: "error"; error: string };

/** What the page tells a worker about the model, so progress can name it honestly. */
export interface ModelLabel {
  name: string;
  cached: boolean;
  /** Expected model bytes, so the bar never runs backwards as files start. */
  bytes: number;
}

interface DownloadInfo {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
}

/**
 * Turns transformers.js per-file progress into one honest bar for the whole model.
 * Cached files report progress too, so the label says "Loading" instead of "Downloading".
 */
export function downloadReporter(model: ModelLabel, send: (reply: WorkerReply) => void) {
  const files = new Map<string, { loaded: number; total: number }>();
  let sent = 0;
  let started = false;
  const verb = model.cached ? "Loading" : "Downloading";
  send({ type: "progress", progress: { label: `${verb} ${model.name}…`, percent: 0 } });
  return (info: DownloadInfo) => {
    if (info.status === "ready") {
      started = true;
      send({ type: "progress", progress: { label: `Starting ${model.name}…` } });
      return;
    }
    if (started || info.status !== "progress" || !info.file || !info.total) return;
    files.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
    let loaded = 0;
    let total = 0;
    for (const file of files.values()) {
      loaded += file.loaded;
      total += file.total;
    }
    total = Math.max(total, model.bytes);
    if (loaded >= total) {
      started = true;
      // Files are in; the runtime now compiles the model, which reports no progress.
      send({ type: "progress", progress: { label: `Starting ${model.name}…` } });
      return;
    }
    const now = performance.now();
    if (now - sent < 100) return;
    sent = now;
    send({
      type: "progress",
      progress: {
        label: `${verb} ${model.name}…`,
        percent: (loaded / total) * 100,
        ...(model.cached ? {} : { loaded, total }),
      },
    });
  };
}

export async function gpuAvailable() {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!(await gpu?.requestAdapter());
  } catch {
    return false;
  }
}
