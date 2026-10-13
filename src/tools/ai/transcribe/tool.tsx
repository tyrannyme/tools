import { useEffect, useRef, useState } from "react";
import { FileAudio } from "lucide-react";
import { cn } from "cn";
import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes, renameExtension } from "@/lib/files";
import {
  Choice,
  CopyButton,
  DownloadButton,
  ModelNote,
  ResultPanel,
  ToolError,
  WorkStatus,
  automaticLanguage,
  enter,
  languageName,
  message,
  textFile,
  useModelCached,
} from "../_voice/ui";
import type { ModelInfo, WorkProgress } from "../_voice/ui";
import { decodeAudio } from "../_voice/audio";
import { subtitles, timestamp } from "../_voice/subtitles";
import { useModelWorker } from "../_voice/use-worker";
import type { Segment } from "../_voice/worker-types";
import { SampleButton } from "@/components/sample-button";

type Size = "tiny" | "base";
// Sizes are the measured first-visit transfer: model files, tokenizer, and the 5.5 MB runtime.
const models: Record<Size, ModelInfo & { files: number; cache: string[] }> = {
  tiny: {
    name: "Whisper Tiny",
    href: "https://huggingface.co/onnx-community/whisper-tiny",
    license: "MIT",
    bytes: 47_000_000,
    files: 40_000_000,
    cache: [
      "config.json",
      "generation_config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "preprocessor_config.json",
      "onnx/encoder_model_quantized.onnx",
      "onnx/decoder_model_merged_quantized.onnx",
    ].map(
      (file) =>
        `onnx-community/whisper-tiny/resolve/ff4177021cc41f7db950912b73ea4fdf7d01d8e7/${file}`,
    ),
  },
  base: {
    name: "Whisper Base",
    href: "https://huggingface.co/onnx-community/whisper-base",
    license: "MIT",
    bytes: 85_000_000,
    files: 76_000_000,
    cache: [
      "config.json",
      "generation_config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "preprocessor_config.json",
      "onnx/encoder_model_quantized.onnx",
      "onnx/decoder_model_merged_quantized.onnx",
    ].map(
      (file) =>
        `onnx-community/whisper-base/resolve/1846881b6b3a3024392c1eea3ad983695bc23925/${file}`,
    ),
  },
};
const sizes = [
  { value: "tiny", label: "Whisper Tiny · faster" },
  { value: "base", label: "Whisper Base · more accurate" },
];
const spoken = automaticLanguage.filter((option) => option.value !== "zh-Hant");
const shortTime = (seconds: number) => timestamp(seconds).slice(seconds >= 3600 ? 0 : 3, 8);

export default function TranscribeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const urlRef = useRef("");
  const [model, setModel] = useState<Size>("tiny");
  const [language, setLanguage] = useState("auto");
  const [detected, setDetected] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [decoding, setDecoding] = useState<WorkProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [now, setNow] = useState(-1);
  const decoder = useRef<AbortController | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  const worker = useModelWorker(
    () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
    (reply) => {
      if (reply.type === "segments") setSegments((current) => [...current, ...reply.segments]);
      if (reply.type === "language") setDetected(reply.language);
      if (reply.type === "done") setFinished(true);
    },
  );
  const info = models[model];
  const cached = useModelCached(info.cache, worker.runs);
  const busy = !!decoding || worker.busy;
  useEffect(
    () => () => {
      decoder.current?.abort();
      URL.revokeObjectURL(urlRef.current);
    },
    [],
  );
  function reset() {
    setError(null);
    worker.setError(null);
    setFinished(false);
    setSegments([]);
    setDetected("");
    setNow(-1);
  }
  function choose(files: File[]) {
    const next = files[0];
    if (busy || !next) return;
    reset();
    if (
      !/^(audio|video)\//.test(next.type) &&
      !/\.(mkv|flac|ogg|opus|m4a|mp3|wav|webm)$/i.test(next.name)
    ) {
      setError(
        `${next.name} is not an audio or video file. Choose a recording such as MP3, M4A, WAV, or MP4.`,
      );
      return;
    }
    if (next.size === 0 || next.size > 500 * 1024 * 1024) {
      setError("Choose a file between 1 byte and 500 MB.");
      return;
    }
    URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(next);
    setUrl(urlRef.current);
    setFile(next);
  }
  async function transcribe() {
    if (!file || busy) return;
    const active = new AbortController();
    decoder.current = active;
    reset();
    setDecoding({ label: "Reading the audio…", percent: 0 });
    try {
      const samples = await decodeAudio(file, active.signal, (percent) =>
        setDecoding({ label: "Reading the audio…", percent }),
      );
      active.signal.throwIfAborted();
      worker.start(
        {
          type: "transcribe",
          samples,
          model,
          language,
          label: { name: info.name, cached: !!cached, bytes: info.files },
        },
        [samples.buffer],
      );
    } catch (cause) {
      if (!active.signal.aborted) setError(message(cause));
    } finally {
      setDecoding(null);
      decoder.current = null;
    }
  }
  function cancel() {
    decoder.current?.abort();
    worker.cancel();
  }
  function seek(seconds: number) {
    const media = player.current;
    if (!media) return;
    media.currentTime = seconds;
    void media.play().catch(() => {});
  }
  const text = segments.map((segment) => segment.text).join("\n");
  const base = file?.name ?? "transcript";
  const isVideo = file?.type.startsWith("video/");
  const partial = segments.length > 0 && !finished && !busy;
  return (
    <div className="space-y-6">
      {!file ? (
        <FileDrop
          title="Choose an audio or video file"
          hint="MP3, M4A, WAV, MP4, WebM, and more · Up to 30 minutes"
          accept="audio/*,video/*,.mkv,.flac,.ogg,.opus"
          icon={FileAudio}
          onFiles={choose}
        >
          <SampleButton files={["tyranny-speech.m4a"]} onFiles={choose} />
        </FileDrop>
      ) : (
        <div className="space-y-3">
          <video
            ref={player}
            src={url}
            controls
            preload="metadata"
            playsInline
            aria-label={`Player for ${file.name}`}
            onTimeUpdate={(event) => setNow(event.currentTarget.currentTime)}
            className={cn("w-full", isVideo ? "max-h-96 rounded-xl bg-black" : "h-12 rounded-full")}
          >
            <track
              kind="captions"
              label="Transcript"
              default
              src={
                segments.length
                  ? `data:text/vtt;charset=utf-8,${encodeURIComponent(subtitles(segments, "vtt"))}`
                  : undefined
              }
            />
          </video>
          <fieldset disabled={busy} className="min-w-0 disabled:opacity-60">
            <FileDrop
              compact
              title="Replace file"
              hint={`${file.name} · ${formatBytes(file.size)}`}
              accept="audio/*,video/*,.mkv,.flac,.ogg,.opus"
              icon={FileAudio}
              onFiles={choose}
            />
          </fieldset>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice
          label="Model"
          value={model}
          options={sizes}
          onChange={(value) => setModel(value as Size)}
          disabled={busy}
        />
        <Choice
          label="Spoken language"
          value={language}
          options={spoken}
          onChange={setLanguage}
          disabled={busy}
        />
      </div>
      <div className="space-y-3">
        <Button disabled={!file || busy} onClick={transcribe}>
          {busy && <Spinner />}
          {segments.length && !busy ? "Transcribe again" : "Transcribe"}
        </Button>
        <ModelNote
          model={info}
          cached={cached}
          device={worker.device}
          privacy="Audio stays on this device."
        />
      </div>
      <WorkStatus progress={decoding ?? worker.progress} onCancel={cancel} />
      <ToolError error={error ?? worker.error} />
      {(segments.length > 0 || finished) && (
        <ResultPanel
          className={enter}
          meta={
            segments.length === 0
              ? null
              : partial
                ? "Stopped early. Transcribe again for the full recording."
                : [
                    detected && language === "auto" ? `Detected ${languageName(detected)}` : "",
                    `${segments.length} ${segments.length === 1 ? "line" : "lines"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")
          }
          actions={
            segments.length > 0 && (
              <>
                <CopyButton text={text} disabled={busy} />
                <DownloadButton
                  disabled={busy}
                  options={[
                    {
                      label: "Subtitles (SRT)",
                      filename: renameExtension(base, "srt"),
                      blob: () =>
                        new Blob([subtitles(segments, "srt")], {
                          type: "application/x-subrip;charset=utf-8",
                        }),
                    },
                    {
                      label: "Web subtitles (VTT)",
                      filename: renameExtension(base, "vtt"),
                      blob: () =>
                        new Blob([subtitles(segments, "vtt")], { type: "text/vtt;charset=utf-8" }),
                    },
                    textFile(text, renameExtension(base, "txt"), "Plain text (TXT)"),
                  ]}
                />
              </>
            )
          }
        >
          {segments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No speech found. Check that the recording has audible speech, or choose the spoken
              language instead of detecting it.
            </p>
          ) : (
            <ol className="max-h-[32rem] overflow-y-auto overscroll-contain p-2">
              {segments.map((segment, index) => {
                const active = now >= segment.start && now < segment.end;
                return (
                  <li key={index} className={cn(index === segments.length - 1 && busy && enter)}>
                    <button
                      type="button"
                      onClick={() => seek(segment.start)}
                      aria-label={`Play from ${shortTime(segment.start)}: ${segment.text}`}
                      className={cn(
                        "flex w-full items-baseline gap-4 rounded-lg px-3 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                        active && "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "w-12 shrink-0 font-mono text-xs text-muted-foreground tabular-nums",
                          active && "text-foreground",
                        )}
                      >
                        {shortTime(segment.start)}
                      </span>
                      <span className="min-w-0 text-base leading-relaxed wrap-anywhere" dir="auto">
                        {segment.text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </ResultPanel>
      )}
    </div>
  );
}
