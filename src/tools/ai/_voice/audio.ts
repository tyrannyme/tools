const sampleRate = 16000;
const maxDuration = 30 * 60;

async function resample(buffer: AudioBuffer) {
  const context = new OfflineAudioContext(1, Math.ceil(buffer.duration * sampleRate), sampleRate);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  return (await context.startRendering()).getChannelData(0);
}

export async function decodeAudio(
  file: File,
  signal: AbortSignal,
  progress: (percent: number) => void,
): Promise<Float32Array> {
  if (file.size > 500 * 1024 * 1024)
    throw new Error("Choose a file smaller than 500 MB to keep memory use manageable.");
  const { Input, BlobSource, ALL_FORMATS, AudioBufferSink } = await import("mediabunny");
  signal.throwIfAborted();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track)
      throw new Error("This file has no audio track. Choose an audio file or a video with sound.");
    const duration = await track.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0 || duration > maxDuration)
      throw new Error("Choose a recording between one second and 30 minutes long.");
    if (!(await track.canDecode())) throw new Error("This audio codec cannot be decoded here.");
    const samples = new Float32Array(Math.ceil(duration * sampleRate));
    const sink = new AudioBufferSink(track);
    let batch: { buffer: AudioBuffer; timestamp: number; duration: number }[] = [];
    async function flush() {
      if (!batch.length) return;
      const start = Math.max(0, batch[0].timestamp);
      const last = batch[batch.length - 1];
      const end = Math.min(duration, last.timestamp + last.duration);
      if (end <= start) {
        batch = [];
        return;
      }
      const context = new OfflineAudioContext(1, Math.ceil((end - start) * sampleRate), sampleRate);
      for (const item of batch) {
        const source = context.createBufferSource();
        source.buffer = item.buffer;
        source.connect(context.destination);
        source.start(Math.max(0, item.timestamp - start), Math.max(0, start - item.timestamp));
      }
      const mono = (await context.startRendering()).getChannelData(0);
      signal.throwIfAborted();
      const offset = Math.round(start * sampleRate);
      if (offset < samples.length) samples.set(mono.subarray(0, samples.length - offset), offset);
      progress(Math.min(100, (end / duration) * 100));
      batch = [];
    }
    for await (const item of sink.buffers()) {
      signal.throwIfAborted();
      batch.push(item);
      if (item.timestamp + item.duration - batch[0].timestamp >= 8) await flush();
    }
    await flush();
    return samples;
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof Error && /no audio track|30 minutes/.test(error.message)) throw error;
    // Web Audio covers formats/codecs not exposed through WebCodecs.
    const context = new AudioContext();
    try {
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      signal.throwIfAborted();
      if (buffer.duration > maxDuration)
        throw new Error("Choose a recording no longer than 30 minutes.");
      return await resample(buffer);
    } catch (fallbackError) {
      signal.throwIfAborted();
      if (fallbackError instanceof Error && /30 minutes/.test(fallbackError.message))
        throw fallbackError;
      throw new Error(
        "Could not decode this file's audio. Try a WAV, MP3, M4A, or a video with an AAC audio track.",
      );
    } finally {
      await context.close();
    }
  } finally {
    input.dispose();
  }
}

export function wavBlob(chunks: Float32Array[], rate: number): Blob {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
      offset += 2;
    }
  return new Blob([buffer], { type: "audio/wav" });
}
