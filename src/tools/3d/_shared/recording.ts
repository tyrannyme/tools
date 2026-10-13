export type VideoFormat = "mp4" | "webm";

export interface RecordOptions {
  seconds: number;
  format: VideoFormat;
  transparent: boolean;
  onProgress: (progress: number) => void;
  signal: AbortSignal;
}

const frameRate = 30;
const mp4Unavailable =
  "This browser cannot encode MP4 (H.264) video. Choose WebM, or try Chrome, Edge, or Safari.";

/** Whether WebCodecs can encode H.264 at this square size. */
export async function canRecordMp4(size: number) {
  const { canEncodeVideo } = await import("mediabunny");
  return canEncodeVideo("avc", { width: size, height: size }).catch(() => false);
}

/** Renders one full rotation frame by frame and encodes it. */
export async function recordTurntable(
  canvas: HTMLCanvasElement,
  render: (angle: number) => void,
  { seconds, format, transparent, onProgress, signal }: RecordOptions,
) {
  const {
    Output,
    Mp4OutputFormat,
    WebMOutputFormat,
    BufferTarget,
    CanvasSource,
    QUALITY_HIGH,
    canEncodeVideo,
  } = await import("mediabunny");
  const alpha = transparent && format === "webm" ? "keep" : "discard";
  const codec = format === "mp4" ? "avc" : "vp9";
  const size = { width: canvas.width, height: canvas.height, alpha } as const;
  if (await canEncodeVideo(codec, size)) {
    const output = new Output({
      format:
        format === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
      target: new BufferTarget(),
    });
    const source = new CanvasSource(canvas, {
      codec,
      bitrate: QUALITY_HIGH,
      alpha,
      latencyMode: "quality",
    });
    output.addVideoTrack(source, { frameRate });
    try {
      await output.start();
      const frames = Math.round(seconds * frameRate);
      for (let frame = 0; frame < frames; frame++) {
        signal.throwIfAborted();
        render((frame / frames) * Math.PI * 2);
        await source.add(frame / frameRate, 1 / frameRate);
        onProgress((frame + 1) / frames);
        // Give controls and cancellation a turn between encoded frames.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      source.close();
      await output.finalize();
      signal.throwIfAborted();
      return new Blob([output.target.buffer!], { type: `video/${format}` });
    } catch (error) {
      if (output.state === "pending" || output.state === "started") await output.cancel();
      throw error;
    }
  }
  if (format === "mp4") throw new Error(mp4Unavailable);
  if (transparent)
    throw new Error(
      "This browser cannot encode transparent video. Turn off Transparent, or try Chrome or Edge.",
    );
  return recordRealtime(canvas, render, seconds, onProgress, signal);
}

/** WebM fallback for browsers without WebCodecs: records the canvas in real time. */
async function recordRealtime(
  canvas: HTMLCanvasElement,
  render: (angle: number) => void,
  seconds: number,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
) {
  if (typeof MediaRecorder === "undefined" || !canvas.captureStream)
    throw new Error("This browser cannot record video. Try Chrome, Edge, or Firefox.");
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  if (!mimeType) throw new Error("This browser cannot record WebM video. Try Chrome or Firefox.");
  signal.throwIfAborted();
  render(0);
  const stream = canvas.captureStream(frameRate),
    chunks: Blob[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let cancel: (() => void) | undefined;
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 10_000_000 });
      cancel = () => {
        if (recorder.state !== "inactive") recorder.stop();
        reject(new Error("Recording canceled."));
      };
      signal.addEventListener("abort", cancel, { once: true });
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        cancel?.();
        reject(new Error("The browser could not encode this video. Try a lower resolution."));
      };
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      recorder.onstart = () => {
        const start = performance.now();
        timer = setInterval(() => {
          const progress = Math.min((performance.now() - start) / (seconds * 1000), 1);
          render(progress * Math.PI * 2);
          onProgress(progress);
          if (progress === 1 && recorder.state !== "inactive") recorder.stop();
        }, 1000 / frameRate);
      };
      recorder.start();
    });
  } finally {
    clearInterval(timer);
    if (cancel) signal.removeEventListener("abort", cancel);
    stream.getTracks().forEach((track) => track.stop());
  }
}
