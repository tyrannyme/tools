export type VisionTask = "background" | "upscale" | "depth" | "cutout" | "ocr";
export type Device = "webgpu" | "wasm";
/** What this browser can run. `f16` means the GPU supports half-precision shaders. */
export interface Backend {
  device: Device;
  f16: boolean;
}
export interface Point {
  x: number;
  y: number;
  label: 0 | 1;
}
export interface VisionRequest {
  task: VisionTask;
  image: Blob;
  backend: Backend;
  scale?: 2 | 4;
  points?: Point[];
}
export interface VisionResult {
  image?: Blob;
  width: number;
  height: number;
  text?: string;
  regions?: { text: string; box: number[] }[];
}
/** Where a job is. `download` carries bytes, `run` may carry a fraction for tiled work. */
export type VisionPhase =
  | { phase: "runtime" }
  | { phase: "download"; loaded: number; total: number }
  | { phase: "start" }
  | { phase: "run"; done?: number; total?: number; text?: string };
export type WorkerReply =
  | { type: "progress"; progress: VisionPhase }
  | { type: "device"; device: Device }
  | { type: "result"; result: VisionResult }
  | { type: "error"; message: string }
  | { type: "disposed" };

type DType = "fp32" | "fp16" | "q8" | "q4";
/** One way to run a model: its precision and the ONNX files that precision downloads. */
export interface Variant {
  dtype: DType | Record<string, DType>;
  files: Record<string, number>;
  /** A lighter sibling model for this variant, when the main one is too slow there. */
  model?: { id: string; revision: string; name: string };
}
export interface ModelSpec {
  id: string;
  revision: string;
  name: string;
  license: string;
  /** For GPUs with half-precision support. */
  gpu16?: Variant;
  /** For GPUs without it. Missing means those GPUs use the CPU variant. */
  gpu32?: Variant;
  cpu: Variant;
}

const one = (dtype: DType, file: string, bytes: number): Variant => ({
  dtype,
  files: { [file]: bytes },
});

export const models = {
  background: {
    id: "onnx-community/BEN2-ONNX",
    revision: "c552aa82688edce09f0ac9d2e31ad53d9d629010",
    name: "BEN2",
    license: "MIT",
    gpu16: one("fp16", "onnx/model_fp16.onnx", 219_121_675),
    cpu: one("fp16", "onnx/model_fp16.onnx", 219_121_675),
  },
  upscale2: {
    id: "Xenova/swin2SR-classical-sr-x2-64",
    revision: "93dfc9089abda257351d3a58d5771e2c1ff69442",
    name: "Swin2SR 2×",
    license: "Apache 2.0",
    gpu16: one("fp16", "onnx/model_fp16.onnx", 32_428_109),
    gpu32: one("fp32", "onnx/model.onnx", 54_428_699),
    // The full model needs about 10 s per tile on one CPU thread. This one needs 3 s.
    cpu: {
      ...one("q8", "onnx/model_quantized.onnx", 7_082_844),
      model: {
        id: "Xenova/swin2SR-lightweight-x2-64",
        revision: "92a21aca5713f20faf9a87590cdfbdce2e34112c",
        name: "Swin2SR Lightweight 2×",
      },
    },
  },
  upscale4: {
    id: "Xenova/swin2SR-classical-sr-x4-64",
    revision: "c60eac19ef391153929330791f241a7c861b3214",
    name: "Swin2SR 4×",
    license: "Apache 2.0",
    gpu16: one("fp16", "onnx/model_fp16.onnx", 32_724_291),
    gpu32: one("fp32", "onnx/model.onnx", 55_020_184),
    cpu: one("q8", "onnx/model_quantized.onnx", 21_622_515),
  },
  depth: {
    id: "onnx-community/depth-anything-v2-small",
    revision: "4472b7362082ad9968fee890ca0f1e5aca36b93d",
    name: "Depth Anything V2 Small",
    license: "Apache 2.0",
    gpu16: one("fp16", "onnx/model_fp16.onnx", 49_642_442),
    gpu32: one("fp32", "onnx/model.onnx", 99_060_839),
    cpu: one("q8", "onnx/model_quantized.onnx", 27_258_801),
  },
  cutout: {
    id: "Xenova/slimsam-77-uniform",
    revision: "5850ab45f587c112167512ffef949107115e26a0",
    name: "SlimSAM",
    license: "Apache 2.0",
    gpu16: {
      dtype: "fp16",
      files: {
        "onnx/vision_encoder_fp16.onnx": 12_170_657,
        "onnx/prompt_encoder_mask_decoder_fp16.onnx": 8_550_118,
      },
    },
    gpu32: {
      dtype: "fp32",
      files: {
        "onnx/vision_encoder.onnx": 23_276_014,
        "onnx/prompt_encoder_mask_decoder.onnx": 16_557_892,
      },
    },
    cpu: {
      dtype: "q8",
      files: {
        "onnx/vision_encoder_quantized.onnx": 8_882_165,
        "onnx/prompt_encoder_mask_decoder_quantized.onnx": 4_903_810,
      },
    },
  },
  ocr: {
    id: "onnx-community/Florence-2-base-ft",
    revision: "e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f",
    name: "Florence-2 Base",
    license: "MIT",
    gpu16: {
      dtype: {
        embed_tokens: "fp16",
        vision_encoder: "fp16",
        encoder_model: "q4",
        decoder_model_merged: "q4",
      },
      files: {
        "onnx/embed_tokens_fp16.onnx": 78_780_290,
        "onnx/vision_encoder_fp16.onnx": 183_930_536,
        "onnx/encoder_model_q4.onnx": 30_058_778,
        "onnx/decoder_model_merged_q4.onnx": 64_393_474,
      },
    },
    cpu: {
      dtype: {
        embed_tokens: "q8",
        vision_encoder: "q8",
        encoder_model: "q4",
        decoder_model_merged: "q4",
      },
      files: {
        "onnx/embed_tokens_quantized.onnx": 39_390_433,
        "onnx/vision_encoder_quantized.onnx": 93_746_540,
        "onnx/encoder_model_q4.onnx": 30_058_778,
        "onnx/decoder_model_merged_q4.onnx": 64_393_474,
      },
    },
  },
} satisfies Record<string, ModelSpec>;
export type ModelKey = keyof typeof models;

export const modelKey = (task: VisionTask, scale: 2 | 4 = 2): ModelKey =>
  task === "upscale" ? (scale === 4 ? "upscale4" : "upscale2") : task;

/** The device, model, and files used on this browser. */
export function choose(spec: ModelSpec, backend: Backend) {
  let device: Device = "wasm",
    variant = spec.cpu;
  if (backend.device === "webgpu") {
    const gpu = backend.f16 ? (spec.gpu16 ?? spec.gpu32) : spec.gpu32;
    if (gpu) {
      device = "webgpu";
      variant = gpu;
    }
  }
  const model = variant.model ?? spec;
  return { device, variant, id: model.id, revision: model.revision, name: model.name };
}

export const bytesOf = (variant: Variant) =>
  Object.values(variant.files).reduce((sum, bytes) => sum + bytes, 0);
