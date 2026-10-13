export async function readTexture(file: File) {
  if (!/\.(png|jpe?g|webp|avif|bmp)$/i.test(file.name))
    throw new Error("Choose a PNG, JPEG, WebP, AVIF, or BMP image.");
  if (file.size > 40 * 1024 * 1024) throw new Error("Choose an image smaller than 40 MB.");
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      data: ctx.getImageData(0, 0, canvas.width, canvas.height),
      resized: scale < 1,
      name: file.name,
    };
  } finally {
    image.close();
  }
}
export function normalMap(
  source: ImageData,
  strength: number,
  blur: number,
  invert: boolean,
  directX: boolean,
) {
  const { width: w, height: h, data } = source;
  let heights = new Float32Array(w * h);
  for (let i = 0; i < heights.length; i++)
    heights[i] =
      (data[i * 4]! * 0.2126 + data[i * 4 + 1]! * 0.7152 + data[i * 4 + 2]! * 0.0722) / 255;
  if (blur > 0) {
    const horizontal = new Float32Array(w * h),
      result = new Float32Array(w * h),
      radius = Math.round(blur),
      count = radius * 2 + 1;
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let dx = -radius; dx <= radius; dx++) sum += heights[y * w + (((dx % w) + w) % w)]!;
      for (let x = 0; x < w; x++) {
        horizontal[y * w + x] = sum / count;
        sum +=
          heights[y * w + ((x + radius + 1) % w)]! -
          heights[y * w + ((((x - radius) % w) + w) % w)]!;
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = -radius; dy <= radius; dy++) sum += horizontal[(((dy % h) + h) % h) * w + x]!;
      for (let y = 0; y < h; y++) {
        result[y * w + x] = sum / count;
        sum +=
          horizontal[((y + radius + 1) % h) * w + x]! -
          horizontal[((((y - radius) % h) + h) % h) * w + x]!;
      }
    }
    heights = result;
  }
  const output = new ImageData(w, h),
    pixels = output.data;
  const sign = invert ? -1 : 1,
    sx = -strength * sign,
    sy = strength * sign * (directX ? -1 : 1);
  // Wrap at the edges so the normal map tiles like its source.
  const left = Int32Array.from({ length: w }, (_, x) => (x + w - 1) % w),
    right = Int32Array.from({ length: w }, (_, x) => (x + 1) % w);
  for (let y = 0; y < h; y++) {
    const up = ((y + h - 1) % h) * w,
      row = y * w,
      down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const l = left[x]!,
        r = right[x]!;
      const dx =
        heights[up + r]! +
        2 * heights[row + r]! +
        heights[down + r]! -
        heights[up + l]! -
        2 * heights[row + l]! -
        heights[down + l]!;
      const dy =
        heights[down + l]! +
        2 * heights[down + x]! +
        heights[down + r]! -
        heights[up + l]! -
        2 * heights[up + x]! -
        heights[up + r]!;
      const nx = dx * sx,
        ny = dy * sy,
        scale = 127.5 / Math.sqrt(nx * nx + ny * ny + 1),
        i = (row + x) * 4;
      pixels[i] = nx * scale + 127.5;
      pixels[i + 1] = ny * scale + 127.5;
      pixels[i + 2] = scale + 127.5;
      pixels[i + 3] = 255;
    }
  }
  return output;
}
export function seamlessTexture(source: ImageData, blend: number) {
  const { width: w, height: h, data } = source,
    output = new ImageData(w, h);
  const weight = (p: number, length: number) =>
    Math.min(1, Math.sin((Math.PI * p) / Math.max(1, length - 1)) ** 2 / Math.max(0.05, blend));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const wx = weight(x, w),
        wy = weight(y, h),
        sx = (x + Math.floor(w / 2)) % w,
        sy = (y + Math.floor(h / 2)) % h;
      for (let c = 0; c < 4; c++)
        output.data[(y * w + x) * 4 + c] =
          data[(y * w + x) * 4 + c]! * wx * wy +
          data[(y * w + sx) * 4 + c]! * (1 - wx) * wy +
          data[(sy * w + x) * 4 + c]! * wx * (1 - wy) +
          data[(sy * w + sx) * 4 + c]! * (1 - wx) * (1 - wy);
    }
  // Match the boundary pixels exactly, including odd image dimensions.
  for (let y = 0; y < h; y++)
    for (let c = 0; c < 4; c++) {
      const a = y * w * 4 + c,
        b = (y * w + w - 1) * 4 + c;
      const mean = (output.data[a]! + output.data[b]!) / 2;
      output.data[a] = mean;
      output.data[b] = mean;
    }
  for (let x = 0; x < w; x++)
    for (let c = 0; c < 4; c++) {
      const a = x * 4 + c,
        b = ((h - 1) * w + x) * 4 + c;
      const mean = (output.data[a]! + output.data[b]!) / 2;
      output.data[a] = mean;
      output.data[b] = mean;
    }
  return output;
}
export function imageCanvas(data: ImageData) {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext("2d")!.putImageData(data, 0, 0);
  return canvas;
}
export function pngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the PNG."))),
      "image/png",
    ),
  );
}

/**
 * A stone wall photographed under uneven light: rich detail for a normal map, and visible
 * seams when tiled, which "Make seamless" then removes. Generated so the sample is opaque.
 */
export function sampleTexture() {
  const size = 1024,
    rowHeight = 128,
    brickWidth = 256,
    mortar = 6;
  let seed = 7;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shades = Array.from({ length: 64 }, () => 0.5 + random() * 0.3);
  const data = new ImageData(size, size);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / rowHeight),
      inRow = y % rowHeight;
    for (let x = 0; x < size; x++) {
      const shifted = x + (row % 2 ? brickWidth / 2 : 0),
        column = Math.floor(shifted / brickWidth) % (size / brickWidth),
        inBrick = shifted % brickWidth;
      const edge = Math.min(inRow, rowHeight - 1 - inRow, inBrick, brickWidth - 1 - inBrick);
      const grain = random() * 0.16 - 0.08;
      // Bricks bevel into the mortar over a few pixels, which reads as depth.
      const bevel = Math.min(1, Math.max(0, (edge - mortar) / 5));
      const shade = (0.22 + bevel * (shades[row * 8 + column]! - 0.22) + grain) * 255;
      // Uneven light: brighter top left, darker bottom right.
      const light = 1.1 - (x + y) / size / 4;
      const i = (y * size + x) * 4;
      data.data[i] = Math.min(255, shade * light * 1.05);
      data.data[i + 1] = Math.min(255, shade * light * 0.93);
      data.data[i + 2] = Math.min(255, shade * light * 0.82);
      data.data[i + 3] = 255;
    }
  }
  return { data, resized: false, name: "stone-wall.png" };
}
