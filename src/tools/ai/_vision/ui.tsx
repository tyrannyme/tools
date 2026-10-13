import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { toast } from "sonner";
import {
  ChevronsLeftRight,
  CircleAlert,
  Copy,
  Download,
  ImageUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "cn";
import { FileDrop } from "@/components/file-drop";
import { SampleButton } from "@/components/sample-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { downloadBlob, formatBytes } from "@/lib/files";
import type { VisionEngine } from "./use-vision";
import { decodeImage } from "./image";

/** Entrance for a result that appears. Reduced motion keeps only the fade. */
export const enter =
  "animate-in fade-in-0 duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:zoom-in-[0.98]";
/** Hairline outline for content images. */
export const outline = "outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10";
/** Shows transparency without competing with the image. */
const square = "color-mix(in oklab, var(--muted) 40%, var(--background))";
export const checkerboard: CSSProperties = {
  backgroundImage: `conic-gradient(${square} 25%, var(--background) 0 50%, ${square} 0 75%, var(--background) 0)`,
  backgroundSize: "16px 16px",
};
/** Images fit the stage without pushing the controls far below the fold. */
export const fit = "block h-auto max-h-[min(60vh,36rem)] w-auto max-w-full";

/** Spinner for a busy button or status. The text beside it carries the state. */
export function BusyIcon({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} aria-hidden="true" />;
}

// Object URLs are external resources created and revoked with the component lifecycle.
/* oxlint-disable react/set-state-in-effect */
export function useBlobUrl(blob: Blob | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
/* oxlint-enable react/set-state-in-effect */

export interface Picked {
  file: File;
  width: number;
  height: number;
}

const types = "image/png,image/jpeg,image/webp,image/avif,image/gif";

/** Drop zone with a sample while empty, then a compact row naming the open image. */
export function ImageInput({
  picked,
  onImage,
  disabled = false,
  sample,
  sampleFile = "door.webp",
}: {
  picked: Picked | null;
  onImage: (picked: Picked) => void;
  disabled?: boolean;
  /** Replaces the standard sample button entirely. */
  sample?: ReactNode;
  /** Image in `public/samples/` for the standard sample button. */
  sampleFile?: string;
}) {
  const [error, setError] = useState("");
  const active = useRef(false);
  async function accept(file: File) {
    if (disabled || active.current) return;
    active.current = true;
    setError("");
    try {
      if (!types.split(",").includes(file.type))
        throw new Error("Choose a PNG, JPEG, WebP, AVIF, or GIF image.");
      if (file.size > 30 * 1024 * 1024) throw new Error("Choose an image smaller than 30 MB.");
      const image = await decodeImage(file);
      const { width, height } = image;
      image.close();
      if (width * height > 16_000_000 || Math.max(width, height) > 8192)
        throw new Error("Resize this image to at most 16 megapixels and 8192 pixels per side.");
      onImage({ file, width, height });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This image could not be opened.");
    } finally {
      active.current = false;
    }
  }
  const onFiles = (files: File[]) => {
    if (files[0]) void accept(files[0]);
  };
  return (
    <div className="space-y-3">
      {picked ? (
        <fieldset disabled={disabled} className="min-w-0">
          <FileDrop
            compact
            paste
            icon={ImageUp}
            title={picked.file.name}
            hint={`${picked.width} × ${picked.height} px · ${formatBytes(picked.file.size)}`}
            accept={types}
            onFiles={onFiles}
            className="[&_label]:truncate"
          >
            {/* The whole row is the picker's label, so this only shows what a click does. */}
            <span
              aria-hidden="true"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "pointer-events-none",
                disabled && "opacity-50",
              )}
            >
              <RefreshCw />
              Replace
            </span>
          </FileDrop>
        </fieldset>
      ) : (
        <FileDrop
          paste
          icon={ImageUp}
          title="Choose an image or drop it here"
          hint="PNG, JPEG, WebP, AVIF, or GIF up to 30 MB. You can also paste."
          accept={types}
          onFiles={onFiles}
        >
          {sample ?? <SampleButton files={[sampleFile]} onFiles={onFiles} />}
        </FileDrop>
      )}
      <ErrorNote message={error} />
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" className={enter}>
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** Ships with the AI runtime every model needs. Compressed transfer size. */
const runtimeBytes = 5_500_000;

/** Model, license, and what starting will cost, before anything downloads. */
export function ModelNote({ engine, className }: { engine: VisionEngine; className?: string }) {
  const { model, bytes, cached, device } = engine;
  let cost = "";
  if (cached?.model && cached.runtime) cost = "Downloaded, works offline";
  else if (bytes !== null && cached)
    cost = `${formatBytes((cached.model ? 0 : bytes) + (cached.runtime ? 0 : runtimeBytes))} one-time download`;
  return (
    <p className={cn("text-xs leading-relaxed text-pretty text-muted-foreground", className)}>
      <a
        className="font-medium text-foreground underline-offset-4 hover:underline"
        href={`https://huggingface.co/${model.id}`}
        target="_blank"
        rel="noreferrer"
      >
        {model.name}
      </a>{" "}
      · {model.license}
      {cost && ` · ${cost}`}
      {device && ` · Runs on your ${device === "webgpu" ? "GPU" : "CPU"}`}. Images never leave this
      device.
    </p>
  );
}

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** Ticks once a second while `on`, for elapsed times. */
function useNow(on: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(timer);
  }, [on]);
  return now;
}

/**
 * Honest progress for a running job: download bytes, tiles, or elapsed time against the
 * last run on this device. `working` names the job, such as "Removing background".
 */
export function WorkStatus({
  engine,
  working,
  estimate = true,
}: {
  engine: VisionEngine;
  working: string;
  /** Show the last run's duration while working. Off when runs vary a lot. */
  estimate?: boolean;
}) {
  const { status, model, cached, device } = engine;
  const now = useNow(engine.busy);
  if (!engine.busy || !status) return null;
  const phase = status.phase;
  const elapsed = Math.max(0, now - status.since);
  const processor = device === "webgpu" ? "GPU" : "CPU";
  let label = "";
  let detail = "";
  let value: number | null = null;
  if (phase.phase === "runtime")
    label = cached?.runtime ? "Starting the AI runtime" : "Downloading the AI runtime";
  else if (phase.phase === "download") {
    label = cached?.model ? `Loading ${model.name}` : `Downloading ${model.name}`;
    value = (phase.loaded / phase.total) * 100;
    detail = `${formatBytes(phase.loaded)} of ${formatBytes(phase.total)}`;
  } else if (phase.phase === "start") label = `Preparing ${model.name} for your ${processor}`;
  else {
    label = working;
    if (phase.total) {
      value = ((phase.done ?? 0) / phase.total) * 100;
      const left =
        phase.done && phase.done < phase.total
          ? ` · about ${clock((elapsed / phase.done) * (phase.total - phase.done))} left`
          : "";
      detail = `${phase.done} of ${phase.total} tiles${left}`;
    } else {
      const last = estimate ? engine.estimate : undefined;
      detail = last ? `${clock(elapsed)} · last time ${clock(last)}` : clock(elapsed);
    }
  }
  const slowCpu =
    phase.phase === "run" &&
    device === "wasm" &&
    !phase.total &&
    !engine.estimate &&
    elapsed > 4000;
  return (
    <div className={cn("space-y-3 rounded-lg border bg-card p-3", enter)}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" aria-live="polite">
            {label}
          </p>
          {detail && <p className="text-xs text-muted-foreground tabular-nums">{detail}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={engine.stop}>
          Cancel
        </Button>
      </div>
      {value !== null && <Progress aria-label={label} value={value} />}
      {phase.phase === "download" && !cached?.model && (
        <p className="text-xs text-muted-foreground">Saved on this device for next time.</p>
      )}
      {slowCpu && (
        <p className="text-xs text-pretty text-muted-foreground">
          This browser has no usable GPU, so the model runs on your CPU. It can take a minute or
          more.
        </p>
      )}
    </div>
  );
}

export function Range({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format = String,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel>
        {label}
        <span className="ml-auto font-normal text-muted-foreground tabular-nums">
          {format(value)}
        </span>
      </FieldLabel>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </Field>
  );
}

/** The framed area that holds the image and the result. */
export function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-64 items-center justify-center overflow-hidden rounded-xl border bg-muted/30 p-3 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Before and after with a divider you drag across the image, or move with arrow keys. */
export function Compare({
  before,
  after,
  actualSize = false,
}: {
  before: string;
  after: string;
  /** Show the result at its real pixel size inside a scrollable frame. */
  actualSize?: boolean;
}) {
  const [split, setSplit] = useState(50);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Open actual pixels on the middle of the image, where the divider is.
  useEffect(() => {
    const element = scroller.current;
    if (!actualSize || !element) return;
    element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
  }, [actualSize, natural]);
  const frame = (
    <div
      className={cn("group relative w-fit overflow-hidden rounded-md select-none", outline, enter)}
      style={{
        ...checkerboard,
        ...(actualSize && natural ? { width: natural.width, height: natural.height } : null),
      }}
    >
      <img
        src={after}
        alt="Result"
        draggable={false}
        style={{ clipPath: `inset(0 0 0 ${split}%)` }}
        className={actualSize ? "block size-full max-w-none" : fit}
        onLoad={(event) =>
          setNatural({
            width: event.currentTarget.naturalWidth / devicePixelRatio,
            height: event.currentTarget.naturalHeight / devicePixelRatio,
          })
        }
      />
      <img
        src={before}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full"
        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.15)]"
        style={{ left: `${split}%` }}
      >
        <span className="absolute top-1/2 left-1/2 flex size-8 -translate-1/2 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md ring-ring/60 group-has-[input:focus-visible]:ring-3">
          <ChevronsLeftRight className="size-4" />
        </span>
      </div>
      <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-background/85 px-1.5 py-0.5 text-xs font-medium backdrop-blur-sm">
        Original
      </span>
      <span className="pointer-events-none absolute top-2 right-2 rounded-md bg-background/85 px-1.5 py-0.5 text-xs font-medium backdrop-blur-sm">
        Result
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={split}
        aria-label="Divider between original and result"
        aria-valuetext={`${Math.round(split)}% original`}
        onChange={(event) => setSplit(Number(event.target.value))}
        className="absolute inset-0 size-full cursor-ew-resize touch-pan-y opacity-0"
      />
    </div>
  );
  if (!actualSize) return frame;
  return (
    <div
      ref={scroller}
      className="max-h-[min(70vh,40rem)] w-full overflow-auto overscroll-contain rounded-md"
    >
      {frame}
    </div>
  );
}

const stem = (filename: string) => filename.replace(/\.[^.]+$/, "");

/** Download and copy for a PNG result, each confirmed with a toast. */
export function ImageActions({
  blob,
  filename,
  suffix,
  disabled = false,
  primary = true,
}: {
  blob: Blob | null;
  filename: string;
  suffix: string;
  disabled?: boolean;
  primary?: boolean;
}) {
  const [copying, setCopying] = useState(false);
  const canCopy = typeof ClipboardItem !== "undefined";
  return (
    <div className="flex gap-2">
      <Button
        className="flex-1"
        variant={primary ? "default" : "outline"}
        disabled={!blob || disabled}
        onClick={() => {
          if (!blob) return;
          const name = `${stem(filename)}-${suffix}.png`;
          downloadBlob(blob, name);
          toast.success(`Saved ${name}`);
        }}
      >
        <Download aria-hidden="true" />
        Download PNG
      </Button>
      {canCopy && (
        <Button
          variant="outline"
          disabled={!blob || disabled || copying}
          aria-label="Copy image"
          onClick={async () => {
            if (!blob) return;
            setCopying(true);
            try {
              await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
              toast.success("Image copied");
            } catch {
              toast.error("Your browser blocked copying the image. Download the PNG instead.");
            } finally {
              setCopying(false);
            }
          }}
        >
          {copying ? <BusyIcon /> : <Copy aria-hidden="true" />}
          Copy
        </Button>
      )}
    </div>
  );
}
