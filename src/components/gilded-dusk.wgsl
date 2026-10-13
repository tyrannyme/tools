import { hash2 } from "@vgpu/wgsl-std/hash";

struct Params {
  time: f32,
  aspect: f32,
  pointer: vec2f,
  glow: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
// The low-resolution sky from `gilded-dusk-sky.wgsl`.
@group(0) @binding(1) var sky: texture_2d<f32>;
@group(0) @binding(2) var skySampler: sampler;

const GOLD = vec3f(1.0, 0.8, 0.44);

// One layer of gold motes drifting upward. `p` is aspect-corrected with y down.
fn motes(p: vec2f, scale: f32, speed: f32, seed: f32) -> f32 {
  let t = params.time;
  let q = p * scale + vec2f(seed * 17.0, t * speed * scale);
  let cell = floor(q);
  let h = hash2(cell + vec2f(seed * 31.0, seed * 7.0));
  let sway = vec2f(sin(t * 0.6 + h.y * 6.283) * 0.08, 0.0);
  let d = length(fract(q) - (0.25 + 0.5 * h) - sway);
  let size = 0.035 + 0.05 * h.x;
  let present = step(0.6, fract(h.x * 7.13 + h.y * 3.71));
  let twinkle = 0.55 + 0.45 * sin(t * (1.2 + 2.0 * h.y) + h.x * 40.0);
  let core = 1.0 - smoothstep(0.0, size, d);
  let fade = 1.0 - smoothstep(0.0, 0.16, d);
  let halo = fade * fade * 0.35;
  return present * twinkle * (core + halo);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = vec2f(uv.x * params.aspect, uv.y);
  var color = textureSampleLevel(sky, skySampler, uv, 0.0).rgb;

  // Warm light that follows the pointer.
  let pointer = vec2f(params.pointer.x * params.aspect, params.pointer.y);
  let pointerDistance = length(p - pointer);
  let warmth = exp(-pointerDistance * pointerDistance * 14.0) * params.glow;
  color += GOLD * warmth * 0.3;

  // Gold motes in three depths, brighter near the pointer.
  var light = motes(p, 7.0, 0.06, 1.0);
  light += motes(p, 13.0, 0.04, 2.0) * 0.7;
  light += motes(p, 22.0, 0.025, 3.0) * 0.45;
  color += GOLD * light * (1.0 + warmth * 3.0);

  // Keep the left side calm so the heading stays legible.
  color *= mix(0.7, 1.0, smoothstep(0.0, 0.6, uv.x));
  return vec4f(color, 1.0);
}
