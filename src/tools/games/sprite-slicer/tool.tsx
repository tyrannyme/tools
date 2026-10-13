import { ChevronLeft, ChevronRight, Download, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { zipSync } from "fflate";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { downloadBlob } from "@/lib/files";
import { ErrorMessage, NumberField, Segmented } from "../_shared/controls";
import { canvas2d, checkerboard, png, useLocalImage } from "../_shared/images";
import { ImagePicker } from "../_shared/source";

const plural = new Intl.PluralRules("en");
interface Grid {
  width: number;
  height: number;
  padding: number;
  offsetX: number;
  offsetY: number;
  countX: number;
}
/** Top-left corner of a frame on the sheet, counting left to right, then down. */
function cellAt(grid: Grid, index: number) {
  return {
    x: grid.offsetX + (index % grid.countX) * (grid.width + grid.padding),
    y: grid.offsetY + Math.floor(index / grid.countX) * (grid.height + grid.padding),
  };
}
const frames = (count: number) => `${count} ${plural.select(count) === "one" ? "frame" : "frames"}`;

export default function SpriteSlicerTool() {
  const { source, load, clear, loading, error, setError } = useLocalImage();
  const [mode, setMode] = useState("size");
  const [frameWidth, setFrameWidth] = useState(16);
  const [frameHeight, setFrameHeight] = useState(16);
  const [columns, setColumns] = useState(4);
  const [rows, setRows] = useState(1);
  const [padding, setPadding] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [fps, setFps] = useState(8);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const sheet = useRef<HTMLCanvasElement>(null);
  const busy = progress !== null;
  const availableWidth = (source?.image.width ?? 0) - offsetX;
  const availableHeight = (source?.image.height ?? 0) - offsetY;
  const width = mode === "size" ? frameWidth : (availableWidth - (columns - 1) * padding) / columns;
  const height = mode === "size" ? frameHeight : (availableHeight - (rows - 1) * padding) / rows;
  const countX =
    mode === "size" ? Math.floor((availableWidth + padding) / (width + padding)) : columns;
  const countY =
    mode === "size" ? Math.floor((availableHeight + padding) / (height + padding)) : rows;
  const count = countX * countY;
  const invalid = source
    ? width <= 0 || height <= 0 || countX <= 0 || countY <= 0
      ? `No ${width > 0 && height > 0 ? `${width} × ${height} ` : ""}frame fits in this ${source.image.width} × ${source.image.height} sheet. Reduce the frame size or offsets.`
      : !Number.isInteger(width) || !Number.isInteger(height)
        ? `That grid gives frames of ${+width.toFixed(2)} × ${+height.toFixed(2)} px. Adjust rows, columns, gap, or offsets so they divide evenly.`
        : count > 512
          ? `This grid has ${count} frames. Use larger frames to stay within 512.`
          : ""
    : "";
  const current = Math.min(frame, Math.max(0, count - 1));
  const grid: Grid = { width, height, padding, offsetX, offsetY, countX };
  // Show small frames at a whole-number zoom so pixels stay square.
  const zoom = invalid ? 1 : Math.max(1, Math.floor(256 / Math.max(width, height)));
  const sheetZoom = source
    ? Math.min(
        8,
        Math.max(1, Math.floor(960 / source.image.width)),
        Math.max(1, Math.floor(4096 / source.image.height)),
      )
    : 1;

  useEffect(() => {
    if (!playing || invalid || count < 2) return;
    const timer = window.setInterval(() => setFrame((value) => (value + 1) % count), 1000 / fps);
    return () => window.clearInterval(timer);
  }, [playing, invalid, count, fps]);

  useEffect(() => {
    const canvas = preview.current;
    if (!source || !canvas || invalid) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const { x, y } = cellAt({ width, height, padding, offsetX, offsetY, countX }, current);
    context?.drawImage(source.image, x, y, width, height, 0, 0, width, height);
  }, [source, invalid, width, height, padding, offsetX, offsetY, countX, current]);

  useEffect(() => {
    const canvas = sheet.current;
    if (!source || !canvas) return;
    const z = sheetZoom;
    canvas.width = source.image.width * z;
    canvas.height = source.image.height * z;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
    if (invalid) return;
    const grid = { width, height, padding, offsetX, offsetY, countX };
    context.lineWidth = 1;
    for (let index = 0; index < count; index++) {
      const { x, y } = cellAt(grid, index);
      context.strokeStyle = "rgb(0 0 0 / 0.55)";
      context.strokeRect(x * z + 0.5, y * z + 0.5, width * z - 1, height * z - 1);
      context.strokeStyle = "rgb(255 255 255 / 0.55)";
      context.strokeRect(x * z + 1.5, y * z + 1.5, width * z - 3, height * z - 3);
    }
    const { x, y } = cellAt(grid, current);
    context.lineWidth = 2;
    context.strokeStyle = "#000";
    context.strokeRect(x * z + 1, y * z + 1, width * z - 2, height * z - 2);
    context.strokeStyle = "#fff";
    context.strokeRect(x * z + 3, y * z + 3, width * z - 6, height * z - 6);
  }, [
    source,
    invalid,
    width,
    height,
    padding,
    offsetX,
    offsetY,
    countX,
    count,
    current,
    sheetZoom,
  ]);

  function open(file: File) {
    void load(file).then((next) => {
      if (!next) return;
      setFrame(0);
      setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    });
  }

  function pick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!source || invalid) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * source.image.width - offsetX;
    const y = ((event.clientY - rect.top) / rect.height) * source.image.height - offsetY;
    const column = Math.floor(x / (width + padding));
    const row = Math.floor(y / (height + padding));
    if (column < 0 || row < 0 || column >= countX || row >= countY) return;
    setPlaying(false);
    setFrame(row * countX + column);
  }

  async function download() {
    if (!source || invalid) return;
    setError("");
    setProgress(0);
    try {
      const files: Record<string, Uint8Array> = {};
      const { canvas, context } = canvas2d(width, height);
      const base = source.name.replace(/\.[^.]+$/, "");
      for (let index = 0; index < count; index++) {
        const { x, y } = cellAt(grid, index);
        context.clearRect(0, 0, width, height);
        context.drawImage(source.image, x, y, width, height, 0, 0, width, height);
        files[`${base}-${String(index + 1).padStart(3, "0")}.png`] = new Uint8Array(
          await (await png(canvas)).arrayBuffer(),
        );
        setProgress(index + 1);
      }
      const name = `${base}-frames.zip`;
      downloadBlob(
        new Blob([new Uint8Array(zipSync(files, { level: 0 }))], { type: "application/zip" }),
        name,
      );
      toast.success(`Downloaded ${name}`, { description: frames(count) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export the frames.");
    } finally {
      setProgress(null);
    }
  }

  const ready = !!source && !invalid;
  return (
    <div className="space-y-6">
      <ImagePicker
        source={source}
        loading={loading}
        error={error}
        title="Choose a sprite sheet"
        hint="Frames are read left to right, then top to bottom."
        onFile={open}
        onRemove={() => {
          setPlaying(false);
          clear();
        }}
      />
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-6">
          <fieldset disabled={busy} className="space-y-6">
            <Segmented
              label="Grid by"
              value={mode}
              onChange={setMode}
              options={[
                { value: "size", label: "Frame size" },
                { value: "count", label: "Rows and columns" },
              ]}
            />
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {mode === "size" ? (
                <>
                  <NumberField label="Width (px)" value={frameWidth} onChange={setFrameWidth} />
                  <NumberField label="Height (px)" value={frameHeight} onChange={setFrameHeight} />
                </>
              ) : (
                <>
                  <NumberField label="Columns" value={columns} onChange={setColumns} max={512} />
                  <NumberField label="Rows" value={rows} onChange={setRows} max={512} />
                </>
              )}
              <NumberField label="Offset X (px)" value={offsetX} onChange={setOffsetX} min={0} />
              <NumberField label="Offset Y (px)" value={offsetY} onChange={setOffsetY} min={0} />
              <NumberField label="Gap (px)" value={padding} onChange={setPadding} min={0} />
            </div>
          </fieldset>
          <Button className="w-full" disabled={!ready || busy} onClick={download}>
            {busy ? <Spinner /> : <Download aria-hidden="true" />}
            {busy ? `Exporting ${progress} of ${count}…` : "Download frames as ZIP"}
          </Button>
        </div>
        <div className="min-w-0 space-y-6">
          {source ? (
            <>
              <div
                key={source.url}
                className="overflow-hidden rounded-xl border duration-200 animate-in fade-in-0"
              >
                <div
                  className="flex min-h-72 items-center justify-center overflow-auto p-6"
                  style={checkerboard}
                >
                  {invalid ? (
                    <div className="max-w-sm rounded-lg bg-background/90 px-4 py-3 text-center text-sm text-balance">
                      <ErrorMessage>{invalid}</ErrorMessage>
                    </div>
                  ) : (
                    <canvas
                      ref={preview}
                      aria-label={`Frame ${current + 1} of ${count}`}
                      className="h-auto max-w-full [image-rendering:pixelated]"
                      style={{ width: width * zoom }}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-card px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Previous frame"
                      disabled={!ready || count < 2}
                      onClick={() => {
                        setPlaying(false);
                        setFrame((current - 1 + count) % count);
                      }}
                    >
                      <ChevronLeft aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      className="w-20"
                      disabled={!ready || count < 2}
                      onClick={() => setPlaying((value) => !value)}
                    >
                      {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                      {playing ? "Pause" : "Play"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Next frame"
                      disabled={!ready || count < 2}
                      onClick={() => {
                        setPlaying(false);
                        setFrame((current + 1) % count);
                      }}
                    >
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </div>
                  {ready && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {current + 1} / {count}
                    </span>
                  )}
                  <div className="ml-auto">
                    <NumberField label="FPS" value={fps} onChange={setFps} max={60} inline />
                  </div>
                </div>
              </div>
              <figure className="space-y-2">
                <div
                  className="flex max-h-[32rem] overflow-auto overscroll-contain rounded-xl border p-3"
                  style={checkerboard}
                >
                  <canvas
                    ref={sheet}
                    onClick={pick}
                    aria-label="Sprite sheet with the frame grid drawn over it"
                    className="m-auto block h-auto max-w-full cursor-pointer [image-rendering:pixelated]"
                    style={{ width: source.image.width * sheetZoom }}
                  />
                </div>
                {ready && (
                  <figcaption className="text-sm text-muted-foreground tabular-nums">
                    {frames(count)} of {width} × {height} px. Click a frame to inspect it.
                  </figcaption>
                )}
              </figure>
            </>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-balance text-muted-foreground">
              The animation and the frame grid appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
