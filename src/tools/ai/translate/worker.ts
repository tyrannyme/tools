import type { TranslationPipeline } from "@huggingface/transformers";
import { downloadReporter } from "../_voice/worker-types";
import type { ModelLabel, WorkerReply } from "../_voice/worker-types";
import { translationModel } from "./models";

type Request =
  | { type: "translate"; text: string; source: string; target: string; label: ModelLabel }
  | { type: "dispose" };
let translator: TranslationPipeline | null = null;
let modelId = "";
let running = false;
let closing = false;
const send = (reply: WorkerReply) => self.postMessage(reply);

async function dispose() {
  await translator?.dispose();
  translator = null;
  send({ type: "disposed" });
}

/** Keep every input token, splitting long sentences instead of silently truncating them. */
async function splitText(text: string, pipe: TranslationPipeline, language: string) {
  const parts: string[] = [];
  async function append(part: string): Promise<void> {
    const tokens = await pipe.tokenizer(part);
    if (tokens.input_ids.size <= 192) {
      parts.push(part);
      return;
    }
    const middle = Math.floor(part.length / 2);
    const space = part.lastIndexOf(" ", middle);
    const split = space > middle / 2 ? space : middle;
    await append(part.slice(0, split).trim());
    await append(part.slice(split).trim());
  }
  const sentences = new Intl.Segmenter(language, { granularity: "sentence" });
  for (const { segment } of sentences.segment(text)) {
    if (segment.trim()) await append(segment.trim());
  }
  return parts;
}

self.onmessage = async (event: MessageEvent<Request>) => {
  if (event.data.type === "dispose") {
    closing = true;
    if (!running) await dispose();
    return;
  }
  if (running) return;
  running = true;
  const { source, target, text, label } = event.data;
  try {
    const info = translationModel(source, target);
    if (!info) throw new Error("Choose a supported language pair with English on one side.");
    if (!translator || modelId !== info.id) {
      await translator?.dispose();
      translator = null;
      const runtime = await import("@huggingface/transformers");
      runtime.env.allowLocalModels = false;
      // 4.3 probes metadata without forwarding revision. Pin its worker-local URL template too.
      runtime.env.remotePathTemplate = `{model}/resolve/${info.revision}/`;
      translator = await runtime.pipeline("translation", info.id, {
        device: "wasm",
        dtype: "q8",
        revision: info.revision,
        progress_callback: downloadReporter(label, send),
      });
      modelId = info.id;
    }
    send({ type: "engine", device: "wasm" });
    const parts = await splitText(text, translator, source);
    const translated: string[] = [];
    for (const [index, part] of parts.entries()) {
      if (closing) break;
      send({
        type: "progress",
        progress: {
          label: `Translating with ${info.name}…`,
          ...(parts.length > 1 ? { percent: (index / parts.length) * 100 } : {}),
        },
      });
      const output = await translator(part, { max_new_tokens: 512 });
      const result = output[0];
      const value = Array.isArray(result) ? result[0]?.translation_text : result?.translation_text;
      if (!value?.trim()) throw new Error("The model returned no text. Try a shorter passage.");
      translated.push(value.trim());
    }
    if (!closing) {
      send({ type: "translation", text: translated.join(" ") });
      send({ type: "done" });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    send({
      type: "error",
      error: /fetch|network|load/i.test(detail)
        ? "Unable to download the translation model. Check your connection and try again."
        : `Translation failed: ${detail} Try a shorter passage or another language pair.`,
    });
  } finally {
    running = false;
    if (closing) await dispose();
  }
};
