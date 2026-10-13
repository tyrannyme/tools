import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clapperboard, Layers, Pause, Play } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { downloadBlob } from "@/lib/files";
import { useVision } from "../_vision/use-vision";
import {
  enter,
  ErrorNote,
  fit,
  ImageInput,
  ModelNote,
  Range,
  Stage,
  WorkStatus,
  useBlobUrl,
  BusyIcon,
} from "../_vision/ui";
import type { Picked } from "../_vision/ui";
import type { DepthScene } from "./scene";

const stem = (name: string) => name.replace(/\.[^.]+$/, "");

export default function DepthPhoto() {
  const engine = useVision("depth");
  const [picked, setPicked] = useState<Picked | null>(null),
    [depth, setDepth] = useState<Blob | null>(null);
  const [ready, setReady] = useState(false),
    [sceneError, setSceneError] = useState("");
  const [strength, setStrength] = useState(1),
    [playing, setPlaying] = useState(true);
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<DepthScene | null>(null),
    pointer = useRef<{ x: number; y: number } | null>(null),
    abort = useRef<AbortController | null>(null);
  // The render loop reads these without restarting.
  const live = useRef({ strength, playing, exporting: false });
  useEffect(() => {
    live.current.strength = strength;
    live.current.playing = playing;
  }, [strength, playing]);
  const file = picked?.file ?? null;
  const photoUrl = useBlobUrl(file);

  useEffect(() => {
    if (!file || !depth || !canvas.current) return;
    let stale = false,
      frame = 0;
    const element = canvas.current;
    void import("./scene")
      .then(async ({ createDepthScene, orbit }) => {
        const created = await createDepthScene(element, file, depth);
        if (stale) {
          created.dispose();
          return;
        }
        scene.current = created;
        // Autoplay only when the device allows motion. The pointer always works.
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        live.current.playing = !still;
        setPlaying(!still);
        setReady(true);
        let x = 0,
          y = 0,
          clock = 0,
          previous = performance.now();
        const draw = (time: number) => {
          if (stale) return;
          const dt = Math.min(time - previous, 50);
          previous = time;
          if (!live.current.exporting && !document.hidden) {
            if (live.current.playing && !pointer.current) clock += dt / 1000;
            const target =
              pointer.current ?? (live.current.playing ? orbit(clock) : { x: 0, y: 0 });
            // Ease toward the target so pointer moves feel weighted, not twitchy.
            const blend = 1 - Math.exp(-dt / 120);
            x += (target.x - x) * blend;
            y += (target.y - y) * blend;
            created.render(x, y, live.current.strength);
          }
          frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      })
      .catch((error: unknown) => {
        if (!stale)
          setSceneError(
            error instanceof Error ? error.message : "The 3D preview could not start. Try again.",
          );
      });
    return () => {
      stale = true;
      abort.current?.abort();
      cancelAnimationFrame(frame);
      scene.current?.dispose();
      scene.current = null;
    };
  }, [file, depth]);

  async function estimate() {
    if (!file) return;
    setSceneError("");
    try {
      const output = await engine.run({ image: file });
      if (output.image) setDepth(output.image);
    } catch {
      /* WorkStatus reports the error. */
    }
  }

  async function exportVideo() {
    if (!scene.current || !file) return;
    const controller = new AbortController();
    abort.current = controller;
    live.current.exporting = true;
    setExporting({ done: 0, total: 1 });
    setSceneError("");
    try {
      const { exportLoop } = await import("./scene");
      const blob = await exportLoop(scene.current, strength, controller.signal, (done, total) =>
        setExporting({ done, total }),
      );
      const name = `${stem(file.name)}-3d.mp4`;
      downloadBlob(blob, name);
      toast.success(`Saved ${name}`);
    } catch (error) {
      if (!controller.signal.aborted)
        setSceneError(error instanceof Error ? error.message : "The video could not be made.");
    } finally {
      live.current.exporting = false;
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <ImageInput
        picked={picked}
        sampleFile="doorway.webp"
        disabled={engine.busy || !!exporting}
        onImage={(next) => {
          setPicked(next);
          setDepth(null);
          setReady(false);
          setSceneError("");
          engine.setError("");
        }}
      />
      {!picked && <ModelNote engine={engine} className="text-center" />}
      {picked && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-3">
            <Stage className="border-neutral-800 bg-neutral-950 sm:p-8">
              {/* Horizontal drags look around on touch screens; vertical drags still scroll. */}
              <div
                className="relative touch-pan-y overflow-hidden rounded-md"
                onPointerMove={(event) => {
                  if (!ready) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  pointer.current = {
                    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    y: 1 - ((event.clientY - rect.top) / rect.height) * 2,
                  };
                }}
                onPointerLeave={() => {
                  pointer.current = null;
                }}
                onPointerUp={(event) => {
                  if (event.pointerType === "touch") pointer.current = null;
                }}
                onPointerCancel={() => {
                  pointer.current = null;
                }}
              >
                {photoUrl && (
                  <img src={photoUrl} alt="Original" className={cn(fit, ready && "opacity-0")} />
                )}
                {depth && (
                  <canvas
                    ref={canvas}
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 size-full transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                      ready ? "opacity-100" : "opacity-0",
                    )}
                  />
                )}
              </div>
            </Stage>
            {ready && (
              <p className={cn("text-center text-sm text-muted-foreground", enter)}>
                <span className="pointer-coarse:hidden">
                  Move your pointer across the photo to look around.
                </span>
                <span className="hidden pointer-coarse:inline">
                  Drag sideways across the photo to look around.
                </span>
              </p>
            )}
          </div>
          <div className="space-y-5">
            {!depth ? (
              <>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={engine.busy}
                  onClick={() => void estimate()}
                >
                  {engine.busy ? <BusyIcon /> : <Layers aria-hidden="true" />}
                  Create 3D photo
                </Button>
                <WorkStatus engine={engine} working="Estimating depth" />
                <ErrorNote message={engine.error} />
              </>
            ) : (
              <div className={cn("space-y-5", enter)}>
                <Range
                  label="Depth"
                  min={0.4}
                  max={2}
                  step={0.1}
                  value={strength}
                  format={(value) => `${Math.round(value * 100)}%`}
                  disabled={!ready || !!exporting}
                  onChange={setStrength}
                />
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      className="flex-1"
                      disabled={!ready || !!exporting}
                      onClick={() => void exportVideo()}
                    >
                      {exporting ? <BusyIcon /> : <Clapperboard aria-hidden="true" />}
                      Download video
                    </Button>
                    <Button
                      size="icon-lg"
                      variant="outline"
                      disabled={!ready || !!exporting}
                      aria-label={playing ? "Pause motion" : "Play motion"}
                      onClick={() => setPlaying((value) => !value)}
                    >
                      {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                    </Button>
                  </div>
                  {exporting ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                        <span aria-live="polite">
                          Encoding frame {exporting.done} of {exporting.total}
                        </span>
                        <Button variant="ghost" size="xs" onClick={() => abort.current?.abort()}>
                          Cancel
                        </Button>
                      </div>
                      <Progress
                        aria-label="Encoding video"
                        value={(exporting.done / exporting.total) * 100}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">MP4, a seamless 6-second loop.</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!!exporting}
                  onClick={() => {
                    const name = `${stem(picked.file.name)}-depth.png`;
                    downloadBlob(depth, name);
                    toast.success(`Saved ${name}`);
                  }}
                >
                  Download depth map
                </Button>
              </div>
            )}
            {depth && !ready && !sceneError && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <BusyIcon />
                Building the 3D view
              </p>
            )}
            <ErrorNote message={sceneError} />
            <ModelNote engine={engine} />
          </div>
        </div>
      )}
    </div>
  );
}
