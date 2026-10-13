export function encodeBase64(bytes: Uint8Array, urlSafe = false) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  const encoded = btoa(binary);
  return urlSafe ? encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : encoded;
}

export function decodeBase64(input: string, urlSafe = false) {
  const source = input.replace(/\s/g, "");
  const pattern = urlSafe ? /^[A-Za-z0-9_-]*={0,2}$/ : /^[A-Za-z0-9+/]*={0,2}$/;
  if (!pattern.test(source))
    throw new Error(
      `Use the ${urlSafe ? "URL-safe" : "standard"} Base64 alphabet with padding only at the end.`,
    );
  const bare = source.replace(/=+$/, "");
  if (bare.length % 4 === 1 || (source.includes("=") && source.length % 4 !== 0))
    throw new Error("Invalid Base64 length or padding.");
  const normalized = bare.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
  if (encodeBase64(bytes, urlSafe).replace(/=+$/, "") !== bare)
    throw new Error("Invalid Base64 padding bits.");
  return bytes;
}

export function imageType(bytes: Uint8Array) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return "image/png";
  if (starts(255, 216, 255)) return "image/jpeg";
  if (starts(71, 73, 70, 56)) return "image/gif";
  if (starts(82, 73, 70, 70) && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP")
    return "image/webp";
  if (
    String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp" &&
    /avif|avis/.test(String.fromCharCode(...bytes.subarray(8, 32)))
  )
    return "image/avif";
  const prefix = new TextDecoder().decode(bytes.subarray(0, 4096));
  if (/^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(prefix))
    return "image/svg+xml";
  if (starts(66, 77)) return "image/bmp";
  if (starts(0, 0, 1, 0)) return "image/x-icon";
  return null;
}
