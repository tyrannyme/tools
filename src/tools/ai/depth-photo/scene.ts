import { canvas2d, decodeImage } from "../_vision/image";

/** One loop of the camera path, shared by the preview and the export so they match. */
export const loopSeconds = 6;
export function orbit(time: number) {
  const phase = (time / loopSeconds) * Math.PI * 2;
  return { x: Math.sin(phase), y: Math.cos(phase) * 0.5 };
}
/** Fixed backdrop behind transparent images, in the preview and the video alike. */
export const backdrop = [0.04, 0.04, 0.04] as const;

const vertex = `#version 300 es
out vec2 uv;
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  uv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

/*
 * Parallax occlusion: for each pixel, march from the nearest depth to the farthest and take
 * the first surface the view ray reaches. Near objects cover far ones instead of stretching
 * over them, and uncovered areas repeat the background behind the edge.
 */
const fragment = `#version 300 es
precision highp float;
uniform sampler2D photo;
uniform sampler2D depth;
uniform vec2 offset;
uniform float focus;
uniform float zoom;
uniform vec3 backdrop;
in vec2 uv;
out vec4 color;
const int STEPS = 48;
void main() {
  vec2 p = 0.5 + (vec2(uv.x, 1.0 - uv.y) - 0.5) * zoom;
  vec2 previous = p - offset * (1.0 - focus);
  float previousGap = textureLod(depth, previous, 0.0).r - 1.0;
  vec2 hit = previous;
  if (previousGap < 0.0) {
    for (int i = 1; i <= STEPS; i++) {
      float layer = 1.0 - float(i) / float(STEPS);
      vec2 q = p - offset * (layer - focus);
      float gap = textureLod(depth, q, 0.0).r - layer;
      hit = q;
      if (gap >= 0.0) {
        hit = mix(previous, q, previousGap / (previousGap - gap));
        break;
      }
      previous = q;
      previousGap = gap;
    }
  }
  vec4 c = textureLod(photo, hit, 0.0);
  color = vec4(mix(backdrop, c.rgb, c.a), 1.0);
}`;

/**
 * Depth models blur object edges, so a foreground edge pixel often carries background depth
 * and smears when the camera moves. Growing near areas by a few pixels keeps edges attached
 * to their object, and a light blur keeps the surface smooth.
 */
function edgeAwareDepth(map: ImageBitmap) {
  const long = 512;
  const scale = Math.min(1, long / Math.max(map.width, map.height));
  const width = Math.max(1, Math.round(map.width * scale)),
    height = Math.max(1, Math.round(map.height * scale));
  const { context } = canvas2d(width, height);
  context.drawImage(map, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  let values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = rgba[i * 4];
  const pass = (source: Float32Array, radius: number, horizontal: boolean, max: boolean) => {
    const out = new Float32Array(source.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let acc = 0,
          count = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = horizontal ? Math.min(width - 1, Math.max(0, x + k)) : x;
          const sy = horizontal ? y : Math.min(height - 1, Math.max(0, y + k));
          const v = source[sy * width + sx];
          if (max) acc = Math.max(acc, v);
          else acc += v;
          count++;
        }
        out[y * width + x] = max ? acc : acc / count;
      }
    return out;
  };
  const grow = Math.max(2, Math.round(Math.max(width, height) / 160));
  values = pass(pass(values, grow, true, true), grow, false, true);
  values = pass(pass(values, 2, true, false), 2, false, false);
  const bytes = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) bytes[i] = values[i];
  return { bytes, width, height };
}

export async function createDepthScene(canvas: HTMLCanvasElement, image: Blob, depth: Blob) {
  const source = await decodeImage(image);
  const long = Math.min(1080, Math.max(source.width, source.height));
  const ratio = long / Math.max(source.width, source.height);
  const width = Math.max(2, Math.round((source.width * ratio) / 2) * 2),
    height = Math.max(2, Math.round((source.height * ratio) / 2) * 2);
  source.close();
  const [photo, map] = await Promise.all([
    createImageBitmap(image, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
      premultiplyAlpha: "none",
    }),
    decodeImage(depth),
  ]);
  const prepared = edgeAwareDepth(map);
  map.close();
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
  if (!gl) {
    photo.close();
    throw new Error(
      "3D preview needs WebGL 2. Turn on hardware acceleration or try another browser. The depth map is still available to download.",
    );
  }
  const compile = (type: number, code: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(`3D preview could not start: ${gl.getShaderInfoLog(shader)}`);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(`3D preview could not start: ${gl.getProgramInfoLog(program)}`);
  gl.useProgram(program);

  const texture = (unit: number, upload: () => void) => {
    const handle = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    upload();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return handle;
  };
  const textures = [
    texture(0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo)),
    texture(1, () =>
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        prepared.width,
        prepared.height,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        prepared.bytes,
      ),
    ),
  ];
  photo.close();
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  gl.uniform1i(uniform("photo"), 0);
  gl.uniform1i(uniform("depth"), 1);
  gl.uniform3f(uniform("backdrop"), ...backdrop);
  const focus = 0.5;
  gl.uniform1f(uniform("focus"), focus);
  const offset = uniform("offset"),
    zoom = uniform("zoom");
  gl.viewport(0, 0, width, height);
  // Camera travel as a share of the shorter side, at full strength.
  const travel = 0.03 * Math.min(width, height);

  let disposed = false;
  function render(x: number, y: number, strength: number) {
    if (disposed || gl!.isContextLost()) return;
    const ox = (x * strength * travel) / width,
      oy = (-y * strength * travel) / height;
    // Zoom in just enough that the edges never come into view at the widest camera swing.
    // The zoom depends only on strength, so it never pulses while the camera moves.
    const reach = (strength * travel) / Math.min(width, height);
    gl!.uniform2f(offset, ox, oy);
    gl!.uniform1f(zoom, 1 - 2 * Math.min(0.2, reach * Math.max(focus, 1 - focus) * 1.1));
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }
  render(0, 0, 1);
  return {
    canvas,
    width,
    height,
    render,
    dispose() {
      disposed = true;
      for (const handle of textures) gl.deleteTexture(handle);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
export type DepthScene = Awaited<ReturnType<typeof createDepthScene>>;

/** Renders one seamless loop of the camera path into an MP4. */
export async function exportLoop(
  scene: DepthScene,
  strength: number,
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void,
) {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, canEncodeVideo } =
    await import("mediabunny");
  if (!(await canEncodeVideo("avc", { width: scene.width, height: scene.height })))
    throw new Error(
      "This browser cannot encode MP4 video. Try Chrome, Edge, or Safari with hardware acceleration on.",
    );
  const fps = 30,
    total = loopSeconds * fps;
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  // Each frame is copied to a 2D canvas, so the encoder always reads a finished frame.
  // A generous bitrate keeps key frames from popping where the loop restarts.
  const frame2d = document.createElement("canvas");
  frame2d.width = scene.width;
  frame2d.height = scene.height;
  const copy = frame2d.getContext("2d", { willReadFrequently: true })!;
  const source = new CanvasSource(frame2d, { codec: "avc", bitrate: 10_000_000 });
  output.addVideoTrack(source, { frameRate: fps });
  try {
    await output.start();
    // The last frame stops one step short of the first, so the video loops without a stutter.
    for (let frame = 0; frame < total; frame++) {
      signal.throwIfAborted();
      const { x, y } = orbit(frame / fps);
      scene.render(x, y, strength);
      copy.drawImage(scene.canvas, 0, 0);
      await source.add(frame / fps, 1 / fps);
      onProgress(frame + 1, total);
      if (frame % 6 === 0) await new Promise<void>((resolve) => setTimeout(resolve));
    }
    source.close();
    await output.finalize();
    if (!target.buffer) throw new Error("The video came out empty. Try again.");
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (error) {
    await output.cancel();
    throw error;
  }
}
