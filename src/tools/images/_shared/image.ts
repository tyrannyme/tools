import { formatBytes } from "@/lib/files";

export type Format = "png" | "jpeg" | "webp" | "avif";
export const mime = (format: Format) => `image/${format}`;
export const extension = (format: Format) => (format === "jpeg" ? "jpg" : format);
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "Could not process this image. Try a different file.";

export async function readImage(file: Blob) {
  if (!file.type.startsWith("image/"))
    throw new Error("Choose an image file supported by your browser.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 32_000_000)
      throw new Error("Choose an image smaller than 32 megapixels.");
    return image;
  } catch (error) {
    if (error instanceof Error && error.message.includes("megapixels")) throw error;
    throw new Error(
      "This image could not be opened. Try PNG, JPEG, WebP, or another browser-supported image.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasOf(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 16384 ||
    height > 16384 ||
    width * height > 32_000_000
  ) {
    throw new Error(
      "Use whole-number dimensions from 1 to 16,384 pixels, with at most 32 megapixels.",
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser does not support image editing with Canvas.");
  return { canvas, context };
}

export async function encode(canvas: HTMLCanvasElement, format: Format, quality: number) {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime(format), quality),
  );
  if (!blob || blob.type !== mime(format))
    throw new Error(
      `${format.toUpperCase()} encoding is not supported in this browser. Choose another format.`,
    );
  return blob;
}

export async function resizeImage(
  image: HTMLImageElement,
  width: number,
  height: number,
  format: Format,
  quality: number,
  target?: number,
) {
  const { canvas, context } = canvasOf(width, height);
  if (format === "jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  let blob = await encode(canvas, format, quality);
  if (!target || blob.size <= target) return { blob, quality };
  if (format === "png")
    throw new Error(
      `This PNG is ${formatBytes(blob.size)}. PNG has no quality setting, so choose WebP or JPEG, or make the image smaller.`,
    );
  let low = 0;
  let high = quality;
  let best = await encode(canvas, format, 0);
  let bestQuality = 0;
  if (best.size > target)
    throw new Error(
      `At ${width} × ${height} the smallest ${format === "jpeg" ? "JPEG" : "WebP"} is ${formatBytes(best.size)}. Make the image smaller or raise the size limit.`,
    );
  for (let i = 0; i < 7; i++) {
    const middle = (low + high) / 2;
    blob = await encode(canvas, format, middle);
    if (blob.size <= target) {
      best = blob;
      bestQuality = middle;
      low = middle;
    } else high = middle;
  }
  return { blob: best, quality: bestQuality };
}

/** Zips files without recompressing them. Repeated names get a number. */
export async function zipFiles(files: { name: string; blob: Blob }[]) {
  const { zip } = await import("fflate");
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    const safe = file.name.replace(/[\\/]/g, "_");
    let name = safe;
    for (let n = 2; name in entries; n++)
      name = safe.replace(/(\.[^.]*)?$/, (ext) => `-${n}${ext}`);
    entries[name] = new Uint8Array(await file.blob.arrayBuffer());
  }
  const bytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) =>
    zip(entries, { level: 0 }, (error, result) =>
      error ? reject(error) : resolve(result as Uint8Array<ArrayBuffer>),
    ),
  );
  return new Blob([bytes], { type: "application/zip" });
}
