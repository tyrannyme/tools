import { useEffect, useRef, useState } from "react";
import type { WorkProgress } from "./ui";
import type { WorkerReply } from "./worker-types";

export function useModelWorker(makeWorker: () => Worker, onReply: (reply: WorkerReply) => void) {
  const worker = useRef<Worker | null>(null);
  const callback = useRef(onReply);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<WorkProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState("");
  // Bumped after each finished run, so the page can re-check the model cache.
  const [runs, setRuns] = useState(0);
  useEffect(() => {
    callback.current = onReply;
  });
  useEffect(
    () => () => {
      const owned = worker.current;
      if (!owned) return;
      worker.current = null;
      owned.onmessage = (event: MessageEvent<WorkerReply>) => {
        if (event.data.type === "disposed") owned.terminate();
      };
      owned.postMessage({ type: "dispose" });
      // Termination also releases a busy worker's WASM memory and GPU context.
      setTimeout(() => owned.terminate(), 1500);
    },
    [],
  );
  function finish() {
    locked.current = false;
    setBusy(false);
    setProgress(null);
    setRuns((value) => value + 1);
  }
  function start(input: unknown, transfer: Transferable[] = [], label = "Starting…") {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setProgress({ label });
    try {
      if (!worker.current) {
        const current = makeWorker();
        worker.current = current;
        current.onmessage = (event: MessageEvent<WorkerReply>) => {
          const reply = event.data;
          if (reply.type === "progress") setProgress(reply.progress);
          if (reply.type === "engine")
            setDevice(
              reply.device === "webgpu"
                ? "Running on your GPU"
                : "Running on your CPU (WebAssembly)",
            );
          if (reply.type === "error" || reply.type === "done") {
            finish();
            if (reply.type === "error") setError(reply.error);
          }
          callback.current(reply);
        };
        current.onerror = (event) => {
          event.preventDefault();
          setError(
            "The model stopped unexpectedly, possibly out of memory. Reload the page and try again.",
          );
          finish();
          current.terminate();
          worker.current = null;
        };
      }
      worker.current.postMessage(input, transfer);
    } catch {
      finish();
      setError("Unable to start the model in this browser. Reload the page and try again.");
    }
  }
  function cancel() {
    worker.current?.terminate();
    worker.current = null;
    finish();
  }
  return { busy, progress, error, device, runs, start, cancel, setError };
}
