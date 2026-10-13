// The site's dusk shader for Node scripts, rendered in the same two passes as
// src/components/gilded-dusk.ts: the sky and fog, then the gold motes on top.
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareShader } from "@vgpu/wgsl/prepare";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { effect, frame, sampler, target } from "vgpu/node";

const components = fileURLToPath(new URL("../src/components", import.meta.url));
const load = async (file) =>
  prepareShader((await resolveShader({ entry: join(components, file) })).wgsl);

/** Returns `render(params)`, which draws one frame and resolves to its RGBA pixels. */
export async function createDusk(gpu, [width, height], { skyScale = 1 } = {}) {
  const params = { time: 0, aspect: width / height, pointer: [0.5, 0.5], glow: 0 };
  const skySize = [Math.ceil(width * skyScale), Math.ceil(height * skyScale)];
  const sky = target(gpu, { size: skySize, format: "rgba8unorm" });
  const output = target(gpu, { size: [width, height], format: "rgba8unorm" });
  const skyPass = effect(gpu, await load("gilded-dusk-sky.wgsl"), { set: { params } });
  const dusk = effect(gpu, await load("gilded-dusk.wgsl"), {
    set: { params, sky, skySampler: sampler(gpu, { minFilter: "linear", magFilter: "linear" }) },
  });
  return {
    output,
    draw(values) {
      Object.assign(params, values);
      skyPass.set({ params });
      dusk.set({ params });
      frame(gpu, (f) => {
        f.pass(sky, skyPass);
        f.pass(output, dusk);
      });
    },
    async render(values) {
      this.draw(values);
      return output.color.read({ mipLevel: 0, region: "all" });
    },
  };
}
