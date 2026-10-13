export interface PdfImage {
  id: string;
  name: string;
  size: number;
  width: number;
  height: number;
  /** A data URL. JPEG sources stay JPEG so photos do not balloon into lossless PNGs. */
  data: string;
  format: "jpg" | "png";
}

export async function readImage(file: File): Promise<PdfImage> {
  if (
    !/\.(png|jpe?g|webp)$/i.test(file.name) &&
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error(`${file.name}: choose a PNG, JPEG, or WebP image.`);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40_000_000)
      throw new Error("size");
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.drawImage(image, 0, 0);
    // Redrawing applies EXIF rotation, which a PDF viewer would otherwise ignore. Photos
    // (JPEG, and WebP without transparency) stay lossy; PNG stays lossless for sharp text.
    const jpeg =
      file.type === "image/jpeg" ||
      /\.jpe?g$/i.test(file.name) ||
      ((file.type === "image/webp" || /\.webp$/i.test(file.name)) && opaque(context, canvas));
    return {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      width: canvas.width,
      height: canvas.height,
      data: canvas.toDataURL(jpeg ? "image/jpeg" : "image/png", 0.92),
      format: jpeg ? "jpg" : "png",
    };
  } catch {
    throw new Error(
      `${file.name}: this image could not be opened. Use a valid PNG, JPEG, or WebP under 40 megapixels.`,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function pageLayout(
  image: Pick<PdfImage, "width" | "height">,
  size: string,
  orientation: string,
  marginMm: number,
) {
  const margin = (marginMm * 72) / 25.4;
  let width = size === "letter" ? 612 : 595.28;
  let height = size === "letter" ? 792 : 841.89;
  if (size === "fit") {
    width = image.width * 0.75 + margin * 2;
    height = image.height * 0.75 + margin * 2;
  } else if (orientation === "landscape" || (orientation === "auto" && image.width > image.height))
    [width, height] = [height, width];
  const scale = Math.min((width - margin * 2) / image.width, (height - margin * 2) / image.height);
  const imageWidth = image.width * scale,
    imageHeight = image.height * scale;
  return {
    width,
    height,
    imageWidth,
    imageHeight,
    x: (width - imageWidth) / 2,
    y: (height - imageHeight) / 2,
  };
}

function opaque(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.length; index += 4) if (data[index]! < 255) return false;
  return true;
}
