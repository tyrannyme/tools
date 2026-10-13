export type RGB = [number, number, number];
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const linear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const gamma = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
const round = (value: number, digits = 3) => Number(value.toFixed(digits));
export function hex(rgb: RGB) {
  return `#${rgb
    .map((value) =>
      Math.round(clamp(value) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// Oklab matrices: https://bottosson.github.io/posts/oklab/
export function toOklab(rgb: RGB): RGB {
  const [r, g, b] = rgb.map(linear);
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function fromOklab([lightness, a, b]: RGB): RGB {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
function fromHsl(hue: number, saturation: number, lightness: number): RGB {
  const h = (((hue % 360) + 360) % 360) / 60;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  const offset = lightness - chroma / 2;
  return [
    h < 1
      ? [chroma, x, 0]
      : h < 2
        ? [x, chroma, 0]
        : h < 3
          ? [0, chroma, x]
          : h < 4
            ? [0, x, chroma]
            : h < 5
              ? [x, 0, chroma]
              : [chroma, 0, x],
  ][0]!.map((value) => value + offset) as RGB;
}
export function parseColor(input: string): { rgb: RGB; clipped: boolean } {
  const source = input.trim().toLowerCase();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(source);
  if (match) {
    const full =
      match[1]!.length === 3
        ? [...match[1]!].map((character) => character + character).join("")
        : match[1]!;
    return {
      rgb: [0, 2, 4].map(
        (offset) => Number.parseInt(full.slice(offset, offset + 2), 16) / 255,
      ) as RGB,
      clipped: false,
    };
  }
  const functional = /^(rgb|hsl|oklab|oklch)\(([^)]+)\)$/.exec(source);
  if (!functional)
    throw new Error(
      "Enter hex, rgb(), hsl(), oklab(), or oklch(). Use opaque colors without alpha.",
    );
  const format = functional[1]!;
  const parts = functional[2]!.trim().split(/[\s,]+/);
  if (
    parts.length !== 3 ||
    parts.some((part) => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:%|deg)?$/.test(part))
  )
    throw new Error("Use three valid color components without alpha.");
  const numeric = parts.map((part) => Number.parseFloat(part));
  if (numeric.some((value) => !Number.isFinite(value)))
    throw new Error("Color components must be finite numbers.");
  const [first, second, third] = numeric as RGB;
  let rgb: RGB;
  if (format === "rgb") {
    if (parts.some((part) => part.endsWith("deg")))
      throw new Error("RGB channels must be numbers or percentages.");
    rgb = numeric.map((value, index) => value / (parts[index]!.endsWith("%") ? 100 : 255)) as RGB;
    if (rgb.some((value) => value < 0 || value > 1))
      throw new Error("RGB channels must be 0 to 255, or 0% to 100%.");
  } else if (format === "hsl") {
    if (
      parts[0]!.endsWith("%") ||
      !parts[1]!.endsWith("%") ||
      !parts[2]!.endsWith("%") ||
      second < 0 ||
      second > 100 ||
      third < 0 ||
      third > 100
    )
      throw new Error("Use hsl(hue saturation% lightness%), with percentages from 0 to 100.");
    rgb = fromHsl(first, second / 100, third / 100);
  } else {
    if (
      parts[0]!.endsWith("deg") ||
      parts[1]!.endsWith("deg") ||
      (format === "oklab" && parts[2]!.endsWith("deg")) ||
      (format === "oklch" && parts[2]!.endsWith("%"))
    )
      throw new Error("Only hue can use degrees; OKLCH hue cannot be a percentage.");
    const l = parts[0]!.endsWith("%") ? first / 100 : first;
    const a = parts[1]!.endsWith("%") ? second * 0.004 : second;
    const b = parts[2]!.endsWith("%") ? third * 0.004 : third;
    if (l < 0 || l > 1 || (format === "oklch" && a < 0))
      throw new Error("Lightness must be 0 to 1 (or 0% to 100%); chroma cannot be negative.");
    rgb = fromOklab(
      format === "oklab"
        ? [l, a, b]
        : [l, a * Math.cos((third * Math.PI) / 180), a * Math.sin((third * Math.PI) / 180)],
    );
  }
  return {
    rgb: rgb.map(clamp) as RGB,
    clipped: rgb.some((value) => value < -0.00001 || value > 1.00001),
  };
}
export function formats(rgb: RGB) {
  const [r, g, b] = rgb;
  const max = Math.max(...rgb),
    min = Math.min(...rgb),
    delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    delta === 0
      ? 0
      : ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) *
          60 +
          360) %
        360;
  const [l, a, labB] = toOklab(rgb);
  const chroma = Math.hypot(a, labB);
  const labHue = chroma < 0.000001 ? 0 : ((Math.atan2(labB, a) * 180) / Math.PI + 360) % 360;
  return {
    Hex: hex(rgb),
    RGB: `rgb(${rgb.map((value) => round(value * 255)).join(" ")})`,
    HSL: `hsl(${round(hue)} ${round(saturation * 100)}% ${round(lightness * 100)}%)`,
    OKLCH: `oklch(${round(l, 5)} ${round(chroma, 5)} ${round(labHue)})`,
    OKLAB: `oklab(${round(l, 5)} ${round(a, 5)} ${round(labB, 5)})`,
  };
}
export function wcag(text: RGB, background: RGB) {
  const luminance = (rgb: RGB) => {
    const [r, g, b] = rgb.map(linear);
    return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
  };
  const a = luminance(text),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
// APCA 0.0.98G equations and constants, for web content contrast only.
// Reference: https://github.com/Myndex/apca-w3 (Andrew Somers, W3 license).
export function apca(text: RGB, background: RGB) {
  const luminance = (rgb: RGB) => {
    const y = rgb[0] ** 2.4 * 0.2126729 + rgb[1] ** 2.4 * 0.7151522 + rgb[2] ** 2.4 * 0.072175;
    return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;
  };
  const t = luminance(text),
    b = luminance(background);
  if (Math.abs(t - b) < 0.0005) return 0;
  if (b > t) {
    const contrast = (b ** 0.56 - t ** 0.57) * 1.14;
    return contrast < 0.1 ? 0 : (contrast - 0.027) * 100;
  }
  const contrast = (b ** 0.65 - t ** 0.62) * 1.14;
  return contrast > -0.1 ? 0 : (contrast + 0.027) * 100;
}
