import { Copy, Download, Droplet, Grid3x3, Plus, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { renameExtension } from "@/lib/files";
import { ButtonSpinner, ErrorMessage, ImageDrop, enter, save, useImage } from "../_shared/controls";
import { encode, message } from "../_shared/image";
import { renderRedactions } from "./render";
import type { Mode, Region } from "./render";

type Gesture = {
  kind: "draw" | "move" | "resize";
  startX: number;
  startY: number;
  region: Region;
};

const modes: { value: Mode; label: string; icon: typeof Square }[] = [
  { value: "blackout", label: "Black out", icon: Square },
  { value: "pixelate", label: "Pixelate", icon: Grid3x3 },
  { value: "blur", label: "Blur", icon: Droplet },
];
const modeName = (mode: Mode) => modes.find((item) => item.value === mode)!.label.toLowerCase();

export default function RedactTool() {
  const { source, open, error, setError, busy: opening } = useImage();
  const [mode, setMode] = useState<Mode>("blackout");
  const [regions, setRegions] = useState<Region[]>([]);
  const [draft, setDraft] = useState<Region | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [exporting, setExporting] = useState<"copy" | "download" | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const nextId = useRef(1);
  const busy = exporting !== null;
  const visible = draft ? [...regions.filter((region) => region.id !== draft.id), draft] : regions;

  useEffect(() => {
    if (!source || !canvasRef.current) return;
    try {
      const drawn = renderRedactions(source.image, visible, 1600);
      const canvas = canvasRef.current;
      canvas.width = drawn.width;
      canvas.height = drawn.height;
      canvas.getContext("2d")?.drawImage(drawn, 0, 0);
    } catch (error) {
      setError(message(error));
    }
    // `visible` is derived from these two.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [source, regions, draft, setError]);

  function point(event: PointerEvent) {
    const bounds = stageRef.current!.getBoundingClientRect();
    const { naturalWidth: width, naturalHeight: height } = source!.image;
    return {
      x: Math.max(0, Math.min(width, ((event.clientX - bounds.left) / bounds.width) * width)),
      y: Math.max(0, Math.min(height, ((event.clientY - bounds.top) / bounds.height) * height)),
    };
  }
  function start(event: PointerEvent, kind: Gesture["kind"], existing?: Region) {
    if (!source || busy || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const { x, y } = point(event);
    const region = existing ?? { id: nextId.current++, x, y, width: 0, height: 0, mode };
    gesture.current = { kind, startX: x, startY: y, region };
    setSelected(region.id);
    if (existing) setMode(existing.mode);
    setDraft(region);
    stageRef.current!.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    const active = gesture.current;
    if (!active || !source) return;
    const { x, y } = point(event);
    const { region, startX, startY } = active;
    const { naturalWidth: width, naturalHeight: height } = source.image;
    if (active.kind === "move")
      setDraft({
        ...region,
        x: Math.max(0, Math.min(width - region.width, region.x + x - startX)),
        y: Math.max(0, Math.min(height - region.height, region.y + y - startY)),
      });
    else if (active.kind === "resize")
      setDraft({
        ...region,
        width: Math.max(4, Math.min(width - region.x, region.width + x - startX)),
        height: Math.max(4, Math.min(height - region.y, region.height + y - startY)),
      });
    else
      setDraft({
        ...region,
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        width: Math.abs(x - startX),
        height: Math.abs(y - startY),
      });
  }
  function finish() {
    const active = gesture.current;
    gesture.current = null;
    if (!active) return;
    if (draft && draft.width >= 4 && draft.height >= 4)
      setRegions((current) => [...current.filter((region) => region.id !== draft.id), draft]);
    else if (active.kind === "draw") setSelected(null);
    setDraft(null);
  }
  function remove(id: number | null) {
    setRegions((current) => current.filter((region) => region.id !== id));
    setSelected(null);
  }
  function nudge(event: KeyboardEvent, region: Region) {
    if (!source) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove(region.id);
      return;
    }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const { naturalWidth: width, naturalHeight: height } = source.image;
    setRegions((current) =>
      current.map((item) =>
        item.id !== region.id
          ? item
          : event.altKey
            ? {
                ...item,
                width: Math.max(4, Math.min(width - item.x, item.width + delta[0]! * step)),
                height: Math.max(4, Math.min(height - item.y, item.height + delta[1]! * step)),
              }
            : {
                ...item,
                x: Math.max(0, Math.min(width - item.width, item.x + delta[0]! * step)),
                y: Math.max(0, Math.min(height - item.height, item.y + delta[1]! * step)),
              },
      ),
    );
  }
  async function render() {
    return encode(renderRedactions(source!.image, regions), "png", 1);
  }
  async function exportAs(kind: "copy" | "download") {
    if (!source) return;
    setExporting(kind);
    setError("");
    try {
      if (kind === "download")
        save(await render(), renameExtension(source.file.name, "redacted.png"));
      else {
        if (typeof ClipboardItem === "undefined")
          throw new Error("This browser cannot copy images. Download the PNG instead.");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": render() })]);
        toast.success("Copied redacted image");
      }
    } catch (error) {
      setError(
        kind === "copy" && error instanceof DOMException
          ? "Your browser blocked copying the image. Download the PNG instead."
          : message(error),
      );
    } finally {
      setExporting(null);
    }
  }

  const selectedRegion = regions.find((region) => region.id === selected);
  return (
    <div className="space-y-5">
      <ImageDrop
        paste
        disabled={busy || opening}
        onError={setError}
        current={
          source && {
            title: source.file.name,
            detail: `${source.image.naturalWidth} × ${source.image.naturalHeight} px`,
          }
        }
        onFiles={(files) => {
          void open(files).then((next) => {
            if (!next) return;
            setRegions([]);
            setDraft(null);
            setSelected(null);
            gesture.current = null;
          });
        }}
      />
      <ErrorMessage error={error} />
      {source && (
        <div className={cn("space-y-4", enter)}>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              variant="outline"
              spacing={0}
              aria-label="Redaction style"
              value={[mode]}
              disabled={busy}
              onValueChange={(next: string[]) => {
                const value = next[0] as Mode | undefined;
                if (!value) return;
                setMode(value);
                setRegions((current) =>
                  current.map((region) =>
                    region.id === selected ? { ...region, mode: value } : region,
                  ),
                );
              }}
            >
              {modes.map(({ value, label, icon: Icon }) => (
                <ToggleGroupItem key={value} value={value} className="px-3">
                  <Icon aria-hidden="true" />
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                const { naturalWidth: width, naturalHeight: height } = source.image;
                const region = {
                  id: nextId.current++,
                  x: width * 0.3,
                  y: height * 0.4,
                  width: width * 0.4,
                  height: height * 0.2,
                  mode,
                };
                setRegions((current) => [...current, region]);
                setSelected(region.id);
              }}
            >
              <Plus aria-hidden="true" />
              Add box
            </Button>
            <Button
              variant="outline"
              disabled={!selectedRegion || busy}
              onClick={() => remove(selected)}
            >
              <Trash2 aria-hidden="true" />
              Delete box
            </Button>
            <Button
              variant="ghost"
              disabled={!regions.length || busy}
              onClick={() => {
                setRegions([]);
                setSelected(null);
              }}
            >
              Clear all
            </Button>
          </div>
          <div
            ref={stageRef}
            className="relative mx-auto w-full cursor-crosshair touch-none overflow-hidden rounded-lg border bg-muted select-none"
            style={{
              maxWidth: `min(100%, ${(70 * source.image.naturalWidth) / source.image.naturalHeight}vh)`,
            }}
            onPointerDown={(event) => start(event, "draw")}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={() => {
              gesture.current = null;
              setDraft(null);
            }}
          >
            <canvas ref={canvasRef} className="block h-auto w-full" aria-label="Redacted preview" />
            {visible.map((region, index) => {
              const active = selected === region.id;
              return (
                <div
                  key={region.id}
                  className="absolute"
                  style={{
                    left: `${(region.x / source.image.naturalWidth) * 100}%`,
                    top: `${(region.y / source.image.naturalHeight) * 100}%`,
                    width: `${(region.width / source.image.naturalWidth) * 100}%`,
                    height: `${(region.height / source.image.naturalHeight) * 100}%`,
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Box ${index + 1}, ${modeName(region.mode)}. Arrow keys move it, Alt with arrow keys resizes it, Delete removes it.`}
                    aria-pressed={active}
                    onFocus={() => {
                      setSelected(region.id);
                      setMode(region.mode);
                    }}
                    className={cn(
                      "absolute inset-0 cursor-move outline-none focus-visible:ring-3 focus-visible:ring-ring/70",
                      active
                        ? "shadow-[0_0_0_1px_white,0_0_0_2px_black]"
                        : "shadow-[0_0_0_1px_rgb(255_255_255/0.6)] hover:shadow-[0_0_0_1px_white,0_0_0_2px_rgb(0_0_0/0.6)]",
                    )}
                    onPointerDown={(event) => start(event, "move", region)}
                    onKeyDown={(event) => nudge(event, region)}
                  />
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize rounded-full border-2 border-black bg-white shadow-sm"
                      onPointerDown={(event) => start(event, "resize", region)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-prose text-sm text-muted-foreground">
              {regions.length
                ? "Drag a box to move it, or its corner to resize it. Black out is safest for text, since blur and pixelation can sometimes be reversed."
                : "Drag across the image to cover an area."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy || !regions.length}
                onClick={() => void exportAs("copy")}
              >
                {exporting === "copy" ? <ButtonSpinner /> : <Copy aria-hidden="true" />}
                Copy
              </Button>
              <Button disabled={busy || !regions.length} onClick={() => void exportAs("download")}>
                {exporting === "download" ? <ButtonSpinner /> : <Download aria-hidden="true" />}
                Download PNG
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
