import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { downloadReporter, gpuAvailable } from "../_voice/worker-types";
import type { ModelLabel, Segment, WorkerReply } from "../_voice/worker-types";
import { keepSpeech, nearSilent } from "./speech";

type Size = "tiny" | "base";
type Request =
  | { type: "transcribe"; samples: Float32Array; model: Size; label: ModelLabel; language: string }
  | { type: "dispose" };
const revisions: Record<Size, string> = {
  tiny: "ff4177021cc41f7db950912b73ea4fdf7d01d8e7",
  base: "1846881b6b3a3024392c1eea3ad983695bc23925",
};
const rate = 16000;
let pipeline: AutomaticSpeechRecognitionPipeline | null = null;
let modelId = "";
let device: "webgpu" | "wasm" = "wasm";
let running = false;
let closing = false;
const send = (reply: WorkerReply) => self.postMessage(reply);
async function dispose() {
  await pipeline?.dispose();
  pipeline = null;
  send({ type: "disposed" });
}

async function load(model: Size, label: ModelLabel, forceWasm = false) {
  if (pipeline && modelId === model && !forceWasm) return pipeline;
  await pipeline?.dispose();
  pipeline = null;
  const runtime = await import("@huggingface/transformers");
  runtime.env.allowLocalModels = false;
  device = !forceWasm && (await gpuAvailable()) ? "webgpu" : "wasm";
  const create = () =>
    runtime.pipeline("automatic-speech-recognition", `onnx-community/whisper-${model}`, {
      dtype: "q8",
      device,
      revision: revisions[model],
      progress_callback: downloadReporter(label, send),
    });
  try {
    pipeline = await create();
  } catch (error) {
    if (device !== "webgpu") throw error;
    device = "wasm";
    pipeline = await create();
  }
  modelId = model;
  send({ type: "engine", device });
  return pipeline;
}

/**
 * Whisper predicts language and no-speech probability after <|startoftranscript|>.
 * transformers.js forces English when no language is given, so ask the model directly.
 */
async function inspectSpeech(transcriber: AutomaticSpeechRecognitionPipeline, audio: Float32Array) {
  const { Tensor } = await import("@huggingface/transformers");
  const config = transcriber.model.generation_config as unknown as {
    decoder_start_token_id: number;
    lang_to_id: Record<string, number>;
  };
  const { input_features } = await transcriber.processor(audio);
  const start = new Tensor(
    "int64",
    BigInt64Array.from([BigInt(config.decoder_start_token_id)]),
    [1, 1],
  );
  const output = await transcriber.model({ input_features, decoder_input_ids: start });
  const logits = output.logits.data as Float32Array;
  let best = "en";
  let score = -Infinity;
  for (const [token, id] of Object.entries(config.lang_to_id)) {
    if (logits[id] > score) {
      score = logits[id];
      best = token.slice(2, -2);
    }
  }
  // Whisper's first-token distribution also predicts <|nocaptions|>, including for music.
  const noSpeechId = transcriber.tokenizer.convert_tokens_to_ids("<|nocaptions|>");
  let max = -Infinity;
  for (const value of logits) max = Math.max(max, value);
  let total = 0;
  for (const value of logits) total += Math.exp(value - max);
  const noSpeech = Math.exp(logits[noSpeechId] - max) / total;
  // The direct forward pass returns KV tensors too. Release any GPU allocations.
  for (const value of Object.values(output)) {
    if (value instanceof Tensor) value.dispose();
  }
  input_features.dispose();
  start.dispose();
  return { language: best, noSpeech };
}

/** Prefer a quiet boundary near the end of each window rather than cutting mid-word. */
function chunkEnd(samples: Float32Array, start: number) {
  const end = Math.min(samples.length, start + 28 * rate);
  if (end === samples.length) return end;
  let quietest = Infinity;
  let best = end;
  for (let offset = end - 3 * rate; offset < end; offset += 1600) {
    let energy = 0;
    for (let i = offset; i < offset + 1600; i++) energy += samples[i] ** 2;
    if (energy < quietest) {
      quietest = energy;
      best = offset + 800;
    }
  }
  return best;
}

self.onmessage = async (event: MessageEvent<Request>) => {
  if (event.data.type === "dispose") {
    closing = true;
    if (!running) await dispose();
    return;
  }
  if (running) return;
  running = true;
  const { samples, model, label } = event.data;
  let language = event.data.language;
  const seconds = samples.length / rate;
  try {
    if (nearSilent(samples)) {
      send({ type: "done" });
      return;
    }
    let transcriber = await load(model, label);
    for (let start = 0; start < samples.length && !closing;) {
      const end = chunkEnd(samples, start);
      const audio = samples.slice(start, end);
      if (nearSilent(audio)) {
        start = end;
        continue;
      }
      const run = async () => {
        send({ type: "progress", progress: { label: "Checking for speech…" } });
        const speech = await inspectSpeech(transcriber, audio);
        if (speech.noSpeech > 0.6) return null;
        if (language === "auto") {
          send({ type: "progress", progress: { label: "Detecting the spoken language…" } });
          language = speech.language;
          send({ type: "language", language });
        }
        send({
          type: "progress",
          progress:
            end === samples.length && start === 0
              ? { label: `Transcribing ${Math.round(seconds)} seconds of audio…` }
              : {
                  label: `Transcribing ${Math.round(start / rate)} of ${Math.round(seconds)} seconds…`,
                  percent: (start / samples.length) * 100,
                },
        });
        return transcriber(audio, { return_timestamps: true, language, task: "transcribe" });
      };
      let output;
      try {
        output = await run();
      } catch (error) {
        if (device !== "webgpu") throw error;
        // Some GPUs fail at inference time rather than load time. Retry this chunk on the CPU.
        transcriber = await load(model, { ...label, cached: true }, true);
        output = await run();
      }
      if (closing) break;
      if (!output) {
        start = end;
        continue;
      }
      const result = Array.isArray(output) ? output[0] : output;
      const chunks: { text: string; timestamp: [number | null, number | null] }[] = result.chunks
        ?.length
        ? result.chunks
        : [{ text: result.text, timestamp: [0, (end - start) / rate] }];
      const offset = start / rate;
      const limit = end / rate;
      const segments: Segment[] = chunks
        .filter((chunk) => chunk.text.trim())
        .map((chunk) => ({
          text: chunk.text.trim(),
          start: Math.min(limit, offset + (chunk.timestamp[0] ?? 0)),
          end: Math.min(limit, offset + (chunk.timestamp[1] ?? (end - start) / rate)),
        }))
        .filter((segment) => keepSpeech(segment.text, samples, segment.start, segment.end));
      send({ type: "segments", segments });
      start = end;
    }
    if (!closing) send({ type: "done" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    send({
      type: "error",
      error: /fetch|network|load/i.test(detail)
        ? "Unable to download the model. Check your connection and try again."
        : `Transcription failed: ${detail}. Try Whisper Tiny or a shorter recording.`,
    });
  } finally {
    running = false;
    if (closing) await dispose();
  }
};
