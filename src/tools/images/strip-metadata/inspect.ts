import { parse } from "exifr";

/** exifr supports TIFF buffers but not the WebP container. */
export async function inspectMetadata(
  file: File,
  bytes: Uint8Array,
): Promise<Record<string, unknown>> {
  const text = (start: number, length: number) =>
    new TextDecoder().decode(bytes.subarray(start, start + length));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    const fields: Record<string, unknown> = {};
    const end = view.getUint32(4, true) + 8;
    for (let offset = 12; offset + 8 <= end;) {
      const size = view.getUint32(offset + 4, true);
      const type = text(offset, 4);
      if (type === "EXIF") {
        const start = offset + 8 + (text(offset + 8, 6) === "Exif\0\0" ? 6 : 0);
        Object.assign(fields, (await parse(bytes.subarray(start, offset + 8 + size))) ?? {});
      } else if (type === "XMP ") fields.XMP = text(offset + 8, Math.min(size, 16384));
      else if (type === "ICCP") fields.ColorProfile = `${size} bytes`;
      offset += 8 + size + (size % 2);
    }
    return fields;
  }
  const fields: Record<string, unknown> =
    (await parse(file, {
      tiff: true,
      xmp: true,
      iptc: true,
      icc: true,
      jfif: false,
      ihdr: false,
    })) ?? {};
  if (bytes[0] === 137 && text(1, 3) === "PNG") {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = view.getUint32(offset);
      const type = text(offset + 4, 4);
      if (type === "tEXt") {
        const data = bytes.subarray(offset + 8, offset + 8 + size);
        const separator = data.indexOf(0);
        if (separator > 0)
          fields[new TextDecoder("latin1").decode(data.subarray(0, separator))] = new TextDecoder(
            "latin1",
          ).decode(data.subarray(separator + 1, separator + 16385));
      }
      offset += size + 12;
    }
  }
  return fields;
}
