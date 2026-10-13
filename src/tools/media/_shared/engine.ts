import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioSample,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  WavOutputFormat,
  WebMOutputFormat,
} from "mediabunny";
import type { ConversionAudioOptions, ConversionVideoOptions } from "mediabunny";

export type Mode = "compress" | "trim" | "extract" | "audio" | "loop";
export type Format = "mp4" | "webm" | "m4a" | "wav";
export interface MediaInfo {
  file: File;
  duration: number;
  width: number;
  height: number;
  audio: boolean;
  /** Codec of the primary audio track, such as "aac" or "opus". */
  audioCodec: string | null;
}
export const openInput = (file: File) =>
  new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

export async function inspect(file: File, mode: Mode): Promise<MediaInfo> {
  const input = openInput(file);
  try {
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    if (mode === "audio" || mode === "extract") {
      if (!audio) throw new Error("This file has no audio track. Choose a file with sound.");
    } else if (!video) throw new Error("This file has no video track. Choose a video file.");
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error("Could not read the duration of this file.");
    return {
      file,
      duration,
      width: video ? await video.getDisplayWidth() : 0,
      height: video ? await video.getDisplayHeight() : 0,
      audio: !!audio,
      audioCodec: audio?.codec ?? null,
    };
  } finally {
    input.dispose();
  }
}

export async function waveform(file: File, duration: number, signal: AbortSignal) {
  const input = openInput(file);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode()))
      throw new Error(
        "This browser cannot decode the audio waveform. Try a WAV file or another browser.",
      );
    const peaks = new Array<number>(240).fill(0);
    for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
      if (signal.aborted) throw new Error("Canceled");
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          const bin = Math.floor(((timestamp + i / buffer.sampleRate) / duration) * peaks.length);
          if (bin >= 0 && bin < peaks.length)
            peaks[bin] = Math.max(peaks[bin]!, Math.abs(data[i]!));
        }
      }
    }
    return peaks;
  } finally {
    input.dispose();
  }
}

export interface ExportSettings {
  mode: Mode;
  format: Format;
  start: number;
  end: number;
  targetMb: number;
  height: number;
  fps: number;
  fadeIn: number;
  fadeOut: number;
}
export async function convert(
  info: MediaInfo,
  settings: ExportSettings,
  signal: AbortSignal,
  progress: (value: number, pass: number) => void,
) {
  const { mode, format } = settings;
  const targetBytes = settings.targetMb * 1_000_000;
  const totalBitrate = Math.floor(
    (Math.min(targetBytes, info.file.size) * 8 * 0.9) / info.duration,
  );
  const audioBitrate = Math.min(128_000, Math.floor(totalBitrate * 0.15));
  let bitrate = totalBitrate - (info.audio ? audioBitrate : 0);
  if (mode === "compress" && bitrate < 32_000)
    throw new Error("This target is too small for the video's duration. Choose a larger size.");
  for (let pass = 1; pass <= 3; pass++) {
    if (signal.aborted) throw new Error("Canceled");
    const input = openInput(info.file);
    const target = new BufferTarget();
    const output = new Output({
      target,
      format:
        format === "wav"
          ? new WavOutputFormat()
          : format === "webm"
            ? new WebMOutputFormat()
            : new Mp4OutputFormat({ fastStart: "in-memory" }),
    });
    let conversion: Conversion | undefined;
    const cancel = () => {
      void conversion?.cancel().catch(() => {});
    };
    try {
      const video: ConversionVideoOptions =
        mode === "extract" || mode === "audio"
          ? { discard: true }
          : mode === "trim"
            ? {}
            : {
                codec: format === "webm" ? "vp9" : "avc",
                forceTranscode: true,
                height: settings.height ? Math.min(settings.height, info.height) : undefined,
                frameRate: settings.fps || undefined,
                quality:
                  mode === "compress"
                    ? new Quality({ bitrate, bitrateMode: "constant" })
                    : new Quality("high"),
              };
      const audio: ConversionAudioOptions =
        mode === "loop"
          ? { discard: true }
          : mode === "trim"
            ? {}
            : {
                codec: format === "wav" ? "pcm-s16" : format === "webm" ? "opus" : "aac",
                quality:
                  mode === "compress"
                    ? new Quality({ bitrate: Math.max(8_000, audioBitrate) })
                    : undefined,
                forceTranscode: mode === "compress",
              };
      if (mode === "audio" && (settings.fadeIn > 0 || settings.fadeOut > 0)) {
        audio.process = (sample) => {
          const buffer = sample.toAudioBuffer();
          const length = settings.end - settings.start;
          for (let c = 0; c < buffer.numberOfChannels; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < data.length; i++) {
              const time = sample.timestamp + i / buffer.sampleRate;
              const gain = Math.max(
                0,
                Math.min(
                  1,
                  settings.fadeIn ? time / settings.fadeIn : 1,
                  settings.fadeOut ? (length - time) / settings.fadeOut : 1,
                ),
              );
              data[i]! *= gain;
            }
          }
          return AudioSample.fromAudioBuffer(buffer, sample.timestamp);
        };
      }
      conversion = await Conversion.init({
        input,
        output,
        tracks: "primary",
        video,
        audio,
        trim:
          mode === "trim" || mode === "audio" || mode === "loop"
            ? { start: settings.start, end: settings.end }
            : undefined,
        copy: mode === "extract" ? {} : { boundaryTolerance: 0 },
        showWarnings: false,
      });
      if (
        !conversion.isValid ||
        conversion.discardedTracks.some((track) => track.reason !== "discarded_by_user")
      ) {
        await conversion.cancel();
        const failed = conversion.discardedTracks.find(
          (track) => track.reason !== "discarded_by_user",
        );
        const kind = failed?.track.type ?? "media";
        const container = { mp4: "MP4", webm: "WebM", m4a: "M4A", wav: "WAV" }[format];
        throw new Error(
          failed?.reason === "undecodable_source_codec"
            ? `This browser cannot decode the ${kind} in this file. Try another browser, such as a current Chrome or Safari.`
            : `This browser cannot encode ${kind} for ${container}. Choose another format.`,
        );
      }
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) {
        await conversion.cancel();
        throw new Error("Canceled");
      }
      conversion.onProgress = (value) => progress(value, pass);
      await conversion.execute();
      if (signal.aborted) throw new Error("Canceled");
      if (!target.buffer) throw new Error("The export did not produce a file.");
      const blob = new Blob([target.buffer], {
        type:
          format === "wav"
            ? "audio/wav"
            : format === "m4a"
              ? "audio/mp4"
              : format === "webm" && mode === "extract"
                ? "audio/webm"
                : `video/${format}`,
      });
      if (mode !== "compress" || blob.size <= targetBytes) return blob;
      bitrate = Math.floor(((bitrate * targetBytes) / blob.size) * 0.85);
    } catch (error) {
      await conversion?.cancel().catch(() => {});
      throw error;
    } finally {
      signal.removeEventListener("abort", cancel);
      input.dispose();
    }
  }
  throw new Error(
    "The encoder could not fit this video under the target after three passes. Try a larger target or a lower resolution and frame rate.",
  );
}
