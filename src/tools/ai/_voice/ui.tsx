import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, CircleAlert, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { downloadBlob, formatBytes } from "@/lib/files";
import { useHydrated } from "@/lib/use-hydrated";

export interface WorkProgress {
  label: string;
  percent?: number;
  loaded?: number;
  total?: number;
}

/** Entrance for content that appears after work. Reduced motion keeps only the fade. */
export const enter =
  "animate-in fade-in-0 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:slide-in-from-bottom-1";

export function Choice({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        onValueChange={(next) => next !== null && onChange(next)}
        disabled={disabled}
        items={options}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Live status for work in progress, with a real progress bar when the work reports one. */
export function WorkStatus({
  progress,
  onCancel,
  children,
}: {
  progress: WorkProgress | null;
  onCancel?: () => void;
  children?: ReactNode;
}) {
  if (!progress) return null;
  const { label, percent, loaded, total } = progress;
  return (
    <div className={cn("space-y-3 rounded-lg border bg-card p-4", enter)}>
      <div className="flex items-center justify-between gap-3">
        <output className="flex min-w-0 items-center gap-2 text-sm">
          <Spinner className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 break-words">{label}</span>
        </output>
        <div className="flex shrink-0 items-center gap-1">
          {children}
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      {percent !== undefined && (
        <div className="space-y-2">
          <Progress aria-label={label} value={Math.max(0, Math.min(100, percent))} />
          <p className="flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
            <span>
              {loaded !== undefined &&
                (total ? `${formatBytes(loaded)} of ${formatBytes(total)}` : formatBytes(loaded))}
            </span>
            <span>{Math.floor(percent)}%</span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Inline error with an icon, so the state never depends on color alone. */
export function ToolError({ error }: { error: string | null }) {
  return error ? (
    <Alert variant="destructive" className={enter}>
      <CircleAlert aria-hidden="true" />
      <AlertDescription className="text-pretty">{error}</AlertDescription>
    </Alert>
  ) : null;
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function save(blob: Blob, filename: string) {
  try {
    downloadBlob(blob, filename);
    toast.success(`Saved ${filename}`);
  } catch {
    toast.error("Unable to start the download. Try again.");
  }
}

const swap =
  "absolute inset-0 size-4 transition-[opacity,scale,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";
const hidden = "scale-25 opacity-0 blur-[4px] motion-reduce:scale-100 motion-reduce:blur-none";

export function CopyButton({
  text,
  disabled = false,
  message: note = "Copied",
  label = "Copy",
}: {
  text: string;
  disabled?: boolean;
  message?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(note);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Unable to copy. Select the text and copy it, or download it.");
    }
  }
  return (
    <Button variant="outline" disabled={disabled || !text} onClick={copy}>
      <span className="relative size-4 shrink-0" aria-hidden="true">
        <Copy className={cn(swap, copied && hidden)} />
        <Check className={cn(swap, !copied && hidden)} />
      </span>
      {label}
    </Button>
  );
}

export interface DownloadOption {
  label: string;
  filename: string;
  blob: () => Blob;
}

/** One download button, or a menu when there are several formats. */
export function DownloadButton({
  options,
  disabled = false,
}: {
  options: DownloadOption[];
  disabled?: boolean;
}) {
  if (options.length === 1) {
    const [option] = options;
    return (
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => save(option.blob(), option.filename)}
      >
        <Download aria-hidden="true" />
        Download
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />} disabled={disabled}>
        <Download aria-hidden="true" />
        Download
        <ChevronDown aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.filename}
            onClick={() => save(option.blob(), option.filename)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function textFile(text: string, filename: string, label = "Text file"): DownloadOption {
  const markdown = filename.endsWith(".md");
  return {
    label,
    filename,
    blob: () =>
      new Blob([text], {
        type: markdown ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8",
      }),
  };
}

/** A result panel with a toolbar. The body keeps its height while it is empty, so nothing jumps. */
export function ResultPanel({
  meta,
  actions,
  footer,
  children,
  className,
  label,
}: {
  meta?: ReactNode;
  actions?: ReactNode;
  /** Actions pinned to the bottom, for panels that exist before there is a result. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn("flex min-w-0 flex-col rounded-xl border bg-card", className)}
    >
      {(meta || actions) && (
        <div className="flex min-h-13 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-2.5">
          <div className="min-w-0 text-sm text-muted-foreground">{meta}</div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
      {footer && (
        <div className={cn("flex flex-wrap items-center justify-end gap-2 px-3 pb-3", enter)}>
          {footer}
        </div>
      )}
    </section>
  );
}

/** Is a transformers.js model already in the browser cache? Reads the Cache API only, no network. */
export function useModelCached(parts: string[], version: number) {
  const hydrated = useHydrated();
  const [cached, setCached] = useState<{ key: string; value: boolean } | null>(null);
  const key = parts.join("|");
  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    const needed = key.split("|");
    async function check() {
      if (typeof caches === "undefined" || !(await caches.has("transformers-cache"))) return false;
      const urls = (await (await caches.open("transformers-cache")).keys()).map(
        (request) => request.url,
      );
      return needed.every((part) => urls.some((url) => url.includes(part)));
    }
    check().then(
      (value) => live && setCached({ key, value }),
      () => live && setCached({ key, value: false }),
    );
    return () => {
      live = false;
    };
  }, [hydrated, key, version]);
  return cached?.key === key ? cached.value : null;
}

export interface ModelInfo {
  name: string;
  href: string;
  license: string;
  /** Model files plus runtime, in bytes, as measured on a first visit. */
  bytes: number;
}

/** Model name, license, and download size, with whether the download is already done. */
export function ModelNote({
  model,
  cached,
  device,
  privacy,
}: {
  model: ModelInfo;
  cached: boolean | null;
  device: string;
  privacy: string;
}) {
  return (
    <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
      <a
        className="font-medium text-foreground underline-offset-4 hover:underline"
        href={model.href}
        target="_blank"
        rel="noreferrer"
      >
        {model.name}
      </a>{" "}
      · {model.license} ·{" "}
      {cached ? (
        <span className="text-foreground">
          <Check aria-hidden="true" className="mr-0.5 inline size-3.5 align-[-3px]" />
          Downloaded, loads from your browser cache.
        </span>
      ) : (
        <>{formatBytes(model.bytes)} download on first use, then cached for next time.</>
      )}{" "}
      {device && <>{device}. </>}
      {privacy}
    </p>
  );
}

export const languages = [
  ["ar", "Arabic"],
  ["bg", "Bulgarian"],
  ["bn", "Bengali"],
  ["zh", "Chinese"],
  ["zh-Hant", "Chinese (Traditional)"],
  ["hr", "Croatian"],
  ["cs", "Czech"],
  ["da", "Danish"],
  ["nl", "Dutch"],
  ["en", "English"],
  ["fi", "Finnish"],
  ["fr", "French"],
  ["de", "German"],
  ["el", "Greek"],
  ["he", "Hebrew"],
  ["hi", "Hindi"],
  ["hu", "Hungarian"],
  ["id", "Indonesian"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["kn", "Kannada"],
  ["ko", "Korean"],
  ["lt", "Lithuanian"],
  ["mr", "Marathi"],
  ["no", "Norwegian"],
  ["pl", "Polish"],
  ["pt", "Portuguese"],
  ["ro", "Romanian"],
  ["ru", "Russian"],
  ["sk", "Slovak"],
  ["sl", "Slovenian"],
  ["es", "Spanish"],
  ["sv", "Swedish"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["th", "Thai"],
  ["tr", "Turkish"],
  ["uk", "Ukrainian"],
  ["vi", "Vietnamese"],
].map(([value, label]) => ({ value, label }));
export const automaticLanguage = [{ value: "auto", label: "Detect language" }, ...languages];

const displayNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "language" })
    : null;
export const languageName = (code: string) =>
  languages.find((item) => item.value === code)?.label ?? displayNames?.of(code) ?? code;
