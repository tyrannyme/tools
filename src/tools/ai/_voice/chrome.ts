import { useEffect, useRef, useState } from "react";
import { message } from "./ui";
import { useHydrated } from "@/lib/use-hydrated";
import type { WorkProgress } from "./ui";

type Availability = "available" | "downloadable" | "downloading" | "unavailable";
/** `missing` means the browser has no such API; `unavailable` means it has one this device can't run. */
export type Status = Availability | "missing" | "checking";
type Options = Record<string, unknown>;
interface Session {
  destroy(): void;
}
export interface Factory<T extends Session> {
  availability(options?: Options): Promise<Availability>;
  create(
    options?: Options & { monitor?: (monitor: EventTarget) => void; signal?: AbortSignal },
  ): Promise<T>;
}
export interface TranslatorSession extends Session {
  translate(text: string): Promise<string>;
}
export interface DetectorSession extends Session {
  detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
}
export interface SummarizerSession extends Session {
  summarizeStreaming(text: string, options?: { signal: AbortSignal }): ReadableStream<string>;
}
export interface ProofreaderSession extends Session {
  proofread(text: string): Promise<{ correctedInput: string }>;
}
export interface LanguageModelSession extends Session {
  prompt(text: string, options?: { signal: AbortSignal }): Promise<string>;
}
interface BrowserAI {
  Translator?: Factory<TranslatorSession>;
  LanguageDetector?: Factory<DetectorSession>;
  Summarizer?: Factory<SummarizerSession>;
  Proofreader?: Factory<ProofreaderSession>;
  LanguageModel?: Factory<LanguageModelSession>;
}
export function browserAI(): BrowserAI {
  return window as unknown as BrowserAI;
}

/**
 * Asks Chrome whether a built-in model can run here. `availability()` never downloads
 * anything, so it is safe to call before the visitor acts.
 */
export function useAvailability(
  factory: (ai: BrowserAI) => Pick<Factory<Session>, "availability"> | undefined,
  options: Options,
  version = 0,
): Status {
  const hydrated = useHydrated();
  const [status, setStatus] = useState<{ key: string; value: Status }>({
    key: "",
    value: "checking",
  });
  const optionsKey = JSON.stringify(options);
  const key = `${optionsKey}#${version}`;
  const get = useRef(factory);
  useEffect(() => {
    if (!hydrated) return;
    const api = get.current(browserAI());
    let live = true;
    const done = (value: Status) => live && setStatus({ key, value });
    if (!api) done("missing");
    else api.availability(JSON.parse(optionsKey)).then(done, () => done("unavailable"));
    return () => {
      live = false;
    };
  }, [hydrated, key, optionsKey]);
  return status.key === key ? status.value : "checking";
}

export function useChromeTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<WorkProgress | null>(null);
  // Bumped after each run, so availability is checked again once a download finishes.
  const [runs, setRuns] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const sessions = useRef(new Set<Session>());
  useEffect(() => {
    const owned = sessions.current;
    return () => {
      controller.current?.abort();
      for (const session of owned) session.destroy();
      owned.clear();
    };
  }, []);

  async function create<T extends Session>(
    factory: Factory<T> | undefined,
    options: Options,
    name: string,
    signal: AbortSignal,
  ): Promise<T> {
    if (!factory)
      throw new Error(`This browser has no built-in ${name}. Open this page in desktop Chrome.`);
    setProgress({ label: "Starting…" });
    const availability = await factory.availability(options);
    signal.throwIfAborted();
    if (availability === "unavailable")
      throw new Error(`Chrome's ${name} can't run with these settings on this device.`);
    if (
      availability !== "available" &&
      navigator.userActivation &&
      !navigator.userActivation.isActive
    )
      throw new Error("Chrome needs a fresh click to start the download. Press the button again.");
    const downloading = `Downloading Chrome's ${name}…`;
    if (availability !== "available") setProgress({ label: downloading, percent: 0 });
    const session = await factory
      .create({
        ...options,
        signal,
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            if (signal.aborted) return;
            // Chrome reports a fraction from 0 to 1, not bytes.
            const loaded = (event as ProgressEvent).loaded;
            setProgress(
              loaded >= 1
                ? { label: `Starting Chrome's ${name}…` }
                : { label: downloading, percent: loaded * 100 },
            );
          });
        },
      })
      .catch((cause: unknown) => {
        signal.throwIfAborted();
        throw new Error(
          availability === "available"
            ? `Chrome's ${name} didn't start (${message(cause)}). Try again, or restart Chrome.`
            : `Chrome couldn't download its ${name}. Check your connection and free disk space, then try again.`,
        );
      });
    if (signal.aborted) {
      session.destroy();
      signal.throwIfAborted();
    }
    sessions.current.add(session);
    return session;
  }

  async function run(work: (signal: AbortSignal) => Promise<void>) {
    if (controller.current) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      await work(active.signal);
    } catch (cause) {
      if (!active.signal.aborted)
        setError(
          cause instanceof DOMException && cause.name === "QuotaExceededError"
            ? "This text is too long for Chrome's on-device model. Shorten it and try again."
            : message(cause),
        );
    } finally {
      for (const session of sessions.current) session.destroy();
      sessions.current.clear();
      if (controller.current === active) {
        controller.current = null;
        setBusy(false);
        setProgress(null);
        setRuns((value) => value + 1);
      }
    }
  }
  function cancel() {
    controller.current?.abort();
    for (const session of sessions.current) session.destroy();
    sessions.current.clear();
  }
  return { busy, error, progress, runs, create, run, cancel, setProgress, setError };
}

export async function readStream(
  stream: ReadableStream<string>,
  signal: AbortSignal,
  update: (text: string) => void,
) {
  const reader = stream.getReader();
  let text = "";
  try {
    while (true) {
      signal.throwIfAborted();
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) break;
      text += next.value;
      update(text);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!text.trim()) throw new Error("The model returned nothing. Try a longer passage.");
  return text;
}
