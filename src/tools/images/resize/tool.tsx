import { CircleCheck, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { formatBytes, renameExtension } from "@/lib/files";
import {
  ButtonSpinner,
  Choice,
  ErrorMessage,
  FormatFields,
  ImageDrop,
  NumberField,
  enter,
  imageOutline,
  save,
  useImage,
  useObjectUrl,
} from "../_shared/controls";
import { extension, message, resizeImage } from "../_shared/image";
import type { Format } from "../_shared/image";

type Result = {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
  name: string;
  limit?: string;
  format: Format;
};

const formatName: Record<Format, string> = { webp: "WebP", jpeg: "JPEG", png: "PNG", avif: "AVIF" };

const round = (value: number) => String(Math.round(value * 100) / 100);
const isSide = (value: string) => {
  const number = Number(value);
  return value !== "" && Number.isInteger(number) && number >= 1 && number <= 16384;
};
const fits = [
  { label: "512 × 512", width: 512, height: 512 },
  { label: "1920 × 1080", width: 1920, height: 1080 },
  { label: "3840 × 2160", width: 3840, height: 2160 },
];

export default function ResizeTool() {
  const { source, open, url, error, setError, busy: opening } = useImage();
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [locked, setLocked] = useState(true);
  const [percent, setPercent] = useState("100");
  const [format, setFormat] = useState<Format>("webp");
  const [quality, setQuality] = useState(85);
  const [limit, setLimit] = useState("");
  const [unit, setUnit] = useState<"KB" | "MB">("KB");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const resultUrl = useObjectUrl(result?.blob);
  const preview = useRef<HTMLDivElement>(null);
  // On narrow screens the preview sits below the settings, so bring a new result into view.
  useEffect(() => {
    const element = preview.current;
    if (!result || !element || element.getBoundingClientRect().bottom <= window.innerHeight) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [result]);
  const natural = source && {
    width: source.image.naturalWidth,
    height: source.image.naturalHeight,
  };
  const limitBytes = limit ? Number(limit) * (unit === "KB" ? 1024 : 1048576) : undefined;
  const limitInvalid = limit !== "" && !(Number(limit) > 0);

  function dirty() {
    setResult(null);
    setError("");
  }
  function setSize(nextWidth: number, nextHeight: number) {
    setWidth(String(Math.max(1, Math.round(nextWidth))));
    setHeight(String(Math.max(1, Math.round(nextHeight))));
    if (natural) setPercent(round((Math.round(nextWidth) / natural.width) * 100));
  }
  function changeSide(value: string, axis: "width" | "height") {
    dirty();
    if (axis === "width") setWidth(value);
    else setHeight(value);
    if (!natural || !(Number(value) > 0)) return;
    const ratio = Number(value) / natural[axis];
    setPercent(round(ratio * 100));
    if (!locked) return;
    if (axis === "width") setHeight(String(Math.max(1, Math.round(natural.height * ratio))));
    else setWidth(String(Math.max(1, Math.round(natural.width * ratio))));
  }
  async function run() {
    if (!source) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      if (!isSide(width) || !isSide(height))
        throw new Error("Enter a width and height in whole pixels, from 1 to 16,384.");
      if (limitInvalid) throw new Error("Enter a file size limit greater than zero.");
      const output = await resizeImage(
        source.image,
        Number(width),
        Number(height),
        format,
        quality / 100,
        limitBytes,
      );
      setResult({
        ...output,
        width: Number(width),
        height: Number(height),
        name: renameExtension(source.file.name, extension(format)),
        limit: limitBytes ? `${limit} ${unit}` : undefined,
        format,
      });
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  const change = result && source ? result.blob.size / source.file.size - 1 : 0;
  return (
    <div className="space-y-6">
      <ImageDrop
        disabled={busy || opening}
        onError={setError}
        current={
          source && {
            title: source.file.name,
            detail: `${source.image.naturalWidth} × ${source.image.naturalHeight} px · ${formatBytes(source.file.size)}`,
          }
        }
        onFiles={(files) => {
          dirty();
          void open(files).then((next) => {
            if (!next) return;
            setWidth(String(next.image.naturalWidth));
            setHeight(String(next.image.naturalHeight));
            setPercent("100");
          });
        }}
      />
      {!source && <ErrorMessage error={error} />}
      {source && natural && (
        <div className={cn("grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]", enter)}>
          <Card className="px-4">
            <fieldset disabled={busy || opening} className="min-w-0 space-y-6">
              <FieldSet className="gap-4">
                <FieldLegend>Size</FieldLegend>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Width (px)"
                    value={width}
                    max={16384}
                    invalid={width !== "" && !isSide(width)}
                    onChange={(value) => changeSide(value, "width")}
                  />
                  <NumberField
                    label="Height (px)"
                    value={height}
                    max={16384}
                    invalid={height !== "" && !isSide(height)}
                    onChange={(value) => changeSide(value, "height")}
                  />
                </div>
                <Field orientation="horizontal">
                  <Checkbox
                    id="resize-lock"
                    checked={locked}
                    onCheckedChange={(value) => {
                      setLocked(value);
                      dirty();
                      if (value && Number(width) > 0)
                        setSize(Number(width), (Number(width) * natural.height) / natural.width);
                    }}
                  />
                  <FieldLabel htmlFor="resize-lock">Keep aspect ratio</FieldLabel>
                </Field>
                <NumberField
                  label="Scale (%)"
                  value={percent}
                  min={1}
                  step={1}
                  onChange={(value) => {
                    setPercent(value);
                    dirty();
                    if (Number(value) > 0)
                      setSize(
                        (natural.width * Number(value)) / 100,
                        (natural.height * Number(value)) / 100,
                      );
                  }}
                />
                <FieldSet className="gap-2">
                  <FieldLegend variant="label">Fit within</FieldLegend>
                  <div className="flex flex-wrap gap-2">
                    {fits.map((fit) => (
                      <Button
                        key={fit.label}
                        variant="outline"
                        size="sm"
                        className="tabular-nums"
                        onClick={() => {
                          dirty();
                          setLocked(true);
                          const scale = Math.min(
                            fit.width / natural.width,
                            fit.height / natural.height,
                          );
                          setSize(natural.width * scale, natural.height * scale);
                        }}
                      >
                        {fit.label}
                      </Button>
                    ))}
                  </div>
                </FieldSet>
              </FieldSet>
              <div className="border-t pt-6">
                <FieldSet className="gap-4">
                  <FieldLegend>Output</FieldLegend>
                  <FormatFields
                    format={format}
                    setFormat={(value) => {
                      setFormat(value);
                      dirty();
                    }}
                    quality={quality}
                    setQuality={(value) => {
                      setQuality(value);
                      dirty();
                    }}
                  />
                  <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-3">
                    <NumberField
                      label="Max file size"
                      value={limit}
                      placeholder="No limit"
                      min={0}
                      step="any"
                      invalid={limitInvalid}
                      hint={
                        limitInvalid
                          ? "Enter a size greater than zero."
                          : format === "png" && limit
                            ? "Choose WebP or JPEG to compress toward a size."
                            : undefined
                      }
                      onChange={(value) => {
                        setLimit(value);
                        dirty();
                      }}
                    />
                    <Choice
                      label="Unit"
                      value={unit}
                      onChange={(value) => {
                        setUnit(value);
                        dirty();
                      }}
                      options={[
                        { value: "KB", label: "KB" },
                        { value: "MB", label: "MB" },
                      ]}
                    />
                  </div>
                </FieldSet>
              </div>
              <Button
                size="lg"
                className="w-full"
                disabled={busy || opening}
                onClick={() => void run()}
              >
                {busy && <ButtonSpinner />}
                {busy
                  ? limitBytes
                    ? `Fitting under ${formatBytes(limitBytes)}…`
                    : "Resizing…"
                  : "Resize"}
              </Button>
            </fieldset>
          </Card>
          <Card ref={preview} className="gap-0 py-0">
            <div className="flex aspect-[4/3] min-h-0 items-center justify-center overflow-hidden bg-muted/50 p-4 sm:p-6">
              <img
                key={result ? resultUrl : url}
                src={(result ? resultUrl : url) || undefined}
                alt={result ? `Resized ${result.name}` : source.file.name}
                className={cn(
                  "max-h-full max-w-full rounded-md object-contain",
                  imageOutline,
                  enter,
                )}
              />
            </div>
            <div className="border-t p-4" aria-live="polite">
              <ErrorMessage error={error} className="mb-4" />
              {result ? (
                <div className={cn("space-y-4", enter)}>
                  <dl className="grid grid-cols-3 gap-4">
                    <Stat label="Dimensions" value={`${result.width} × ${result.height}`}>
                      from {natural.width} × {natural.height}
                    </Stat>
                    <Stat label="File size" value={formatBytes(result.blob.size)}>
                      {change < 0
                        ? `${Math.round(-change * 100)}% smaller`
                        : change > 0
                          ? `${Math.round(change * 100)}% larger`
                          : "Same size"}
                    </Stat>
                    <Stat
                      label="Quality"
                      value={
                        result.format === "png"
                          ? "Lossless"
                          : `${Math.round(result.quality * 100)}%`
                      }
                    >
                      {formatName[result.format]}
                    </Stat>
                  </dl>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {result.limit ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CircleCheck
                          className="size-4 shrink-0 text-foreground"
                          aria-hidden="true"
                        />
                        Under the {result.limit} limit
                      </p>
                    ) : (
                      <span />
                    )}
                    <Button onClick={() => save(result.blob, result.name)}>
                      <Download aria-hidden="true" />
                      Download {formatName[result.format]}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground tabular-nums">
                  Original · {natural.width} × {natural.height} px · {formatBytes(source.file.size)}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-base font-medium tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground tabular-nums">{children}</dd>
    </div>
  );
}
