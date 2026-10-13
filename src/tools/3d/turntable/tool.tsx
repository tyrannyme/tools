import { Download, Video } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useHydrated } from "@/lib/use-hydrated";
import { formatBytes, renameExtension } from "@/lib/files";
import { Check, Choice, ErrorMessage, Range, enter, saveFile } from "../_shared/controls";
import { canRecordMp4, type VideoFormat } from "../_shared/recording";
import { Studio, type StudioHandle } from "../_shared/studio";
import { useModel } from "../_shared/use-model";

interface Recording {
  blob: Blob;
  url: string;
  name: string;
  format: VideoFormat;
  size: number;
  seconds: number;
}

export default function Turntable() {
  const hydrated = useHydrated();
  const [progress, setProgress] = useState<number | null>(null);
  const recording = progress !== null;
  const { model, input, error, setError, busy } = useModel(recording);
  const [format, setFormat] = useState<VideoFormat>("mp4"),
    [mp4, setMp4] = useState(true),
    [duration, setDuration] = useState(6),
    [resolution, setResolution] = useState("1080"),
    [background, setBackground] = useState("#eeeeee"),
    [transparent, setTransparent] = useState(false);
  const [video, setVideo] = useState<Recording | null>(null);
  const studio = useRef<StudioHandle | null>(null),
    abort = useRef<AbortController | null>(null),
    result = useRef<HTMLDivElement>(null),
    colorId = useId(),
    formatId = useId();
  const alpha = transparent && format === "webm";

  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (video) URL.revokeObjectURL(video.url);
    },
    [video],
  );
  // MP4 needs an H.264 encoder. Browsers without one record WebM instead.
  useEffect(() => {
    if (!hydrated) return;
    let current = true;
    void canRecordMp4(Number(resolution)).then((supported) => {
      if (!current) return;
      setMp4(supported);
      if (!supported) setFormat("webm");
    });
    return () => {
      current = false;
    };
  }, [hydrated, resolution]);
  useEffect(() => {
    if (video)
      result.current?.scrollIntoView({
        block: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
  }, [video]);

  async function record() {
    if (!model || !studio.current) return;
    setError("");
    setProgress(0);
    const controller = new AbortController();
    abort.current = controller;
    const size = Number(resolution);
    try {
      const blob = await studio.current.record(size, {
        seconds: duration,
        format,
        transparent: alpha,
        onProgress: setProgress,
        signal: controller.signal,
      });
      if (!controller.signal.aborted)
        setVideo({
          blob,
          url: URL.createObjectURL(blob),
          name: renameExtension(model.name, format),
          format,
          size,
          seconds: duration,
        });
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : "Unable to record this model.");
    } finally {
      setProgress(null);
      abort.current = null;
    }
  }

  return (
    <div className="space-y-6">
      {input}
      <ErrorMessage error={error} />
      {model && (
        <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] ${enter}`}>
          <div className="space-y-2">
            <Studio
              object={model.object}
              handle={studio}
              rotate={!recording}
              background={alpha ? undefined : background}
              className="aspect-square"
            />
            <p className="text-xs text-muted-foreground">
              Drag to orbit. The video always starts from the front.
            </p>
          </div>
          <div className="space-y-6">
            <div className="space-y-5">
              <Field data-disabled={recording}>
                <FieldLabel id={formatId}>Format</FieldLabel>
                <ToggleGroup
                  aria-labelledby={formatId}
                  variant="outline"
                  spacing={0}
                  className="w-full"
                  disabled={recording}
                  value={[format]}
                  onValueChange={(value: string[]) => {
                    if (value[0]) setFormat(value[0] as VideoFormat);
                  }}
                >
                  <ToggleGroupItem value="mp4" disabled={!mp4} className="flex-1">
                    MP4
                  </ToggleGroupItem>
                  <ToggleGroupItem value="webm" className="flex-1">
                    WebM
                  </ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  {mp4
                    ? format === "mp4"
                      ? "Uploads to X, Instagram, and most apps."
                      : "Supports a transparent background. X does not accept WebM."
                    : "This browser cannot encode MP4. Chrome, Edge, and Safari can."}
                </FieldDescription>
              </Field>
              <Choice
                label="Resolution"
                value={resolution}
                onChange={setResolution}
                disabled={recording}
                options={[
                  { value: "720", label: "720 × 720" },
                  { value: "1080", label: "1080 × 1080" },
                ]}
              />
              <Range
                label="Duration"
                value={duration}
                min={2}
                max={30}
                format={(value) => `${value} s`}
                disabled={recording}
                onChange={setDuration}
              />
              <Field data-disabled={recording || alpha}>
                <FieldLabel htmlFor={colorId}>Background</FieldLabel>
                <div className="flex items-center gap-3">
                  <input
                    id={colorId}
                    type="color"
                    value={background}
                    disabled={recording || alpha}
                    onChange={(event) => setBackground(event.target.value)}
                    className="size-8 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                  <span className="font-mono text-sm text-muted-foreground">
                    {alpha ? "None" : background.toUpperCase()}
                  </span>
                </div>
              </Field>
              <Check
                label="Transparent"
                description={format === "mp4" ? "Needs WebM" : undefined}
                value={transparent}
                disabled={recording || format === "mp4"}
                onChange={setTransparent}
              />
            </div>
            {recording ? (
              <div className="space-y-3" aria-live="polite">
                <Progress value={Math.round(progress * 100)}>
                  <ProgressLabel>Rendering</ProgressLabel>
                  <ProgressValue />
                </Progress>
                <Button variant="outline" className="w-full" onClick={() => abort.current?.abort()}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button className="w-full" disabled={busy} onClick={record}>
                <Video aria-hidden="true" />
                Record {format === "mp4" ? "MP4" : "WebM"}
              </Button>
            )}
          </div>
        </div>
      )}
      {video && (
        <div
          ref={result}
          className={`grid items-end gap-4 sm:grid-cols-[minmax(0,24rem)_1fr] ${enter}`}
        >
          {/* A silent generated rotation has no dialogue to caption. */}
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            key={video.url}
            src={video.url}
            controls
            autoPlay={!matchMedia("(prefers-reduced-motion: reduce)").matches}
            muted
            loop
            playsInline
            className="aspect-square w-full rounded-xl border bg-muted/30"
          />
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              {video.format === "mp4" ? "MP4" : "WebM"} · {video.size} × {video.size} ·{" "}
              {video.seconds} s · {formatBytes(video.blob.size)}
            </p>
            <Button onClick={() => saveFile(video.blob, video.name)}>
              <Download aria-hidden="true" />
              Download {video.format === "mp4" ? "MP4" : "WebM"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
