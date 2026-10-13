// Renders public/samples/dusk.mp4: eight seconds of the site's dusk shader with a soft chord,
// so the video and audio tools can be tried without your own file. Needs a GPU and ffmpeg.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "vgpu/node";
import { createDusk } from "./dusk.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const width = 1280;
const height = 720;
const fps = 30;
const seconds = 8;

const gpu = await init();
const dusk = await createDusk(gpu, [width, height]);

// A plucked A major arpeggio over a quiet pad, so the waveform has a visible rhythm.
const note =
  "220*pow(2,(4*eq(mod(floor(t*2),4),1)+7*eq(mod(floor(t*2),4),2)+12*eq(mod(floor(t*2),4),3))/12)";
const pluck = `0.22*sin(2*PI*${note}*t)*exp(-5*mod(t,0.5))`;
const pad = "0.025*(sin(2*PI*110*t)+sin(2*PI*164.81*t))";
const chord = `${pluck}+${pad}`;
const ffmpeg = spawn(
  "ffmpeg",
  [
    ...["-y", "-loglevel", "error"],
    ...[
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${width}x${height}`,
      "-r",
      `${fps}`,
      "-i",
      "-",
    ],
    ...["-f", "lavfi", "-i", `aevalsrc='${chord}':s=48000:d=${seconds}`],
    ...["-af", `afade=t=in:d=1.5,afade=t=out:st=${seconds - 1.5}:d=1.5`],
    ...["-c:v", "libopenh264", "-b:v", "2500k", "-pix_fmt", "yuv420p"],
    ...["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest"],
    join(root, "public/samples/dusk.mp4"),
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);

for (let frame = 0; frame < fps * seconds; frame++) {
  const t = frame / fps;
  // The warm light drifts across the sky.
  const pixels = await dusk.render({
    time: 30 + t,
    pointer: [0.2 + 0.6 * (t / seconds), 0.45],
    glow: 0.8,
  });
  if (!ffmpeg.stdin.write(pixels))
    await new Promise((resolve) => ffmpeg.stdin.once("drain", resolve));
}
ffmpeg.stdin.end();
await new Promise((resolve, reject) =>
  ffmpeg.on("close", (code) =>
    code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
  ),
);
gpu.dispose();
console.log("public/samples/dusk.mp4");
