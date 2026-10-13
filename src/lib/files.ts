/** Saves a blob as a file download. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 1536 -> "1.5 KB". */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** "photo.jpeg" + "webp" -> "photo.webp". */
export function renameExtension(filename: string, extension: string) {
  const base = filename.replace(/\.[^.]+$/, "");
  return `${base}.${extension}`;
}

/** Fetches a file from `public/samples/` so a tool can be tried without your own file. */
export async function loadSample(name: string, type?: string) {
  const response = await fetch(`/samples/${name}`);
  const blob = await response.blob();
  return new File([blob], name, { type: type ?? blob.type });
}
