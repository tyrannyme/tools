import { ArrowRight, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { downloadBlob } from "@/lib/files";
import { ErrorMessage, NumberField, Segmented } from "../_shared/controls";
import { canvas2d, checkerboard, png, useLocalImage } from "../_shared/images";
import { ImagePicker } from "../_shared/source";

/** The largest block size every color edge lines up with, so 1 means "not upscaled". */
function detectSize(image: HTMLImageElement) {
  const { canvas, context } = canvas2d(image.width, image.height);
  context.drawImage(image, 0, 0);
  const pixels = new Uint32Array(
    context.getImageData(0, 0, canvas.width, canvas.height).data.buffer,
  );
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  let size = gcd(image.width, image.height);
  let edges = 0;
  for (let y = 0; y < image.height && size > 1; y++)
    for (let x = 0; x < image.width && size > 1; x++) {
      const index = y * image.width + x;
      if (x > 0 && pixels[index] !== pixels[index - 1]) {
        size = gcd(size, x);
        edges++;
      }
      if (y > 0 && pixels[index] !== pixels[index - image.width]) {
        size = gcd(size, y);
        edges++;
      }
    }
  return edges ? size : 1;
}

export default function PixelScaleTool() {
  const { source, load, clear, loading, error, setError } = useLocalImage();
  const [factor, setFactor] = useState(4);
  const [direction, setDirection] = useState("up");
  const [grid, setGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState(1);
  const preview = useRef<HTMLCanvasElement>(null);
  const up = direction === "up";
  const width = source ? (up ? source.image.width * factor : source.image.width / factor) : 0;
  const height = source ? (up ? source.image.height * factor : source.image.height / factor) : 0;
  const invalid =
    !!source &&
    (!Number.isInteger(width) || !Number.isInteger(height)
      ? `${source.image.width} × ${source.image.height} does not divide evenly by ${factor}. Pick a factor that divides both sides.`
      : width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16_777_216
        ? "The result would be too large. Keep it within 8192 pixels per side and 16 million pixels total."
        : "");
  useEffect(() => {
    const canvas = preview.current;
    if (!source || !canvas || invalid) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context) {
      context.imageSmoothingEnabled = false;
      context.drawImage(source.image, 0, 0, width, height);
    }
  }, [source, width, height, invalid]);
  const restorable =
    !!source && detected > 1 && detected <= 64 && !(direction === "down" && factor === detected);
  async function download() {
    if (!preview.current || !source) return;
    setBusy(true);
    setError("");
    try {
      const name = `${source.name.replace(/\.[^.]+$/, "")}-${width}x${height}.png`;
      downloadBlob(await png(preview.current), name);
      toast.success(`Downloaded ${name}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export this image.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <ImagePicker
        source={source}
        loading={loading}
        error={error}
        title="Choose pixel art"
        hint="PNG, WebP, GIF, BMP, or JPEG. Transparency is kept."
        onRemove={clear}
        onFile={(file) =>
          void load(file).then((next) => {
            if (!next) return;
            try {
              setDetected(detectSize(next.image));
            } catch {
              setDetected(1);
            }
          })
        }
      />
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-6">
          <Segmented
            label="Scale"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "up", label: "Up" },
              { value: "down", label: "Down" },
            ]}
          />
          <NumberField label="Factor" value={factor} onChange={setFactor} max={64} />
          {up && (
            <Field orientation="horizontal">
              <Checkbox id="pixel-grid" checked={grid} onCheckedChange={setGrid} />
              <FieldLabel htmlFor="pixel-grid">Show pixel grid</FieldLabel>
            </Field>
          )}
          {restorable && source && (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border bg-muted/40 py-2 pr-2 pl-3 text-sm">
              <p>This image looks upscaled {detected}×.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFactor(detected);
                  setDirection("down");
                }}
              >
                Restore {source.image.width / detected} × {source.image.height / detected}
              </Button>
            </div>
          )}
          <Button className="w-full" disabled={!source || !!invalid || busy} onClick={download}>
            {busy ? <Spinner /> : <Download aria-hidden="true" />}
            {busy ? "Exporting…" : "Download PNG"}
          </Button>
        </div>
        <div className="min-w-0 space-y-3">
          <div
            className="flex max-h-[36rem] min-h-72 overflow-auto overscroll-contain rounded-xl border"
            style={checkerboard}
          >
            {source && !invalid ? (
              <div
                key={source.url}
                className="relative m-auto p-6 duration-200 animate-in fade-in-0 motion-safe:zoom-in-95"
              >
                <canvas
                  ref={preview}
                  aria-label={`Scaled image, ${width} × ${height} pixels`}
                  className="block [image-rendering:pixelated]"
                />
                {grid && up && factor > 2 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-6"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, #80808066 1px, transparent 1px), linear-gradient(to bottom, #80808066 1px, transparent 1px)",
                      backgroundSize: `${factor}px ${factor}px`,
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="m-auto max-w-sm rounded-lg bg-background/90 px-4 py-3 text-center text-sm text-balance">
                {invalid ? (
                  <ErrorMessage>{invalid}</ErrorMessage>
                ) : (
                  <p className="text-muted-foreground">
                    The result appears here at its exact exported size.
                  </p>
                )}
              </div>
            )}
          </div>
          {source && !invalid && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
              {source.image.width} × {source.image.height}
              <ArrowRight className="size-3.5" aria-label="to" />
              <span className="font-medium text-foreground">
                {width} × {height} px
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
