import { canvasOf } from "../_shared/image";
export type Color = { hex: string; rgb: string; oklch: string; channels: number[]; share: number };
export function colorFrom(channels: number[], share: number): Color {
  const rgb = channels.map((value) => Math.round(Math.max(0, Math.min(255, value))));
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const light = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(a, bb);
  const hue = chroma < 0.00001 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return {
    hex: `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase(),
    rgb: `rgb(${rgb.join(" ")})`,
    oklch: `oklch(${(light * 100).toFixed(2)}% ${chroma.toFixed(4)} ${hue.toFixed(2)})`,
    channels: rgb,
    share,
  };
}
/** Bounded samples and a yield between iterations keep extraction responsive. */
export async function extractColors(image: HTMLImageElement, count: number) {
  const scale = Math.min(1, 160 / Math.max(image.naturalWidth, image.naturalHeight));
  const { canvas, context } = canvasOf(
    Math.max(1, Math.round(image.naturalWidth * scale)),
    Math.max(1, Math.round(image.naturalHeight * scale)),
  );
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels: number[][] = [];
  for (let i = 0; i < bytes.length; i += 4)
    if (bytes[i + 3] > 127) pixels.push([bytes[i], bytes[i + 1], bytes[i + 2]]);
  if (!pixels.length)
    throw new Error("This image is transparent. Choose an image with visible colors.");
  const distance = (a: number[], b: number[]) =>
    a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0);
  const centers = [pixels[Math.floor(pixels.length / 2)].slice()];
  while (centers.length < count) {
    let farthest = pixels[0];
    let max = 0;
    for (const pixel of pixels) {
      const d = Math.min(...centers.map((center) => distance(pixel, center)));
      if (d > max) {
        max = d;
        farthest = pixel;
      }
    }
    if (max < 1) break;
    centers.push(farthest.slice());
  }
  let counts: number[] = [];
  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts = centers.map(() => 0);
    for (const pixel of pixels) {
      let nearest = 0;
      let best = Infinity;
      centers.forEach((center, index) => {
        const d = distance(pixel, center);
        if (d < best) {
          best = d;
          nearest = index;
        }
      });
      counts[nearest]++;
      pixel.forEach((value, channel) => {
        sums[nearest][channel] += value;
      });
    }
    centers.forEach((center, index) => {
      if (counts[index])
        center.forEach((_, channel) => {
          center[channel] = sums[index][channel] / counts[index];
        });
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return centers
    .map((center, index) => colorFrom(center, counts[index] / pixels.length))
    .filter((color) => color.share > 0)
    .sort((a, b) => b.share - a.share);
}
