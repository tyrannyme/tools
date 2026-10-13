export async function decodeImage(blob: Blob) {
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new Error("This image could not be opened. Choose a PNG, JPEG, or WebP image.");
  }
}
export function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable. Try another browser.");
  return { canvas, context };
}
export function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNG export failed. Try a smaller image.")),
      "image/png",
    ),
  );
}
export async function composite(
  image: Blob,
  mask: Blob,
  background = "transparent",
  color = "#ffffff",
  softness = 0,
) {
  const [original, matte] = await Promise.all([decodeImage(image), decodeImage(mask)]);
  try {
    const { width, height } = original;
    const { canvas, context } = canvas2d(width, height);
    context.drawImage(matte, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i + 3] = pixels.data[i];
    context.putImageData(pixels, 0, 0);
    const cut = canvas2d(width, height);
    cut.context.filter = `blur(${softness}px)`;
    cut.context.drawImage(canvas, 0, 0);
    cut.context.filter = "none";
    cut.context.globalCompositeOperation = "source-in";
    cut.context.drawImage(original, 0, 0);
    context.clearRect(0, 0, width, height);
    if (background === "blur") {
      context.filter = "blur(16px)";
      context.drawImage(original, -32, -32, width + 64, height + 64);
      context.filter = "none";
    } else if (background !== "transparent") {
      context.fillStyle = background === "custom" ? color : background;
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(cut.canvas, 0, 0);
    return await toBlob(canvas);
  } finally {
    original.close();
    matte.close();
  }
}
/** Dims everything outside a mask, to show a selection on top of the original. */
export async function dimOutside(mask: Blob) {
  const matte = await decodeImage(mask);
  try {
    const { canvas, context } = canvas2d(matte.width, matte.height);
    context.drawImage(matte, 0, 0);
    const pixels = context.getImageData(0, 0, matte.width, matte.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i + 3] = (255 - pixels.data[i]) * 0.6;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 0;
    }
    context.putImageData(pixels, 0, 0);
    return await toBlob(canvas);
  } finally {
    matte.close();
  }
}
/** Crops away fully transparent borders, so a cut-out object fills its PNG. */
export async function trim(blob: Blob) {
  const image = await decodeImage(blob);
  try {
    const { width, height } = image;
    const { canvas, context } = canvas2d(width, height);
    context.drawImage(image, 0, 0);
    const alpha = context.getImageData(0, 0, width, height).data;
    let left = width,
      top = height,
      right = -1,
      bottom = -1;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (alpha[(y * width + x) * 4 + 3] > 8) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
    if (right < 0) return blob;
    const cropped = canvas2d(right - left + 1, bottom - top + 1);
    cropped.context.drawImage(canvas, -left, -top);
    return await toBlob(cropped.canvas);
  } finally {
    image.close();
  }
}
