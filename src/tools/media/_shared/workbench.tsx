/* User-selected media has no supplied caption track. */
/* eslint-disable jsx-a11y/media-has-caption */
import { useEffect, useRef, useState } from "react";
import { CircleAlert, Download, Play, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { FileDrop } from "@/components/file-drop";
import { SampleButton } from "@/components/sample-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useHydrated } from "@/lib/use-hydrated";
import { downloadBlob, formatBytes } from "@/lib/files";
import { Choice, NumberField, Region, Segmented, formatDuration, round2 } from "./controls";
import { canEncodeAudio } from "mediabunny";
import { convert, inspect, waveform } from "./engine";
import type { Format, MediaInfo, Mode } from "./engine";

let aacReady: Promise<boolean> | undefined;

/** True once AAC can be encoded, natively or through the WASM fallback. */
function ensureAac() {
  aacReady ??= canEncodeAudio("aac").then(async (native) => {
    if (native) return true;
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
    return canEncodeAudio("aac");
  });
  return aacReady;
}

function useBlobUrl(blob: Blob | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    // Blob URLs are browser resources with an effect-owned lifetime.
    /* eslint-disable react/set-state-in-effect */
    if (!blob) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
    /* eslint-enable react/set-state-in-effect */
  }, [blob]);
  return url;
}

const copy: Record<Mode, { action: string; working: string; suffix: string }> = {
  compress: { action: "Compress video", working: "Compressing", suffix: "-compressed" },
  trim: { action: "Export clip", working: "Exporting clip", suffix: "-trimmed" },
  extract: { action: "Extract audio", working: "Extracting audio", suffix: "-audio" },
  audio: { action: "Export audio", working: "Exporting audio", suffix: "-trimmed" },
  loop: { action: "Create loop", working: "Creating loop", suffix: "-loop" },
};

const outputName = (name: string, suffix: string, extension: string) =>
  `${name.replace(/\.[^.]+$/, "")}${suffix}.${extension}`;

const message = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message ? cause.message : fallback;

/** Turns library errors about unreadable input into an instruction. */
function readError(cause: unknown, mode: Mode) {
  const text = message(cause, "");
  if (/no (audio|video) track|duration/i.test(text)) return text;
  return mode === "audio"
    ? "This file could not be read. Choose an audio file, such as WAV, MP3, or M4A, or a video with sound."
    : "This file could not be read. Choose an MP4, MOV, WebM, or MKV video.";
}

/** Sizes a video to its own aspect ratio, at most 24rem tall, so it never letterboxes. */
const frame = (info: MediaInfo) =>
  info.width > 0 && info.height > 0
    ? {
        aspectRatio: `${info.width} / ${info.height}`,
        width: `min(100%, ${((24 * info.width) / info.height).toFixed(2)}rem)`,
      }
    : undefined;

type Task = { kind: "read" | "preview" | "export"; label: string };

export default function MediaWorkbench({ mode }: { mode: Mode }) {
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [error, setError] = useState("");
  const hydrated = useHydrated();
  const unsupported =
    hydrated &&
    (!("VideoEncoder" in window) ||
      !("VideoDecoder" in window) ||
      !("AudioEncoder" in window) ||
      !("AudioDecoder" in window));
  const [busy, setBusy] = useState<Task | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [preview, setPreview] = useState<Blob | null>(null);
  const [peaks, setPeaks] = useState<number[]>();
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [format, setFormat] = useState<Format>(
    mode === "audio" ? "wav" : mode === "extract" ? "m4a" : mode === "compress" ? "webm" : "mp4",
  );
  const [targetPreset, setTargetPreset] = useState("8");
  const [customTarget, setCustomTarget] = useState(8);
  const [height, setHeight] = useState(mode === "loop" ? 480 : 0);
  const [fps, setFps] = useState(mode === "loop" ? 15 : 0);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const task = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const selectionPlaying = useRef(false);
  const previewAudio = useRef<HTMLAudioElement>(null);
  const resultCard = useRef<HTMLDivElement>(null);
  const sourceUrl = useBlobUrl(info?.file ?? null);
  const resultUrl = useBlobUrl(result?.blob ?? null);
  const previewUrl = useBlobUrl(preview);
  const audioOnly = mode === "audio" || mode === "extract";
  const hasRegion = mode === "trim" || mode === "audio" || mode === "loop";
  const targetMb = targetPreset === "custom" ? customTarget : Number(targetPreset);
  const regionInvalid =
    !!info &&
    hasRegion &&
    (!Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end > info.duration + 0.005 ||
      start >= end);

  // Some browsers, such as Chrome on Linux, have no AAC encoder for MP4 and M4A audio.
  // Those get mediabunny's WASM build of FFmpeg's AAC encoder, loaded only when needed.
  const [aac, setAac] = useState<boolean | null>(null);
  useEffect(() => {
    ensureAac().then(setAac, () => setAac(false));
  }, []);
  const aacMissing =
    aac === false &&
    !!info &&
    (mode === "compress" ? info.audio : audioOnly && info.audioCodec !== "aac");
  const aacFormat = mode === "compress" ? "mp4" : "m4a";
  const fallbackFormat: Format = mode === "audio" ? "wav" : "webm";
  const exportFormat = aacMissing && format === aacFormat ? fallbackFormat : format;

  useEffect(() => () => task.current?.abort(), []);
  useEffect(() => {
    if (!result) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultCard.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [result]);

  async function choose(files: File[]) {
    if (busy || !files[0]) return;
    const controller = new AbortController();
    task.current = controller;
    setError("");
    setInfo(null);
    setResult(null);
    setPreview(null);
    setPeaks(undefined);
    setBusy({ kind: "read", label: `Reading ${files[0].name}` });
    setProgress(null);
    try {
      const next = await inspect(files[0], mode);
      if (controller.signal.aborted) return;
      setInfo(next);
      setStart(0);
      setEnd(round2(mode === "loop" ? Math.min(5, next.duration) : next.duration));
      if (mode === "loop" || mode === "compress") {
        setHeight((current) => (current >= next.height ? 0 : current));
      }
      if (mode === "audio") {
        setBusy({ kind: "read", label: "Reading waveform" });
        const data = await waveform(next.file, next.duration, controller.signal);
        if (!controller.signal.aborted) setPeaks(data);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(readError(cause, mode));
    } finally {
      if (task.current === controller) {
        setBusy(null);
        setProgress(null);
      }
    }
  }

  function validate() {
    if (!info) return "Choose a file first.";
    if (regionInvalid)
      return `Set a start and end between 0 and ${info.duration.toFixed(2)} seconds, with the end after the start.`;
    if (mode === "loop" && end - start > 30) return "Shorten the selection to 30 seconds or less.";
    if (mode === "compress" && (!Number.isFinite(targetMb) || targetMb <= 0 || targetMb > 10_000))
      return "Enter a target size between 0 and 10,000 MB.";
    if (
      mode === "audio" &&
      (![fadeIn, fadeOut].every(Number.isFinite) ||
        fadeIn < 0 ||
        fadeOut < 0 ||
        fadeIn + fadeOut > end - start + 0.001)
    )
      return `Fades must be 0 or more and add up to at most ${Math.max(0, end - start).toFixed(2)} seconds, the length of the selection.`;
    return "";
  }

  async function run(previewOnly = false) {
    if (busy) return;
    const problem = validate();
    if (problem || !info) {
      setError(problem);
      return;
    }
    const controller = new AbortController();
    task.current = controller;
    setError("");
    setBusy(
      previewOnly
        ? { kind: "preview", label: "Preparing preview" }
        : { kind: "export", label: copy[mode].working },
    );
    setProgress(0);
    if (!previewOnly) setResult(null);
    video.current?.pause();
    previewAudio.current?.pause();
    try {
      const outputFormat = previewOnly ? "wav" : exportFormat;
      const blob = await convert(
        info,
        {
          mode,
          format: outputFormat,
          start,
          end: Math.min(end, info.duration),
          targetMb,
          height,
          fps,
          fadeIn,
          fadeOut,
        },
        controller.signal,
        (value, pass) => {
          if (controller.signal.aborted) return;
          setProgress(Math.round(value * 100));
          if (pass > 1)
            setBusy({ kind: "export", label: `Fitting under ${targetMb} MB, pass ${pass} of 3` });
        },
      );
      if (controller.signal.aborted) return;
      if (previewOnly) setPreview(blob);
      else
        setResult({
          blob,
          filename: outputName(info.file.name, copy[mode].suffix, outputFormat),
        });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(message(cause, "The export failed. Try the other format or another browser."));
    } finally {
      if (task.current === controller) {
        setBusy(null);
        setProgress(null);
      }
    }
  }

  function changeRegion(nextStart: number, nextEnd: number) {
    setStart(nextStart);
    setEnd(nextEnd);
    setPreview(null);
    if (error) setError("");
    selectionPlaying.current = false;
    if (video.current && Number.isFinite(nextStart)) {
      video.current.pause();
      video.current.currentTime = Math.max(0, Math.min(nextStart, info?.duration ?? nextStart));
    }
  }

  async function playSelection() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (video.current) {
      video.current.currentTime = start;
      selectionPlaying.current = true;
      try {
        await video.current.play();
      } catch {
        setError("This browser cannot play the source preview. You can still export it.");
      }
    }
  }

  const progressBlock = busy && (
    <div className="space-y-3">
      <Progress value={progress}>
        <ProgressLabel className="min-w-0 truncate">{busy.label}</ProgressLabel>
        {progress !== null && <ProgressValue />}
      </Progress>
      <Button variant="outline" className="w-full" onClick={() => task.current?.abort()}>
        Cancel
      </Button>
    </div>
  );
  const errorBlock = error && (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
  const sizeOptions: [string, string][] = info
    ? [
        ["0", info.height ? `Original (${info.height} px)` : "Original"],
        ...(["1080", "720", "480", "360"] as const)
          .filter((value) => Number(value) < info.height)
          .map((value): [string, string] => [value, `${value} px`]),
      ]
    : [["0", "Original"]];
  const reduction = result && info ? 1 - result.blob.size / info.file.size : 0;

  return (
    <div className="space-y-6">
      <fieldset disabled={!!busy} className="min-w-0">
        <FileDrop
          accept={
            mode === "audio" ? "audio/*,video/*,.mkv,.m4a,.flac" : "video/*,.mkv,.mov,.mp4,.webm"
          }
          title={
            info
              ? "Drop or choose another file"
              : mode === "audio"
                ? "Drop an audio file or choose one"
                : "Drop a video or choose one"
          }
          hint={
            mode === "audio"
              ? "WAV, MP3, M4A, FLAC, Ogg, or a video with sound"
              : "MP4, MOV, WebM, or MKV"
          }
          onFiles={(files) => void choose(files)}
          compact={!!info}
        >
          {!info && <SampleButton files={["dusk.mp4"]} onFiles={choose} />}
        </FileDrop>
      </fieldset>
      {unsupported && (
        <Alert>
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            This browser lacks some WebCodecs features, so exports that re-encode may fail. A
            current Chrome, Edge, Safari, or Firefox has them.
          </AlertDescription>
        </Alert>
      )}
      {!info && busy && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" />
          <span className="min-w-0 truncate">{busy.label}</span>
        </div>
      )}
      {!info && errorBlock}
      {info && (
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Card className="min-w-0">
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="min-w-0 font-medium break-all">{info.file.name}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {[
                    formatBytes(info.file.size),
                    info.width > 0 ? `${info.width} × ${info.height}` : "",
                    formatDuration(info.duration),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {mode !== "audio" && sourceUrl && (
                <video
                  ref={video}
                  src={sourceUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="mx-auto block rounded-lg bg-black object-contain"
                  style={frame(info)}
                  onError={() =>
                    setError(
                      "This browser cannot preview the source video. You can still export it.",
                    )
                  }
                  onTimeUpdate={(event) => {
                    if (selectionPlaying.current && event.currentTarget.currentTime >= end) {
                      event.currentTarget.pause();
                      selectionPlaying.current = false;
                    }
                  }}
                />
              )}
              {hasRegion && (
                <fieldset disabled={!!busy} className="min-w-0">
                  <Region
                    duration={info.duration}
                    start={start}
                    end={end}
                    onChange={changeRegion}
                    peaks={peaks}
                    invalid={regionInvalid}
                    disabled={!!busy}
                    waveform={
                      mode === "audio" && (
                        <div className="flex h-28 items-center justify-center gap-2 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                          {busy?.kind === "read" && <Spinner aria-hidden="true" />}
                          {busy?.kind === "read" ? busy.label : "No waveform"}
                        </div>
                      )
                    }
                  >
                    <Button
                      variant="outline"
                      onClick={() => (mode === "audio" ? void run(true) : void playSelection())}
                    >
                      {busy?.kind === "preview" ? (
                        <Spinner data-icon="inline-start" aria-hidden="true" />
                      ) : (
                        <Play data-icon="inline-start" aria-hidden="true" />
                      )}
                      {mode === "audio" ? "Preview with fades" : "Play selection"}
                    </Button>
                  </Region>
                </fieldset>
              )}
              {mode === "audio" && previewUrl && (
                <audio
                  ref={previewAudio}
                  src={previewUrl}
                  controls
                  autoPlay
                  className="w-full animate-in duration-200 fade-in"
                  aria-label="Selection preview with fades"
                />
              )}
            </CardContent>
          </Card>
          <div className="min-w-0 space-y-5">
            <fieldset disabled={!!busy} className="min-w-0 space-y-5">
              {mode === "compress" && (
                <>
                  <Choice
                    label="Target size"
                    value={targetPreset}
                    onChange={setTargetPreset}
                    options={[
                      ["8", "8 MB"],
                      ["10", "10 MB"],
                      ["25", "25 MB"],
                      ["50", "50 MB"],
                      ["custom", "Custom"],
                    ]}
                  />
                  {targetPreset === "custom" && (
                    <NumberField
                      label="Custom size"
                      unit="MB"
                      value={customTarget}
                      min={0.01}
                      max={10000}
                      step={0.1}
                      onChange={setCustomTarget}
                    />
                  )}
                  {Number.isFinite(targetMb) && info.file.size <= targetMb * 1_000_000 && (
                    <FieldDescription>
                      This file is already under {targetMb} MB. Compressing still lowers its
                      bitrate.
                    </FieldDescription>
                  )}
                </>
              )}
              {(mode === "compress" || mode === "loop") && (
                <>
                  <Choice
                    label="Maximum height"
                    value={String(height)}
                    onChange={(value) => setHeight(Number(value))}
                    options={sizeOptions}
                  />
                  <Choice
                    label="Frame rate"
                    value={String(fps)}
                    onChange={(value) => setFps(Number(value))}
                    options={[
                      ["0", "Original"],
                      ["30", "30 fps"],
                      ["24", "24 fps"],
                      ["15", "15 fps"],
                      ["10", "10 fps"],
                    ]}
                  />
                </>
              )}
              {(mode === "trim" || mode === "compress" || audioOnly) && (
                <Segmented
                  label="Format"
                  value={exportFormat}
                  onChange={(value) => setFormat(value as Format)}
                  options={(mode === "trim" || mode === "compress"
                    ? [
                        ["mp4", "MP4"],
                        ["webm", "WebM"],
                      ]
                    : mode === "audio"
                      ? [
                          ["wav", "WAV"],
                          ["m4a", "M4A"],
                        ]
                      : [
                          ["m4a", "M4A"],
                          ["webm", "Opus"],
                          ["wav", "WAV"],
                        ]
                  ).map(([value, name]): [string, string, boolean] => [
                    value!,
                    name!,
                    aacMissing && value === aacFormat,
                  ])}
                  description={
                    aacMissing &&
                    `${aacFormat === "mp4" ? "MP4" : "M4A"} needs an AAC audio encoder, which this browser lacks.`
                  }
                />
              )}
              {mode === "audio" && (
                <div className="grid grid-cols-2 gap-4">
                  <NumberField
                    label="Fade in"
                    unit="s"
                    value={fadeIn}
                    max={end - start}
                    step={0.1}
                    onChange={(value) => {
                      setFadeIn(value);
                      setPreview(null);
                    }}
                  />
                  <NumberField
                    label="Fade out"
                    unit="s"
                    value={fadeOut}
                    max={end - start}
                    step={0.1}
                    onChange={(value) => {
                      setFadeOut(value);
                      setPreview(null);
                    }}
                  />
                </div>
              )}
              {mode === "loop" && (
                <FieldDescription>Silent MP4, up to 30 seconds long.</FieldDescription>
              )}
              <Button size="lg" className="w-full" onClick={() => void run()}>
                {busy?.kind === "export" && <Spinner data-icon="inline-start" aria-hidden="true" />}
                {copy[mode].action}
              </Button>
            </fieldset>
            {progressBlock}
            {errorBlock}
          </div>
        </div>
      )}
      <output className="sr-only">
        {result ? `Ready: ${result.filename}, ${formatBytes(result.blob.size)}` : ""}
      </output>
      {result && resultUrl && info && (
        <Card
          ref={resultCard}
          className="scroll-mt-6 animate-in duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] fade-in motion-safe:slide-in-from-bottom-2"
        >
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
                  <span className="text-2xl font-semibold tracking-tight">
                    {formatBytes(result.blob.size)}
                  </span>
                  {mode === "compress" && (
                    <span className="text-sm text-muted-foreground">
                      from {formatBytes(info.file.size)}, {Math.abs(reduction * 100).toFixed(0)}%{" "}
                      {reduction >= 0 ? "smaller" : "larger"}
                    </span>
                  )}
                </p>
                <p className="text-sm break-all text-muted-foreground">{result.filename}</p>
              </div>
              <Button
                size="lg"
                onClick={() => {
                  downloadBlob(result.blob, result.filename);
                  toast.success("Download started", { description: result.filename });
                }}
              >
                <Download data-icon="inline-start" aria-hidden="true" />
                Download
              </Button>
            </div>
            {audioOnly ? (
              <audio src={resultUrl} controls className="w-full" aria-label="Exported audio" />
            ) : (
              <video
                src={resultUrl}
                controls
                playsInline
                autoPlay={mode === "loop"}
                loop={mode === "loop"}
                muted={mode === "loop"}
                preload="auto"
                className="mx-auto block rounded-lg bg-black object-contain"
                style={frame(info)}
                aria-label="Exported video"
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
