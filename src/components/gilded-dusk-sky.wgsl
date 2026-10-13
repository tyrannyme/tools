import { remap, saturate } from "@vgpu/wgsl-std/math";
import { fbmSimplex3d } from "@vgpu/wgsl-std/noise/simplex";

// The sky and fog have no fine detail, so this pass renders at a fraction of the canvas size
// and `gilded-dusk.wgsl` scales it up.

struct Params {
  time: f32,
  aspect: f32,
  pointer: vec2f,
  glow: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

const INK = vec3f(0.11, 0.1, 0.2);
const DUSK = vec3f(0.34, 0.3, 0.52);
const ROSE = vec3f(0.78, 0.55, 0.63);
const APRICOT = vec3f(0.98, 0.64, 0.4);
const FOG = vec3f(0.72, 0.65, 0.84);

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let t = params.time;
  let p = vec2f(uv.x * params.aspect, uv.y);

  // Dusk sky with a low sun on the right.
  var color = mix(INK, DUSK, smoothstep(0.0, 0.8, uv.y));
  color = mix(color, ROSE, smoothstep(0.55, 1.0, uv.y) * 0.55);
  let sun = vec2f(0.8 * params.aspect, 1.05);
  let sunDistance = length((p - sun) * vec2f(1.0, 1.7));
  color += APRICOT * exp(-sunDistance * 2.4) * 0.8;

  // Two layers of drifting fog, denser toward the horizon.
  let wide = fbmSimplex3d(vec3f(p * vec2f(1.4, 3.0) + vec2f(t * 0.03, 0.0), t * 0.04), 5, 2.03, 0.5);
  let fine = fbmSimplex3d(vec3f(p * vec2f(3.0, 5.5) - vec2f(t * 0.05, 0.0), t * 0.06 + 7.0), 4, 2.11, 0.5);
  let fog = saturate(remap(-0.5, 0.6, 0.0, 1.0, wide * 0.65 + fine * 0.35));
  let fogTint = mix(FOG, vec3f(1.0, 0.8, 0.66), exp(-sunDistance * 1.6));
  color = mix(color, fogTint, fog * smoothstep(0.05, 0.9, uv.y) * 0.75);
  return vec4f(color, 1.0);
}
