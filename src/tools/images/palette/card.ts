import { canvasOf } from "../_shared/image";
import type { Color } from "./colors";

const width = 1200;
const height = 675;
const scale = 2;
const pad = 40;
const gap = 24;
const footer = 52;

function luminance([r, g, b]: number[]) {
  const [lr, lg, lb] = [r!, g!, b!].map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

/** Black or white, whichever reads better on the swatch. */
function ink(channels: number[]) {
  const l = luminance(channels);
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#0a0a0a" : "#ffffff";
}

/**
 * A 1200 x 675 (16:9) share card, drawn at 2x: the photo on the left and the
 * palette as labelled bars on the right.
 */
export async function drawPaletteCard(image: HTMLImageElement, colors: Color[]) {
  await document.fonts.ready;
  const sans = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const mono = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
  const { canvas, context } = canvasOf(width * scale, height * scale);
  context.scale(scale, scale);
  context.fillStyle = "#fafafa";
  context.fillRect(0, 0, width, height);

  // Photo, cropped to fill a panel whose width follows the photo's shape.
  const panelHeight = height - pad - footer;
  const ratio = image.naturalWidth / image.naturalHeight;
  const photoWidth = Math.round(Math.min(720, Math.max(440, panelHeight * ratio)));
  const cover = Math.max(photoWidth / image.naturalWidth, panelHeight / image.naturalHeight);
  const cropWidth = photoWidth / cover;
  const cropHeight = panelHeight / cover;
  context.save();
  context.beginPath();
  context.roundRect(pad, pad, photoWidth, panelHeight, 18);
  context.fillStyle = "#ededed";
  context.fill();
  context.clip();
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    (image.naturalWidth - cropWidth) / 2,
    (image.naturalHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    pad,
    pad,
    photoWidth,
    panelHeight,
  );
  context.restore();
  context.save();
  context.beginPath();
  context.roundRect(pad + 0.5, pad + 0.5, photoWidth - 1, panelHeight - 1, 18);
  context.strokeStyle = "rgb(0 0 0 / 0.08)";
  context.lineWidth = 1;
  context.stroke();
  context.restore();

  // Palette bars, largest share first.
  const left = pad + photoWidth + gap;
  const barWidth = width - pad - left;
  const barGap = colors.length > 8 ? 6 : 8;
  const barHeight = (panelHeight - barGap * (colors.length - 1)) / colors.length;
  const size = Math.round(Math.min(26, Math.max(15, barHeight * 0.32)));
  colors.forEach((color, index) => {
    const top = pad + index * (barHeight + barGap);
    context.beginPath();
    context.roundRect(left, top, barWidth, barHeight, Math.min(14, barHeight / 3));
    context.fillStyle = color.hex;
    context.fill();
    const text = ink(color.channels);
    context.fillStyle = text;
    context.textBaseline = "middle";
    context.font = `600 ${size}px ${mono}`;
    context.textAlign = "left";
    context.fillText(color.hex, left + 22, top + barHeight / 2 + 1);
    context.globalAlpha = 0.72;
    context.font = `500 ${Math.round(size * 0.8)}px ${sans}`;
    context.textAlign = "right";
    context.fillText(
      `${Math.max(1, Math.round(color.share * 100))}%`,
      left + barWidth - 22,
      top + barHeight / 2 + 1,
    );
    context.globalAlpha = 1;
  });

  // Footer: a small gold diamond and the site name.
  const baseline = height - footer / 2 + 2;
  context.textBaseline = "middle";
  context.textAlign = "right";
  context.font = `500 15px ${sans}`;
  context.fillStyle = "#737373";
  const label = "tools.tyranny.me";
  context.fillText(label, width - pad, baseline);
  const labelWidth = context.measureText(label).width;
  context.save();
  context.translate(width - pad - labelWidth - 14, baseline);
  context.rotate(Math.PI / 4);
  context.fillStyle = "#a07c32";
  context.fillRect(-3.5, -3.5, 7, 7);
  context.restore();
  return canvas;
}
