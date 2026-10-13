import { canvasOf } from "../_shared/image";
export type Mode = "blackout" | "pixelate" | "blur";
export type Region = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  mode: Mode;
};
export function renderRedactions(image: HTMLImageElement, regions: Region[], maxSide?: number) {
  const scale = maxSide
    ? Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    : 1;
  const { canvas, context } = canvasOf(
    Math.max(1, Math.round(image.naturalWidth * scale)),
    Math.max(1, Math.round(image.naturalHeight * scale)),
  );
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const region of regions) {
    const x = Math.floor(region.x * scale);
    const y = Math.floor(region.y * scale);
    const width = Math.max(1, Math.ceil((region.x + region.width) * scale) - x);
    const height = Math.max(1, Math.ceil((region.y + region.height) * scale) - y);
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    if (region.mode === "blackout") {
      context.fillStyle = "#000000";
      context.fillRect(x, y, width, height);
    } else if (region.mode === "pixelate") {
      const small = canvasOf(
        Math.max(1, Math.ceil(region.width / 18)),
        Math.max(1, Math.ceil(region.height / 18)),
      );
      small.context.drawImage(
        canvas,
        x,
        y,
        width,
        height,
        0,
        0,
        small.canvas.width,
        small.canvas.height,
      );
      context.imageSmoothingEnabled = false;
      context.drawImage(
        small.canvas,
        0,
        0,
        small.canvas.width,
        small.canvas.height,
        x,
        y,
        width,
        height,
      );
    } else {
      if (!("filter" in context))
        throw new Error("Blur is not supported in this browser. Choose pixelate or black out.");
      const radius = Math.max(3, 16 * scale);
      const padding = Math.ceil(radius * 3);
      const left = Math.max(0, x - padding);
      const top = Math.max(0, y - padding);
      const crop = canvasOf(
        Math.max(1, Math.min(canvas.width - left, width + padding * 2)),
        Math.max(1, Math.min(canvas.height - top, height + padding * 2)),
      );
      crop.context.drawImage(
        canvas,
        left,
        top,
        crop.canvas.width,
        crop.canvas.height,
        0,
        0,
        crop.canvas.width,
        crop.canvas.height,
      );
      context.filter = `blur(${radius}px)`;
      context.drawImage(crop.canvas, left, top);
    }
    context.restore();
  }
  return canvas;
}
