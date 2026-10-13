// Renders the tool card artwork into public/thumbs/<category>/<slug>.webp with Automedia
// (https://automedia.tyranny.me). Needs Automedia running, a GPU, and ffmpeg.
// Run `pnpm thumbs`, or `pnpm thumbs ai/ocr games/dice` for some tools.
//
// Each tool's artwork is src/tools/<category>/<slug>/art.html: markup and a <style>, laid out at
// 1280x800 over its own dusk sky, with scripts/art/shared.css. `asset:samples/<file>` points at
// public/samples/ and `asset:art/<file>` at scripts/art/assets/. `data-glow="x y"` on the first
// element moves the sky's warm light (0 to 1, default "0.5 0.5"). Each category is one Automedia
// composition with one artwork per second, so the studio can scrub through them.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "vgpu/node";
import { createDusk } from "./dusk.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const engine = process.env.AUTOMEDIA_URL ?? "http://127.0.0.1:47821";
const holder = `tyranny-tools thumbs ${process.pid}`;
const width = 1280;
const height = 800;

let rpcId = 0;
async function call(name, args) {
  const response = await fetch(`${engine}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    signal: AbortSignal.timeout(180_000),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcId,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  }).catch(() => {
    throw new Error(`Automedia is not running at ${engine}. Start it, then try again.`);
  });
  const body = await response.text();
  const data = body.split("\n").findLast((line) => line.startsWith("data: "));
  const message = JSON.parse(data ? data.slice(6) : body);
  const text = message.result?.content?.map((part) => part.text).join("\n");
  if (message.error || message.result?.isError) {
    throw new Error(`${name}: ${message.error?.message ?? text}`);
  }
  return JSON.parse(text);
}

async function put(compositionId, path, content) {
  const existing = await call("read_file", { compositionId, path }).catch(() => undefined);
  const binary = Buffer.isBuffer(content);
  await call("write_file", {
    compositionId,
    path,
    encoding: binary ? "base64" : "utf8",
    content: binary ? content.toString("base64") : content,
    expectedEtag: existing?.etag ?? "",
  });
}

const wanted = process.argv.slice(2);
const categories = readdirSync(join(root, "src/tools")).filter((name) => !name.startsWith("_"));

// Every sky renders first, so the GPU is released before the slow part.
const ids = categories.flatMap((category) =>
  readdirSync(join(root, "src/tools", category))
    .filter((slug) => !slug.startsWith("_"))
    .map((slug) => `${category}/${slug}`),
);
const skies = new Map();
{
  const gpu = await init();
  const dusk = await createDusk(gpu, [width, height]);
  for (const id of ids) {
    const file = join(root, "src/tools", id, "art.html");
    if ((wanted.length && !wanted.includes(id)) || !existsSync(file)) continue;
    const art = readFileSync(file, "utf8");
    // The sky: a different moment for every tool, with the warm light where the art asks.
    const glow = art.match(/data-glow="([\d.]+)\s+([\d.]+)"/);
    let seed = 0;
    for (const char of id) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
    const pixels = await dusk.render({
      time: 20 + (seed % 400),
      pointer: glow ? [Number(glow[1]), Number(glow[2])] : [0.5, 0.5],
      glow: 0.9,
    });
    const raw = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
    const args = `-loglevel error -f rawvideo -pix_fmt rgba -s ${width}x${height} -i - -f image2pipe -c:v png -`;
    skies.set(id, execFileSync("ffmpeg", args.split(" "), { input: raw, maxBuffer: 1 << 26 }));
  }
  gpu.dispose();
}
const compositions = await call("list_compositions", {});
const missing = [];
let claimed;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (claimed)
      await call("release_composition", { compositionId: claimed, holder }).catch(() => {});
    process.exit(1);
  });
}

for (const category of categories) {
  const slugs = readdirSync(join(root, "src/tools", category))
    .filter((slug) => !slug.startsWith("_"))
    .sort();
  const chosen = slugs.filter((slug) => !wanted.length || wanted.includes(`${category}/${slug}`));
  if (!chosen.length) continue;

  const name = `Tool art · ${category}`;
  const composition =
    compositions.find((item) => item.name === name) ?? (await call("create_composition", { name }));
  const compositionId = composition.id;
  claimed = compositionId;
  // Another run may be rendering the same category; wait for it.
  for (let tries = 0; ; tries++) {
    try {
      await call("claim_composition", { compositionId, holder, ttlSeconds: 120 });
      break;
    } catch (error) {
      if (tries > 300) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  try {
    await call("update_settings", { compositionId, width, height, fps: 1, background: "#17132a" });
    await put(
      compositionId,
      "assets/shared.css",
      readFileSync(join(root, "scripts/art/shared.css"), "utf8"),
    );
    for (const font of ["cormorant-garamond-600.ttf", "noto-sans-400.ttf", "noto-sans-600.ttf"]) {
      await put(
        compositionId,
        `assets/fonts/${font}`,
        readFileSync(join(root, "scripts/og-fonts", font)),
      );
    }

    for (const slug of chosen) {
      // Short claims, renewed per tool, so a run that dies does not block the category for long.
      await call("claim_composition", { compositionId, holder, ttlSeconds: 120 });
      const id = `${category}/${slug}`;
      const file = join(root, "src/tools", id, "art.html");
      if (!existsSync(file)) {
        missing.push(id);
        continue;
      }
      let art = readFileSync(file, "utf8");
      for (const [, asset] of new Set(art.matchAll(/asset:((samples|art)\/[\w.-]+)/g))) {
        const [folder, base] = asset.split("/");
        const source =
          folder === "samples"
            ? join(root, "public/samples", base)
            : join(root, "scripts/art/assets", base);
        await put(compositionId, `assets/${asset}`, readFileSync(source));
      }
      art = art.replaceAll("asset:", "../../assets/");

      const sky = skies.get(id);
      await put(compositionId, `assets/dusk/${slug}.png`, sky);
      await put(
        compositionId,
        `blocks/${slug}/index.html`,
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${id}</title>
    <link rel="stylesheet" href="../../assets/shared.css" />
    <style>body { background-image: url("../../assets/dusk/${slug}.png"); }</style>
  </head>
  <body>
${art}
  </body>
</html>
`,
      );
      const index = slugs.indexOf(slug);
      await call("put_track", {
        compositionId,
        track: {
          id: slug,
          kind: "block",
          asset: slug,
          name: slug,
          start: index,
          duration: 1,
          trimStart: 0,
          rate: 1,
          volume: 1,
          mute: true,
          lane: 0,
        },
      });

      const validation = await call("validate", { compositionId });
      if (!validation.ok) throw new Error(`${id}: ${JSON.stringify(validation.issues)}`);
      let job = await call("start_export", {
        compositionId,
        format: "png",
        timeSeconds: index + 0.5,
      });
      const deadline = Date.now() + 120_000;
      while (!["completed", "failed", "canceled"].includes(job.phase)) {
        if (Date.now() > deadline) {
          await call("cancel_export", { jobId: job.id }).catch(() => {});
          throw new Error(`${id}: the export took over two minutes and was canceled`);
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        job = await call("get_export", { jobId: job.id });
      }
      if (job.phase !== "completed")
        throw new Error(`${id}: export ${job.phase} ${job.error ?? ""}`);
      const png = Buffer.from(await (await fetch(job.contentUrl)).arrayBuffer());
      const out = join(root, "public/thumbs", `${id}.webp`);
      mkdirSync(dirname(out), { recursive: true });
      execFileSync(
        "ffmpeg",
        [
          ...["-loglevel", "error", "-y", "-f", "png_pipe", "-i", "-"],
          ...["-vf", "scale=640:400:flags=lanczos", "-c:v", "libwebp", "-quality", "82", out],
        ],
        { input: png, maxBuffer: 1 << 26 },
      );
      console.log(`public/thumbs/${id}.webp  (full size: ${job.outputPath})`);
    }
  } finally {
    await call("release_composition", { compositionId, holder });
    claimed = undefined;
  }
}

if (missing.length) {
  console.error(`No art.html for: ${missing.join(", ")}`);
  process.exitCode = 1;
}
