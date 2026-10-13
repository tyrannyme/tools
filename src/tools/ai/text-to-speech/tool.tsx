import { useEffect, useRef, useState } from "react";
import { Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/files";
import {
  Choice,
  DownloadButton,
  ModelNote,
  ResultPanel,
  ToolError,
  WorkStatus,
  enter,
  useModelCached,
} from "../_voice/ui";
import type { ModelInfo } from "../_voice/ui";
import { wavBlob } from "../_voice/audio";
import { useModelWorker } from "../_voice/use-worker";
import { timestamp } from "../_voice/subtitles";

const voices = [
  ["af_heart", "Heart · American"],
  ["af_bella", "Bella · American"],
  ["af_nicole", "Nicole · American"],
  ["af_sarah", "Sarah · American"],
  ["af_sky", "Sky · American"],
  ["af_alloy", "Alloy · American"],
  ["af_aoede", "Aoede · American"],
  ["af_jessica", "Jessica · American"],
  ["af_kore", "Kore · American"],
  ["af_nova", "Nova · American"],
  ["af_river", "River · American"],
  ["am_adam", "Adam · American"],
  ["am_echo", "Echo · American"],
  ["am_eric", "Eric · American"],
  ["am_fenrir", "Fenrir · American"],
  ["am_liam", "Liam · American"],
  ["am_michael", "Michael · American"],
  ["am_onyx", "Onyx · American"],
  ["am_puck", "Puck · American"],
  ["am_santa", "Santa · American"],
  ["bf_alice", "Alice · British"],
  ["bf_emma", "Emma · British"],
  ["bf_isabella", "Isabella · British"],
  ["bf_lily", "Lily · British"],
  ["bm_daniel", "Daniel · British"],
  ["bm_fable", "Fable · British"],
  ["bm_george", "George · British"],
  ["bm_lewis", "Lewis · British"],
].map(([value, label]) => ({ value, label }));
// Measured first-visit transfer: 92 MB model, 4 MB runtime, and one voice.
const model: ModelInfo = {
  name: "Kokoro 82M",
  href: "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX",
  license: "Apache 2.0",
  bytes: 97_000_000,
};
const cacheParts = ["Kokoro-82M-v1.0-ONNX", "model_quantized.onnx"];
const maxLength = 5000;
const previewText = "The world is full of small wonders. Take a moment to listen.";
const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

export default function TextToSpeechTool() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("af_heart");
  const [speed, setSpeed] = useState(1);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<{
    blob: Blob;
    url: string;
    seconds: number;
    text: string;
  } | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const nextTime = useRef(0);
  const chunks = useRef<Float32Array[]>([]);
  const sampleRate = useRef(24000);
  const sources = useRef(new Set<AudioBufferSourceNode>());
  const mutedRef = useRef(false);
  const preview = useRef(false);
  const spoken = useRef("");
  function play(samples: Float32Array, rate: number) {
    const audio = context.current;
    if (!audio) return;
    try {
      const buffer = audio.createBuffer(1, samples.length, rate);
      buffer.copyToChannel(new Float32Array(samples), 0);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
      sources.current.add(source);
      source.onended = () => {
        sources.current.delete(source);
        source.disconnect();
        if (sources.current.size === 0) setPlaying(false);
      };
      const start = Math.max(audio.currentTime, nextTime.current);
      source.start(start);
      nextTime.current = start + buffer.duration;
      setPlaying(true);
    } catch {
      setAudioError("Live playback is unavailable. Play or download the audio when it finishes.");
    }
  }
  function stopPlayback() {
    for (const source of sources.current) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    sources.current.clear();
    nextTime.current = 0;
    setPlaying(false);
  }
  const worker = useModelWorker(
    () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
    (reply) => {
      if (reply.type === "audio") {
        chunks.current.push(reply.samples);
        sampleRate.current = reply.rate;
        if (!mutedRef.current) play(reply.samples, reply.rate);
      }
      if (reply.type === "done" && chunks.current.length && !preview.current) {
        const blob = wavBlob(chunks.current, sampleRate.current);
        const length = chunks.current.reduce((sum, chunk) => sum + chunk.length, 0);
        setResult({
          blob,
          url: URL.createObjectURL(blob),
          seconds: length / sampleRate.current,
          text: spoken.current,
        });
      }
    },
  );
  const cached = useModelCached(cacheParts, worker.runs);
  const resultUrl = result?.url;
  useEffect(() => () => void (resultUrl && URL.revokeObjectURL(resultUrl)), [resultUrl]);
  useEffect(() => () => void context.current?.close(), []);

  function generate(asPreview: boolean) {
    if (worker.busy) return;
    if (!asPreview && !text.trim()) {
      setAudioError("Enter some English text to turn into speech.");
      return;
    }
    preview.current = asPreview;
    spoken.current = text;
    setPreviewing(asPreview);
    setAudioError(null);
    if (!asPreview) setResult(null);
    chunks.current = [];
    stopPlayback();
    mutedRef.current = false;
    setMuted(false);
    try {
      // Created inside the click, so the browser allows playback as audio streams in.
      context.current ??= new AudioContext();
      void context.current.resume().catch(() => {});
    } catch {
      context.current = null;
    }
    worker.start(
      {
        type: "generate",
        text: asPreview ? previewText : text,
        voice,
        speed,
        work: asPreview ? "Generating a preview" : "Generating speech",
        label: { name: model.name, cached: !!cached, bytes: 92_000_000 },
      },
      [],
    );
  }
  function cancel() {
    worker.cancel();
    stopPlayback();
    chunks.current = [];
  }
  function toggleMute() {
    mutedRef.current = !muted;
    setMuted(!muted);
    if (!muted) stopPlayback();
  }
  const length = text.length;
  return (
    <div className="space-y-6">
      <Field>
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel htmlFor="speech-input">English text</FieldLabel>
          <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {length > maxLength * 0.8 &&
              `${length.toLocaleString()} / ${maxLength.toLocaleString()}`}
          </span>
        </div>
        <Textarea
          id="speech-input"
          placeholder="The lighthouse keeper climbed the stairs at dusk and lit the lamp."
          className="min-h-40"
          maxLength={maxLength}
          value={text}
          readOnly={worker.busy}
          onChange={(event) => {
            setText(event.target.value);
            setAudioError(null);
          }}
        />
      </Field>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <Choice
          label="Voice"
          value={voice}
          options={voices}
          onChange={setVoice}
          disabled={worker.busy}
        />
        <Field>
          <div className="flex items-baseline justify-between">
            <FieldLabel id="speech-speed-label">Speed</FieldLabel>
            <span className="text-sm text-muted-foreground tabular-nums">{speed.toFixed(1)}×</span>
          </div>
          <div className="flex h-8 items-center">
            <Slider
              aria-labelledby="speech-speed-label"
              value={[speed]}
              min={0.5}
              max={2}
              step={0.1}
              disabled={worker.busy}
              onValueChange={(value) => setSpeed(Array.isArray(value) ? value[0] : value)}
            />
          </div>
        </Field>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button disabled={worker.busy} onClick={() => generate(false)}>
            {worker.busy && !previewing && <Spinner />}
            Generate speech
          </Button>
          <Button variant="outline" disabled={worker.busy} onClick={() => generate(true)}>
            {worker.busy && previewing ? <Spinner /> : <Volume2 aria-hidden="true" />}
            Preview voice
          </Button>
          {!worker.busy && playing && (
            <Button variant="ghost" onClick={stopPlayback}>
              <Square aria-hidden="true" />
              Stop
            </Button>
          )}
        </div>
        <ModelNote
          model={model}
          cached={cached}
          device={worker.device}
          privacy="Text stays on this device."
        />
      </div>
      <WorkStatus progress={worker.progress} onCancel={cancel}>
        {(playing || muted) && (
          <Button variant="ghost" onClick={toggleMute} aria-pressed={muted}>
            {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
            {muted ? "Unmute" : "Mute"}
          </Button>
        )}
      </WorkStatus>
      <ToolError error={worker.error ?? audioError} />
      {result && (
        <ResultPanel
          className={enter}
          meta={`${duration(result.seconds)} · WAV · ${formatBytes(result.blob.size)}`}
          actions={
            <DownloadButton
              disabled={worker.busy}
              options={[{ label: "WAV", filename: "speech.wav", blob: () => result.blob }]}
            />
          }
        >
          <div className="p-4">
            <audio
              controls
              src={result.url}
              className="w-full"
              aria-label="Generated speech"
              onPlay={stopPlayback}
            >
              <track
                kind="captions"
                label="Spoken text"
                default
                src={`data:text/vtt;charset=utf-8,${encodeURIComponent(`WEBVTT\n\n00:00:00.000 --> ${timestamp(result.seconds)}\n${result.text.replace(/\n\s*\n/g, "\n")}`)}`}
              />
            </audio>
          </div>
        </ResultPanel>
      )}
    </div>
  );
}
