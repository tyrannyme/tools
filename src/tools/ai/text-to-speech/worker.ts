import type { KokoroTTS, GenerateOptions } from "kokoro-js";
import { downloadReporter, gpuAvailable } from "../_voice/worker-types";
import type { ModelLabel, WorkerReply } from "../_voice/worker-types";

type Request =
  | {
      type: "generate";
      text: string;
      voice: string;
      speed: number;
      label: ModelLabel;
      work: string;
    }
  | { type: "dispose" };
let model: KokoroTTS | null = null;
let device: "webgpu" | "wasm" = "wasm";
let running = false;
let closing = false;
const send = (reply: WorkerReply) => self.postMessage(reply);
async function dispose() {
  await model?.model.dispose();
  model = null;
  send({ type: "disposed" });
}
async function load(label: ModelLabel, forceWasm = false) {
  if (model && !forceWasm) return model;
  await model?.model.dispose();
  model = null;
  const { KokoroTTS } = await import("kokoro-js");
  device = !forceWasm && (await gpuAvailable()) ? "webgpu" : "wasm";
  const create = () =>
    KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device,
      progress_callback: downloadReporter(label, send),
    });
  try {
    model = await create();
  } catch (error) {
    if (device !== "webgpu") throw error;
    device = "wasm";
    model = await create();
  }
  send({ type: "engine", device });
  return model;
}
self.onmessage = async (event: MessageEvent<Request>) => {
  if (event.data.type === "dispose") {
    closing = true;
    if (!running) await dispose();
    return;
  }
  if (running) return;
  running = true;
  const { text, voice, speed, label, work } = event.data;
  try {
    let tts = await load(label);
    const options: GenerateOptions = { voice: voice as GenerateOptions["voice"], speed };
    // Bound long sentences before phonemization to avoid tokenizer truncation.
    const passages = text.match(/.{1,240}(?:\s|$)|\S{1,240}/gs) ?? [text];
    const total = passages.reduce((sum, passage) => sum + passage.trim().length, 0) || 1;
    let generated = 0;
    let spoken = 0;
    const report = () =>
      send({
        type: "progress",
        progress: { label: `${work}…`, percent: Math.min(99, (spoken / total) * 100) },
      });
    async function generate() {
      report();
      const { TextSplitterStream } = await import("kokoro-js");
      const splitter = new TextSplitterStream();
      for (const passage of passages) splitter.push(`${passage.trim()}\n`);
      // Close the input so its final sentence is emitted.
      splitter.close();
      for await (const chunk of tts.stream(splitter, options)) {
        if (closing) break;
        generated++;
        spoken += chunk.text.length;
        send({
          type: "audio",
          samples: chunk.audio.audio,
          rate: chunk.audio.sampling_rate,
          text: chunk.text,
        });
        report();
      }
    }
    try {
      await generate();
    } catch (error) {
      if (device !== "webgpu" || generated > 0) throw error;
      tts = await load({ ...label, cached: true }, true);
      await generate();
    }
    if (!closing) send({ type: "done" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    send({
      type: "error",
      error: /fetch|network/i.test(detail)
        ? "Unable to download the voice model. Check your connection and try again."
        : `Speech generation failed: ${detail}. Try a shorter passage.`,
    });
  } finally {
    running = false;
    if (closing) await dispose();
  }
};
