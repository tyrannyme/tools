import { encode } from "uqr";
import type { QrCodeGenerateOptions } from "uqr";

export function wifiPayload(ssid: string, password: string, security: string, hidden: boolean) {
  const escape = (value: string) => value.replace(/([\\;,:"])/g, "\\$1");
  return `WIFI:T:${security};S:${escape(ssid)};${security === "nopass" ? "" : `P:${escape(password)};`}H:${hidden};;`;
}

export function contactPayload(name: string, phone: string, email: string, organization: string) {
  const escape = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/[,;]/g, "\\$&");
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escape(name)}`,
    `N:;${escape(name)};;;`,
    organization && `ORG:${escape(organization)}`,
    phone && `TEL:${escape(phone)}`,
    email && `EMAIL:${escape(email)}`,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function generateQr(
  payload: string,
  ecc: QrCodeGenerateOptions["ecc"],
  quiet: number,
  size: number,
  foreground: string,
  background: string,
) {
  const qr = encode(payload, { ecc, border: quiet, boostEcc: false });
  const path = qr.data
    .flatMap((row, y) => row.flatMap((filled, x) => (filled ? [`M${x},${y}h1v1h-1z`] : [])))
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${background}"/><path d="${path}" fill="${foreground}"/></svg>`;
  return { svg, matrix: qr.data, modules: qr.size };
}

export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map((index) => {
      const v = parseInt(hex.slice(index, index + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  };
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
