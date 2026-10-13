import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useHydrated } from "@/lib/use-hydrated";
import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { renameExtension } from "@/lib/files";
import { Check, Choice, ErrorMessage, Pending, Range, enter, saveFile } from "./controls";
import { Studio } from "./studio";
import { disposeModel } from "./models";
import {
  imageCanvas,
  normalMap,
  pngBlob,
  readTexture,
  sampleTexture,
  seamlessTexture,
} from "./texture-processing";

type Source = ReturnType<typeof sampleTexture>;

/** Draws a canvas, or a 3 × 3 repeat of it, at no more than 2048 px a side. */
function CanvasPreview({
  source,
  tiles,
  label,
}: {
  source: HTMLCanvasElement;
  tiles: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const scale = Math.min(1, 2048 / (Math.max(source.width, source.height) * tiles));
    const width = Math.max(1, Math.round(source.width * scale)),
      height = Math.max(1, Math.round(source.height * scale));
    canvas.width = width * tiles;
    canvas.height = height * tiles;
    const context = canvas.getContext("2d")!;
    for (let y = 0; y < tiles; y++)
      for (let x = 0; x < tiles; x++)
        context.drawImage(source, x * width, y * height, width, height);
  }, [source, tiles]);
  return (
    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-muted/30 p-3">
      <canvas
        ref={ref}
        className="max-h-full max-w-full rounded-sm"
        style={{ aspectRatio: `${source.width} / ${source.height}` }}
      >
        {label}
      </canvas>
    </div>
  );
}

export function TextureTool({ mode }: { mode: "normal" | "tile" }) {
  const hydrated = useHydrated();
  const [source, setSource] = useState<Source | null>(null),
    [error, setError] = useState(""),
    [opening, setOpening] = useState<string | null>(null),
    [saving, setSaving] = useState(false);
  const [strength, setStrength] = useState(2),
    [blur, setBlur] = useState(1),
    [invert, setInvert] = useState(false),
    [convention, setConvention] = useState("opengl");
  const [seamless, setSeamless] = useState(false),
    [blend, setBlend] = useState(0.5),
    [shape, setShape] = useState("sphere");
  const [result, setResult] = useState<{
    canvas: HTMLCanvasElement;
    object: THREE.Object3D;
  } | null>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  // The 3D stage swaps to the new object in the same commit, so the old one is never drawn again.
  useEffect(
    () => () => {
      if (result) disposeModel(result.object);
    },
    [result],
  );

  async function open(files: File[]) {
    const file = files[0];
    if (!file) return;
    const current = ++request.current;
    setOpening(file.name);
    setError("");
    try {
      const loaded = await readTexture(file);
      if (current === request.current) setSource(loaded);
    } catch (error) {
      if (current === request.current)
        setError(
          error instanceof Error && error.message.startsWith("Choose")
            ? error.message
            : `Unable to decode ${file.name}. Try a PNG or JPEG.`,
        );
    } finally {
      if (current === request.current) setOpening(null);
    }
  }

  useEffect(() => {
    if (!source) return;
    // Coalesce slider drags into one pass per frame.
    const frame = requestAnimationFrame(() => {
      try {
        const data =
          mode === "normal"
            ? normalMap(source.data, strength, blur, invert, convention === "directx")
            : seamless
              ? seamlessTexture(source.data, blend)
              : source.data;
        const canvas = imageCanvas(data),
          color = new THREE.CanvasTexture(mode === "normal" ? imageCanvas(source.data) : canvas);
        color.colorSpace = THREE.SRGBColorSpace;
        color.wrapS = color.wrapT = THREE.RepeatWrapping;
        color.anisotropy = 8;
        const material = new THREE.MeshStandardMaterial({
          map: color,
          roughness: 0.65,
          metalness: 0.05,
          side: THREE.DoubleSide,
        });
        if (mode === "normal") {
          material.normalMap = new THREE.CanvasTexture(canvas);
          material.normalMap.wrapS = material.normalMap.wrapT = THREE.RepeatWrapping;
          material.normalScale.set(1, convention === "directx" ? -1 : 1);
        } else color.repeat.set(3, 3);
        const geometry =
          mode === "normal"
            ? shape === "sphere"
              ? new THREE.SphereGeometry(1.3, 96, 64)
              : new THREE.PlaneGeometry(2.8, 2.8)
            : new THREE.BoxGeometry(2.2, 2.2, 2.2);
        setResult({ canvas, object: new THREE.Mesh(geometry, material) });
        setError("");
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unable to process this texture.");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [source, mode, strength, blur, invert, convention, seamless, blend, shape]);

  async function download() {
    if (!result || !source) return;
    setSaving(true);
    try {
      saveFile(
        await pngBlob(result.canvas),
        renameExtension(source.name, mode === "normal" ? "normal.png" : "seamless.png"),
        `${result.canvas.width} × ${result.canvas.height}`,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create the PNG.");
    } finally {
      setSaving(false);
    }
  }

  const canDownload = mode === "normal" || seamless;
  return (
    <div className="space-y-6">
      <fieldset disabled={!hydrated} className="min-w-0" data-ready={hydrated}>
        <FileDrop
          accept="image/png,image/jpeg,image/webp,image/avif,image/bmp"
          onFiles={open}
          paste
          title={
            source
              ? "Drop another image"
              : mode === "normal"
                ? "Drop a height map or texture"
                : "Drop a texture"
          }
          hint={
            source
              ? "PNG, JPEG, WebP, AVIF, or BMP"
              : "PNG, JPEG, WebP, AVIF, or BMP. You can also paste."
          }
          compact={!!source}
          className={source ? "max-sm:[&_p]:hidden" : undefined}
        >
          {opening !== null ? (
            <Pending>Decoding {opening}</Pending>
          ) : (
            <Button
              variant="outline"
              disabled={!hydrated}
              onClick={() => {
                request.current++;
                setError("");
                setSource(sampleTexture());
              }}
            >
              Try a sample
            </Button>
          )}
        </FileDrop>
      </fieldset>
      <ErrorMessage error={error} />
      {source && result && (
        <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] ${enter}`}>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <figure className="min-w-0 space-y-2">
              <CanvasPreview
                source={result.canvas}
                tiles={mode === "normal" ? 1 : 3}
                label={mode === "normal" ? "Generated normal map" : "Texture repeated 3 × 3"}
              />
              <figcaption className="text-xs text-muted-foreground">
                {mode === "normal" ? "Normal map" : "Repeated 3 × 3. Seams show as lines."}
              </figcaption>
            </figure>
            <figure className="min-w-0 space-y-2">
              <Studio
                object={result.object}
                movingLight={mode === "normal"}
                className="aspect-square"
              />
              <figcaption className="text-xs text-muted-foreground">
                {mode === "normal" ? "Lit by a moving light. Drag to orbit." : "Drag to orbit."}
              </figcaption>
            </figure>
          </div>
          <div className="space-y-6">
            <div className="min-w-0">
              <p className="truncate font-medium" title={source.name}>
                {source.name}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {source.data.width} × {source.data.height} px
                {source.resized ? ", scaled to fit 2048 px" : ""}
              </p>
            </div>
            <div className="space-y-5">
              {mode === "normal" ? (
                <>
                  <Range
                    label="Strength"
                    value={strength}
                    min={0.1}
                    max={20}
                    step={0.1}
                    format={(value) => value.toFixed(1)}
                    onChange={setStrength}
                  />
                  <Range
                    label="Blur"
                    value={blur}
                    min={0}
                    max={20}
                    format={(value) => `${value} px`}
                    onChange={setBlur}
                  />
                  <Check label="Invert height" value={invert} onChange={setInvert} />
                  <Choice
                    label="Green channel"
                    value={convention}
                    onChange={setConvention}
                    options={[
                      { value: "opengl", label: "OpenGL (+Y), Blender, Unity" },
                      { value: "directx", label: "DirectX (−Y), Unreal" },
                    ]}
                  />
                  <Choice
                    label="Preview shape"
                    value={shape}
                    onChange={setShape}
                    options={[
                      { value: "sphere", label: "Sphere" },
                      { value: "plane", label: "Plane" },
                    ]}
                  />
                </>
              ) : (
                <>
                  <Check
                    label="Make seamless"
                    description="Blends the edges into each other. Strong patterns may ghost."
                    value={seamless}
                    onChange={setSeamless}
                  />
                  {seamless && (
                    <Range
                      label="Blend width"
                      value={blend}
                      min={0.05}
                      max={1}
                      step={0.05}
                      format={(value) => `${Math.round(value * 100)}%`}
                      onChange={setBlend}
                    />
                  )}
                </>
              )}
            </div>
            {canDownload && (
              <Button className="w-full" disabled={saving} onClick={download}>
                {saving ? <Spinner aria-hidden="true" /> : <Download aria-hidden="true" />}
                Download PNG
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
