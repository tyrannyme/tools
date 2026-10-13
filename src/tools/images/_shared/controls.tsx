import { CircleAlert, ImageUp, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { FileDrop } from "@/components/file-drop";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { downloadBlob, loadSample } from "@/lib/files";
import { encode, canvasOf, message, readImage } from "./image";
import type { Format } from "./image";

/** Entrance for a result that appears. Reduced motion keeps only the fade. */
export const enter =
  "animate-in fade-in-0 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:slide-in-from-bottom-1";

/** Hairline outline for content images, per the polish rules. */
export const imageOutline =
  "outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10";

/** Spinner for a busy button. The button text carries the state for screen readers. */
export function ButtonSpinner() {
  return <Loader2 className="animate-spin" aria-hidden="true" />;
}

/** Downloads a blob and confirms it with a toast. */
export function save(blob: Blob, filename: string) {
  downloadBlob(blob, filename);
  toast.success(`Saved ${filename}`);
}

/** Copies text and confirms it with a toast. */
export async function copyText(text: string, success = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(success);
  } catch {
    toast.error("Unable to copy. Your browser blocked clipboard access.");
  }
}

export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  placeholder,
  invalid,
  hint,
  className,
}: {
  label: string;
  value: number | string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: string;
  invalid?: boolean;
  hint?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <Field data-invalid={invalid || undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="tabular-nums"
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && (
        <FieldDescription id={`${id}-hint`} className={invalid ? "text-destructive" : undefined}>
          {hint}
        </FieldDescription>
      )}
    </Field>
  );
}

export function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
  hideLabel,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </FieldLabel>
      <Select value={value} onValueChange={(next) => next && onChange(next as T)} items={options}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** A labelled slider with its current value shown beside the label. */
export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onCommit?: (value: number) => void;
}) {
  const id = useId();
  const pick = (next: number | readonly number[]) =>
    (Array.isArray(next) ? next[0] : next) as number;
  return (
    <Field>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel id={id}>{label}</FieldLabel>
        <span className="text-sm text-muted-foreground tabular-nums">{format(value)}</span>
      </div>
      <Slider
        aria-labelledby={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onChange(pick(next))}
        onValueCommitted={onCommit ? (next) => onCommit(pick(next)) : undefined}
        className="py-1.5"
      />
    </Field>
  );
}

const formats: { value: Format; label: string }[] = [
  { value: "webp", label: "WebP" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
];

export function FormatFields({
  format,
  setFormat,
  quality,
  setQuality,
  avif = false,
}: {
  format: Format;
  setFormat: (value: Format) => void;
  quality: number;
  setQuality: (value: number) => void;
  avif?: boolean;
}) {
  const [canAvif, setCanAvif] = useState<boolean | null>(null);
  useEffect(() => {
    if (avif)
      void encode(canvasOf(1, 1).canvas, "avif", 0.8).then(
        () => setCanAvif(true),
        () => setCanAvif(false),
      );
  }, [avif]);
  return (
    <>
      <Choice
        label="Format"
        value={format}
        onChange={setFormat}
        options={[
          ...formats,
          ...(avif
            ? [
                {
                  value: "avif" as const,
                  label: canAvif === false ? "AVIF (not supported by this browser)" : "AVIF",
                  disabled: canAvif !== true,
                },
              ]
            : []),
        ]}
      />
      {format === "png" ? (
        <p className="text-sm text-muted-foreground">
          PNG is lossless, so it has no quality setting.
        </p>
      ) : (
        <SliderField
          label="Quality"
          min={1}
          max={100}
          value={quality}
          onChange={setQuality}
          format={(value) => `${value}%`}
        />
      )}
      {format === "jpeg" && (
        <p className="-mt-2 text-sm text-muted-foreground">
          JPEG has no transparency, so transparent areas turn white.
        </p>
      )}
    </>
  );
}

/**
 * The file picker. Empty, it is the standard drop zone with a sample. Once something is
 * open, it shrinks to a row that names the current file and offers a replacement.
 */
export function ImageDrop({
  onFiles,
  onError,
  multiple = false,
  paste = false,
  disabled = false,
  accept = "image/*",
  hint,
  current,
}: {
  onFiles: (files: File[]) => void;
  onError: (error: string) => void;
  multiple?: boolean;
  paste?: boolean;
  disabled?: boolean;
  accept?: string;
  hint?: string;
  current?: { title: string; detail?: string } | null;
}) {
  const [sampling, setSampling] = useState(false);
  const deliver = (files: File[]) => {
    if (!disabled) onFiles(files);
  };
  const defaultHint = paste ? "PNG, JPEG, or WebP. You can also paste." : "PNG, JPEG, or WebP";
  if (current)
    return (
      <FileDrop
        compact
        title={current.title}
        hint={current.detail}
        accept={accept}
        multiple={multiple}
        paste={paste}
        icon={ImageUp}
        onFiles={deliver}
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
          {multiple ? "Choose others" : "Replace"}
        </span>
      </FileDrop>
    );
  return (
    <FileDrop
      title={multiple ? "Choose images or drop them here" : "Choose an image or drop it here"}
      hint={hint ?? defaultHint}
      accept={accept}
      multiple={multiple}
      paste={paste}
      icon={ImageUp}
      onFiles={deliver}
    >
      <Button
        variant="outline"
        disabled={disabled || sampling}
        onClick={() => {
          setSampling(true);
          void loadSample("door.webp", "image/webp")
            .then((file) => onFiles([file]))
            .catch((error) => onError(message(error)))
            .finally(() => setSampling(false));
        }}
      >
        {sampling && <ButtonSpinner />}
        Try a sample
      </Button>
    </FileDrop>
  );
}

/** Inline error with an icon, so the state never depends on color alone. */
export function ErrorMessage({ error, className }: { error: string; className?: string }) {
  return error ? (
    <p
      role="alert"
      className={cn("flex items-start gap-2 text-sm text-destructive", enter, className)}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{error}</span>
    </p>
  ) : null;
}

export function useObjectUrl(blob?: Blob | null) {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) {
      return;
    }
    const url = URL.createObjectURL(blob);
    // Object URLs are external resources created and released with this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    setEntry({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  // Never hand out a URL that belongs to a previous, already revoked blob.
  return blob && entry?.blob === blob ? entry.url : "";
}
export function useImage() {
  const [source, setSource] = useState<{ file: File; image: HTMLImageElement } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function open(files: File[]) {
    const file = files[0];
    if (!file) return null;
    const current = ++generation.current;
    setError("");
    setBusy(true);
    try {
      const image = await readImage(file);
      if (current !== generation.current) return null;
      const next = { file, image };
      setSource(next);
      return next;
    } catch (error) {
      if (current === generation.current) setError(message(error));
      return null;
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return { source, error, setError, busy, open, url: useObjectUrl(source?.file) };
}
