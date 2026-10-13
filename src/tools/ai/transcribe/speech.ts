const rate = 16000;

export function rms(samples: Float32Array, start = 0, end = samples.length) {
  start = Math.max(0, Math.floor(start));
  end = Math.min(samples.length, Math.ceil(end));
  if (end <= start) return 0;
  let energy = 0;
  for (let i = start; i < end; i++) energy += samples[i] ** 2;
  return Math.sqrt(energy / (end - start));
}

/** Check short windows so a brief word in a mostly silent recording is not lost. */
export function nearSilent(samples: Float32Array) {
  for (let start = 0; start < samples.length; start += rate / 10) {
    if (rms(samples, start, start + rate / 10) >= 0.0003) return false;
  }
  return true;
}

const hallucinations = new Set([
  "thank you",
  "thanks",
  "thanks for watching",
  "thank you for watching",
  "thanks for listening",
  "thank you for listening",
  "you",
  "bye",
  "bye bye",
  "subscribe",
  "music",
  "silence",
]);

export function keepSpeech(text: string, samples: Float32Array, start: number, end: number) {
  const audio = samples.subarray(Math.max(0, Math.floor(start * rate)), Math.ceil(end * rate));
  if (!audio.length || nearSilent(audio)) return false;
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return !(rms(audio) < 0.015 && hallucinations.has(words));
}
