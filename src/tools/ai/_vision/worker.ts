import type {
  Florence2Processor,
  PretrainedModelOptions,
  ProgressInfo,
  RawImage,
  SamModel,
  SamProcessor,
  Tensor,
} from "@huggingface/transformers";
import { choose, modelKey, models } from "./types";
import type { Device, VisionPhase, VisionRequest, VisionResult, WorkerReply } from "./types";

type Runner = {
  run: (request: VisionRequest) => Promise<VisionResult>;
  dispose: () => Promise<unknown>;
};
let runner: Runner | undefined;
let runnerKey = "";
let device: Device = "wasm";
let running = false;
let closing = false;
const send = (message: WorkerReply) => self.postMessage(message);
const report = (progress: VisionPhase) => send({ type: "progress", progress });

function onProgress(info: ProgressInfo) {
  if (info.status === "progress_total" && info.total > 0)
    report({ phase: "download", loaded: info.loaded, total: info.total });
}

const png = (image: RawImage) => image.toBlob();

async function createRunner(request: VisionRequest, backend: Device): Promise<Runner> {
  const t = await import("@huggingface/transformers");
  t.env.allowLocalModels = false;
  const spec = models[modelKey(request.task, request.scale)];
  const { variant, id, revision } = choose(spec, { device: backend, f16: request.backend.f16 });
  const options: PretrainedModelOptions = {
    device: backend,
    dtype: variant.dtype,
    revision,
    progress_callback: onProgress,
  };
  /**
   * Models take RGB. Transparent pixels hold arbitrary colors, so flatten them onto a
   * background first: white for text and objects, black for depth (it reads as far away).
   */
  async function read(blob: Blob, background = 255) {
    const image = await t.RawImage.fromBlob(blob);
    if (image.channels !== 4) return image.rgb();
    const { data, width, height } = image;
    const rgb = new Uint8ClampedArray(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      const alpha = data[i + 3] / 255;
      for (let c = 0; c < 3; c++) rgb[j + c] = data[i + c] * alpha + background * (1 - alpha);
    }
    return new t.RawImage(rgb, width, height, 3);
  }
  const started = () => report({ phase: "start" });

  if (request.task === "background") {
    const pipe = await t.pipeline("image-segmentation", id, options);
    started();
    return {
      dispose: () => pipe.dispose(),
      run: async ({ image }) => {
        const input = await read(image);
        const masks = await pipe(input);
        return { image: await png(masks[0].mask), width: input.width, height: input.height };
      },
    };
  }
  if (request.task === "depth") {
    const pipe = await t.pipeline("depth-estimation", id, options);
    started();
    return {
      dispose: () => pipe.dispose(),
      run: async ({ image }) => {
        const input = await read(image, 0);
        const result = await pipe(input);
        const depth = Array.isArray(result) ? result[0].depth : result.depth;
        return { image: await png(depth), width: input.width, height: input.height };
      },
    };
  }
  if (request.task === "upscale") {
    const scale = request.scale ?? 2;
    const pipe = await t.pipeline("image-to-image", id, options);
    started();
    return {
      dispose: () => pipe.dispose(),
      run: async ({ image }) => {
        const input = (await t.RawImage.fromBlob(image)).rgb();
        const width = input.width * scale,
          height = input.height * scale;
        if (width * height > 32_000_000 || Math.max(width, height) > 8192)
          throw new Error("The result would be too large. Choose 2× or a smaller image.");
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext("2d")!;
        // Overlapping tiles keep memory flat and hide seams.
        const tileSize = 192,
          padding = 16;
        const total = Math.ceil(input.width / tileSize) * Math.ceil(input.height / tileSize);
        let done = 0;
        report({ phase: "run", done, total });
        for (let y = 0; y < input.height; y += tileSize)
          for (let x = 0; x < input.width; x += tileSize) {
            const left = Math.max(0, x - padding),
              top = Math.max(0, y - padding);
            const right = Math.min(input.width, x + tileSize + padding),
              bottom = Math.min(input.height, y + tileSize + padding);
            const tile = await input.crop([left, top, right - 1, bottom - 1]);
            const output = await pipe(tile);
            const bitmap = await createImageBitmap(
              await png(Array.isArray(output) ? output[0] : output),
            );
            const w = Math.min(tileSize, input.width - x) * scale,
              h = Math.min(tileSize, input.height - y) * scale;
            context.drawImage(
              bitmap,
              (x - left) * scale,
              (y - top) * scale,
              w,
              h,
              x * scale,
              y * scale,
              w,
              h,
            );
            bitmap.close();
            report({ phase: "run", done: ++done, total });
          }
        // The model only sees color, so carry transparency over with a smooth resize.
        // Opaque images pass through unchanged.
        const alpha = await createImageBitmap(image);
        context.imageSmoothingQuality = "high";
        context.globalCompositeOperation = "destination-in";
        context.drawImage(alpha, 0, 0, width, height);
        alpha.close();
        return { image: await canvas.convertToBlob({ type: "image/png" }), width, height };
      },
    };
  }
  if (request.task === "cutout") {
    const processor = (await t.AutoProcessor.from_pretrained(id, options)) as SamProcessor;
    const model = (await t.SamModel.from_pretrained(id, options)) as SamModel;
    started();
    let cachedImage = "";
    let embeddings: { image_embeddings: Tensor; image_positional_embeddings: Tensor } | undefined;
    const release = () => {
      embeddings?.image_embeddings.dispose();
      embeddings?.image_positional_embeddings.dispose();
      embeddings = undefined;
    };
    return {
      dispose: async () => {
        release();
        await model.dispose();
      },
      run: async ({ image, points = [] }) => {
        const input = await read(image);
        const inputs = await processor(input, {
          input_points: [points.map((p) => [p.x * input.width, p.y * input.height])],
          input_labels: [points.map((p) => p.label)],
        });
        // The image encoder is the slow half. Each new point only reruns the decoder.
        const digest = await crypto.subtle.digest("SHA-256", await image.arrayBuffer());
        const fingerprint = Array.from(new Uint8Array(digest)).join(",");
        if (cachedImage !== fingerprint) {
          release();
          embeddings = await model.get_image_embeddings(inputs);
          cachedImage = fingerprint;
        }
        const result = await model({ ...inputs, ...embeddings });
        const masks = await processor.post_process_masks(
          result.pred_masks,
          inputs.original_sizes,
          inputs.reshaped_input_sizes,
        );
        const scores = Array.from(result.iou_scores.data, Number);
        const best = scores.indexOf(Math.max(...scores));
        const mask = t.RawImage.fromTensor(masks[0][0][best].unsqueeze(0).mul(255).to("uint8"));
        return { image: await png(mask), width: input.width, height: input.height };
      },
    };
  }
  const processor = (await t.AutoProcessor.from_pretrained(id, options)) as Florence2Processor;
  const model = await t.Florence2ForConditionalGeneration.from_pretrained(id, options);
  started();
  return {
    dispose: () => model.dispose(),
    run: async ({ image }) => {
      const input = await read(image);
      const task = "<OCR_WITH_REGION>";
      const inputs = await processor(input, processor.construct_prompts(task));
      // Stream lines as they are read. Location tokens separate the lines.
      let streamed = "",
        last = 0;
      const streamer = new t.TextStreamer(processor.tokenizer!, {
        skip_prompt: true,
        skip_special_tokens: false,
        callback_function: (piece: string) => {
          streamed += piece;
          const now = performance.now();
          if (now - last < 100) return;
          last = now;
          const text = streamed
            .replace(/<\/?s>|<pad>/g, "")
            .replace(/(<loc_\d+>)+/g, "\n")
            .trim();
          report({ phase: "run", text });
        },
      });
      const ids = await model.generate({
        ...inputs,
        max_new_tokens: 1024,
        do_sample: false,
        num_beams: 1,
        streamer,
      });
      const text = processor.batch_decode(ids as Tensor, { skip_special_tokens: false })[0];
      const parsed = processor.post_process_generation(text, task, input.size)[task];
      if (typeof parsed === "string")
        return { text: parsed, width: input.width, height: input.height };
      const regions = (parsed.labels as string[])
        .map((label, i) => ({
          text: label.replace(/<\/?s>|<pad>/g, "").trim(),
          box: parsed.quad_boxes[i] as number[],
        }))
        .filter((region) => region.text);
      return {
        text: regions.map((r) => r.text).join("\n"),
        regions,
        width: input.width,
        height: input.height,
      };
    },
  };
}

async function dispose() {
  await runner?.dispose();
  runner = undefined;
  send({ type: "disposed" });
  self.close();
}

async function load(request: VisionRequest, backend: Device) {
  device = backend;
  report({ phase: "runtime" });
  runner = await createRunner(request, backend);
  send({ type: "device", device });
}

self.onmessage = async (event: MessageEvent<VisionRequest | { type: "dispose" }>) => {
  if ("type" in event.data) {
    closing = true;
    if (!running) await dispose();
    return;
  }
  if (running) return;
  running = true;
  const request = event.data;
  try {
    const key = modelKey(request.task, request.scale);
    if (runnerKey !== key) {
      await runner?.dispose();
      runner = undefined;
      runnerKey = key;
    }
    const preferred = choose(models[key], request.backend).device;
    if (!runner) {
      try {
        await load(request, preferred);
      } catch (error) {
        if (preferred === "wasm") throw error;
        await load(request, "wasm");
      }
    }
    report({ phase: "run" });
    let result: VisionResult;
    try {
      result = await runner!.run(request);
    } catch (error) {
      if (device !== "webgpu") throw error;
      // Some GPUs fail on large inputs. Retry on the CPU rather than fail.
      await runner!.dispose();
      runner = undefined;
      await load(request, "wasm");
      report({ phase: "run" });
      result = await runner!.run(request);
    }
    send({ type: "result", result });
  } catch (error) {
    try {
      await runner?.dispose();
    } catch {
      /* A failed session may already be released. */
    }
    runner = undefined;
    send({ type: "error", message: error instanceof Error ? error.message : String(error) });
  } finally {
    running = false;
    if (closing) await dispose();
  }
};
