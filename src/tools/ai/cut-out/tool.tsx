import { useState } from "react";
import { Minus, Plus, RotateCcw, Undo2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useVision } from "../_vision/use-vision";
import {
  checkerboard,
  enter,
  ErrorNote,
  fit,
  ImageActions,
  ImageInput,
  ModelNote,
  outline,
  Stage,
  useBlobUrl,
  WorkStatus,
} from "../_vision/ui";
import type { Picked } from "../_vision/ui";
import { composite, dimOutside, trim } from "../_vision/image";
import type { Point } from "../_vision/types";

export default function CutOut() {
  const engine = useVision("cutout");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [points, setPoints] = useState<Point[]>([]),
    [mode, setMode] = useState<0 | 1>(1);
  const [result, setResult] = useState<{ cut: Blob; overlay: Blob } | null>(null),
    [rendering, setRendering] = useState(false);
  // The first point on an image runs the slow image encoder; later points are quick.
  const [analyzed, setAnalyzed] = useState<File | null>(null);
  const file = picked?.file ?? null;
  const before = useBlobUrl(file),
    overlay = useBlobUrl(result?.overlay ?? null),
    cut = useBlobUrl(result?.cut ?? null);
  const busy = engine.busy || rendering;

  async function select(next: Point[]) {
    if (!file || busy) return;
    setPoints(next);
    if (!next.length) {
      setResult(null);
      return;
    }
    try {
      const output = await engine.run({ image: file, points: next });
      setAnalyzed(file);
      if (!output.image) return;
      setRendering(true);
      const [whole, dim] = await Promise.all([
        composite(file, output.image),
        dimOutside(output.image),
      ]);
      setResult({ cut: await trim(whole), overlay: dim });
    } catch (error) {
      if (error instanceof Error && error.message === "Cancelled") setPoints(points);
      else if (!engine.error && error instanceof Error) engine.setError(error.message);
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="space-y-6">
      <ImageInput
        picked={picked}
        sampleFile="doorway.webp"
        disabled={busy}
        onImage={(next) => {
          setPicked(next);
          setPoints([]);
          setResult(null);
          setMode(1);
          engine.setError("");
        }}
      />
      {!picked && <ModelNote engine={engine} className="text-center" />}
      {picked && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-3">
            <Stage>
              <div
                className={cn("relative overflow-hidden rounded-md", outline)}
                style={checkerboard}
              >
                {before && <img src={before} alt="" draggable={false} className={fit} />}
                {overlay && (
                  <img
                    key={overlay}
                    src={overlay}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 size-full animate-in fade-in-0 duration-200"
                  />
                )}
                {points.map((point, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute flex size-5 -translate-1/2 items-center justify-center rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.4)] ring-2 animate-in fade-in-0 duration-150 motion-safe:zoom-in-75",
                      point.label
                        ? "bg-white text-neutral-900 ring-neutral-900/80"
                        : "bg-neutral-900 text-white ring-white/90",
                    )}
                    style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                  >
                    {point.label ? <Plus className="size-3" /> : <Minus className="size-3" />}
                    {busy && i === points.length - 1 && (
                      <span className="absolute -inset-1.5 animate-spin rounded-full border-2 border-white/90 border-t-transparent shadow-[0_0_0_1px_rgb(0_0_0/0.25)]" />
                    )}
                  </span>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  aria-label={
                    mode
                      ? "Add the center of the image to the selection"
                      : "Remove the center of the image from the selection"
                  }
                  className="absolute inset-0 cursor-crosshair rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-progress"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const keyboard = event.detail === 0;
                    const x = keyboard ? 0.5 : (event.clientX - rect.left) / rect.width,
                      y = keyboard ? 0.5 : (event.clientY - rect.top) / rect.height;
                    void select([...points, { x, y, label: event.shiftKey ? 0 : mode }]);
                  }}
                />
              </div>
            </Stage>
            <p className="text-center text-sm text-pretty text-muted-foreground">
              {points.length
                ? "Add points to grow the selection. Shift-click removes an area."
                : "Click the object you want to cut out."}
            </p>
          </div>
          <div className="space-y-5">
            <Field>
              <FieldLabel id="cutout-mode">Next point</FieldLabel>
              <div className="flex gap-2">
                <ToggleGroup
                  variant="outline"
                  spacing={0}
                  aria-labelledby="cutout-mode"
                  value={[String(mode)]}
                  onValueChange={(next: string[]) => {
                    if (next[0]) setMode(Number(next[0]) as 0 | 1);
                  }}
                  className="flex-1"
                >
                  <ToggleGroupItem value="1" className="flex-1">
                    <Plus aria-hidden="true" />
                    Add
                  </ToggleGroupItem>
                  <ToggleGroupItem value="0" className="flex-1" disabled={!points.length}>
                    <Minus aria-hidden="true" />
                    Remove
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Undo last point"
                  disabled={busy || !points.length}
                  onClick={() => void select(points.slice(0, -1))}
                >
                  <Undo2 aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Clear all points"
                  disabled={busy || !points.length}
                  onClick={() => {
                    setPoints([]);
                    setResult(null);
                    setMode(1);
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                </Button>
              </div>
            </Field>
            <WorkStatus
              engine={engine}
              estimate={false}
              working={analyzed === file ? "Updating the selection" : "Analyzing the image"}
            />
            <ErrorNote message={engine.error} />
            {cut && (
              <div className={cn("space-y-3", enter)}>
                <div
                  className={cn("flex h-40 items-center justify-center rounded-lg border p-3")}
                  style={checkerboard}
                >
                  <img
                    src={cut}
                    alt="Cut-out object"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <ImageActions
                  blob={result?.cut ?? null}
                  filename={picked.file.name}
                  suffix="cutout"
                  disabled={busy}
                />
              </div>
            )}
            <ModelNote engine={engine} />
          </div>
        </div>
      )}
    </div>
  );
}
