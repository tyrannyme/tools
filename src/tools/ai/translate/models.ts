import type { ModelInfo } from "../_voice/ui";

export interface TranslationModel extends ModelInfo {
  id: string;
  revision: string;
  files: number;
  cache: string[];
}

// Verified against Xenova file metadata and the linked Helsinki-NLP model cards.
// Quantized encoder + merged decoder, tokenizer, and configuration files.
const pairs: Record<string, { revision: string; bytes: number; license: string }> = {
  "en-fr": {
    revision: "28726206f80896b90035bd99cccd5cc1e151f916",
    bytes: 113111807,
    license: "Apache 2.0",
  },
  "fr-en": {
    revision: "6b166a182780e118c997879d0ad5be4b53671644",
    bytes: 113111807,
    license: "Apache 2.0",
  },
  "en-es": {
    revision: "4b002a4c7edd54a7ced58877258b87f7efd3f892",
    bytes: 119377345,
    license: "Apache 2.0",
  },
  "es-en": {
    revision: "eadfd7c658a9d8929ac3b8e996b68a68e2c7d480",
    bytes: 119377310,
    license: "Apache 2.0",
  },
  "en-de": {
    revision: "1ca130c44c4c5441ef16d48aae521a424ab644f7",
    bytes: 111519854,
    license: "CC BY 4.0",
  },
  "de-en": {
    revision: "399dfd68706739fffd503f876093e455ae268a06",
    bytes: 111519819,
    license: "Apache 2.0",
  },
  "en-it": {
    revision: "075406e3c8c2c30634d4a1bd8f00c21d9e162011",
    bytes: 136474118,
    license: "Apache 2.0",
  },
  "it-en": {
    revision: "fd0b89b9c052adc1f2f64152f555aa17353728be",
    bytes: 136865467,
    license: "Apache 2.0",
  },
};

export function translationModel(source: string, target: string): TranslationModel | null {
  const pair = `${source}-${target}`;
  const info = pairs[pair];
  if (!info) return null;
  const id = `Xenova/opus-mt-${pair}`;
  const prefix = `${id}/resolve/${info.revision}/`;
  return {
    id,
    name: `OPUS-MT ${pair}`,
    href: `https://huggingface.co/${id}`,
    license: info.license,
    revision: info.revision,
    files: info.bytes,
    // Includes approximately 5.5 MB for the compressed WASM runtime on first use.
    bytes: info.bytes + 5_500_000,
    cache: [
      "config.json",
      "generation_config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "onnx/encoder_model_quantized.onnx",
      "onnx/decoder_model_merged_quantized.onnx",
    ].map((file) => `${prefix}${file}`),
  };
}
