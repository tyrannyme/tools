import { useEffect, useRef, useState } from "react";

export interface LocalImage {
  image: HTMLImageElement;
  name: string;
  url: string;
}
export function useLocalImage() {
  const [source, setSource] = useState<LocalImage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source.url);
    },
    [source],
  );
  async function load(file: File) {
    const request = ++sequence.current;
    setError("");
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type))
        throw new Error("Choose a PNG, JPEG, WebP, GIF, or BMP image.");
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.width * image.height > 16_777_216)
        throw new Error("Choose an image with at most 16 million pixels.");
      if (request !== sequence.current) {
        URL.revokeObjectURL(url);
        return;
      }
      const next = { image, name: file.name, url };
      setSource(next);
      return next;
    } catch (cause) {
      URL.revokeObjectURL(url);
      if (request === sequence.current)
        setError(
          cause instanceof Error && !(cause instanceof DOMException)
            ? cause.message
            : "This image could not be decoded. Try exporting it again as PNG.",
        );
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }
  function clear() {
    sequence.current++;
    setSource(null);
    setError("");
    setLoading(false);
  }
  return { source, load, clear, loading, error, setError };
}
export function canvas2d(width: number, height: number) {
  if (width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16_777_216)
    throw new Error("Output must fit within 8192 pixels per side and 16 million pixels total.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser does not support canvas rendering.");
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}
export function png(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export this image."))),
      "image/png",
    ),
  );
}
export const checkerboard = {
  backgroundImage:
    "conic-gradient(var(--muted) 25%, var(--background) 0 50%, var(--muted) 0 75%, var(--background) 0)",
  backgroundSize: "16px 16px",
};
