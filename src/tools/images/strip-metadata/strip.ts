/** Keep image coding data, transparency, and animation; discard metadata and trailing data. */
export function stripMetadata(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  let removed = 0;
  const text = (start: number, size: number) =>
    String.fromCharCode(...bytes.subarray(start, start + size));
  const requireBytes = (end: number) => {
    if (end > bytes.length)
      throw new Error("This image is truncated or has invalid chunk lengths.");
  };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    parts.push(bytes.subarray(0, 2));
    let offset = 2;
    while (offset < bytes.length) {
      const start = offset;
      if (bytes[offset++] !== 0xff) throw new Error("Invalid JPEG segment.");
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9) {
        parts.push(bytes.subarray(start, offset));
        return { blob: new Blob(parts as BlobPart[], { type: "image/jpeg" }), removed };
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        parts.push(bytes.subarray(start, offset));
        continue;
      }
      requireBytes(offset + 2);
      const length = view.getUint16(offset);
      if (length < 2) throw new Error("Invalid JPEG segment length.");
      requireBytes(offset + length);
      // Adobe APP14 identifies the color transform needed to decode some JPEGs.
      const adobe = marker === 0xee && length === 14 && text(offset + 2, 5) === "Adobe";
      if ((marker >= 0xe0 && marker <= 0xef && !adobe) || marker === 0xfe) removed++;
      else parts.push(bytes.subarray(start, offset + length));
      offset += length;
      if (marker === 0xda) {
        const scanStart = offset;
        while (offset < bytes.length) {
          if (bytes[offset] !== 0xff) {
            offset++;
            continue;
          }
          let next = offset + 1;
          while (bytes[next] === 0xff) next++;
          if (bytes[next] === 0 || (bytes[next] >= 0xd0 && bytes[next] <= 0xd7)) {
            offset = next + 1;
            continue;
          }
          break;
        }
        parts.push(bytes.subarray(scanStart, offset));
      }
    }
    throw new Error("JPEG is missing its end marker.");
  }
  if (text(0, 8) === "\x89PNG\r\n\x1a\n") {
    parts.push(bytes.subarray(0, 8));
    let offset = 8;
    const keep = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "acTL", "fcTL", "fdAT"]);
    while (offset < bytes.length) {
      requireBytes(offset + 12);
      const size = view.getUint32(offset);
      const type = text(offset + 4, 4);
      const end = offset + 12 + size;
      requireBytes(end);
      if (keep.has(type)) parts.push(bytes.subarray(offset, end));
      else {
        if (type.charCodeAt(0) < 97) throw new Error(`Unsupported required PNG chunk: ${type}.`);
        removed++;
      }
      offset = end;
      if (type === "IEND")
        return { blob: new Blob(parts as BlobPart[], { type: "image/png" }), removed };
    }
    throw new Error("PNG is missing its end chunk.");
  }
  if (text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    requireBytes(12);
    const end = view.getUint32(4, true) + 8;
    requireBytes(end);
    const header = bytes.slice(0, 12);
    parts.push(header);
    const keep = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF"]);
    let offset = 12;
    while (offset < end) {
      requireBytes(offset + 8);
      const type = text(offset, 4);
      const size = view.getUint32(offset + 4, true);
      const next = offset + 8 + size + (size % 2);
      if (next > end) throw new Error("Invalid WebP chunk length.");
      if (keep.has(type)) {
        const part = bytes.slice(offset, next);
        if (type === "VP8X") {
          if (size !== 10) throw new Error("Invalid WebP extended header.");
          part[8] &= ~0x2c;
        }
        parts.push(part);
      } else removed++;
      offset = next;
    }
    new DataView(header.buffer).setUint32(
      4,
      parts.reduce((sum, part) => sum + part.length, 0) - 8,
      true,
    );
    return { blob: new Blob(parts as BlobPart[], { type: "image/webp" }), removed };
  }
  throw new Error(
    "Choose a JPEG, PNG, or WebP file. Other formats cannot be stripped losslessly here.",
  );
}
