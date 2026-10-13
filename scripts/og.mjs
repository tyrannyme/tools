// Renders the 1200x630 social preview images into public/og/ as JPEG. Needs a GPU and ffmpeg.
// The dusk background is the site's real shader, rendered on the GPU with vgpu.
// Run with `pnpm og` after adding or renaming tools, and commit the results.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import satori from "satori";
import { init } from "vgpu/node";
import { createServer } from "vite";
import { createDusk } from "./dusk.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
// pngjs comes with vgpu; resolve it from there.
const { PNG } = createRequire(createRequire(join(root, "package.json")).resolve("vgpu"))("pngjs");
const width = 1200;
const height = 630;
const gold = "#e6c072";

// Load the tool registry through Vite so `import.meta.glob` works.
const vite = await createServer({
  root,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true },
  resolve: { alias: { "@": join(root, "src") } },
});
const { categories, tools, toolsIn } = await vite.ssrLoadModule("/src/lib/tools.ts");

const font = (file) => readFileSync(join(root, "scripts/og-fonts", file));
const fonts = [
  { name: "Cormorant", data: font("cormorant-garamond-600.ttf"), weight: 600 },
  { name: "Noto Sans", data: font("noto-sans-400.ttf"), weight: 400 },
  { name: "Noto Sans", data: font("noto-sans-600.ttf"), weight: 600 },
];

const dataUrl = (type, data) => `data:${type};base64,${Buffer.from(data).toString("base64")}`;
const svgUrl = (svg) => dataUrl("image/svg+xml", svg);
const favicon = dataUrl("image/png", readFileSync(join(root, "public/apple-touch-icon.png")));

// Same shapes as src/components/ornament.tsx.
const corner = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="${gold}" stroke-linecap="round"><path d="M10 31 V14 C10 11.8 11.8 10 14 10 H31" stroke-width="1.2"/><path d="M5 26 V10 C5 7.2 7.2 5 10 5 H26" stroke-width="0.8"/><path d="M4 1 L7 4 L4 7 L1 4 Z" fill="${gold}" stroke="none"/><path d="M5 26 C5 29 7.5 30 8.5 28.5 C9.3 27.2 8 26.2 7.2 27" stroke-width="0.8"/><path d="M26 5 C29 5 30 7.5 28.5 8.5 C27.2 9.3 26.2 8 27 7.2" stroke-width="0.8"/></svg>`,
);
const scroll = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 16" fill="none" stroke="${gold}" stroke-width="1.2" stroke-linecap="round"><path d="M1 8 C7 8 11 2.5 17 2.5 C21.5 2.5 23 6.5 20.5 8 C18.5 9.2 16.5 7.6 17.5 6"/><path d="M1 8 C9 8 15 13.5 23 12.5 C30 11.6 33 8 40 8"/><path d="M27 11.2 C28.5 13.5 31.5 14 33 13 C31.5 11.5 29 11 27 11.2 Z" fill="${gold}"/></svg>`,
);

// The dusk background, a different moment of the same sky for every page.
const gpu = await init();
const dusk = await createDusk(gpu, [width, height]);

async function background(seed) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const pixels = await dusk.render({ time: 20 + (hash % 400), pointer: [0.79, 0.48], glow: 0.9 });
  const png = new PNG({ width, height });
  png.data.set(pixels);
  return dataUrl("image/png", PNG.sync.write(png));
}

function iconUrl(Icon) {
  return svgUrl(
    renderToStaticMarkup(h(Icon, { size: 200, color: gold, strokeWidth: 1.25 })).replace(
      "<svg",
      '<svg xmlns="http://www.w3.org/2000/svg"',
    ),
  );
}

function card({ label, title, description, emblem, sky }) {
  const cornerAt = (style, transform) =>
    h("img", {
      src: corner,
      width: 72,
      height: 72,
      style: { position: "absolute", ...style, ...(transform && { transform }) },
    });
  return h(
    "div",
    {
      style: {
        width,
        height,
        display: "flex",
        position: "relative",
        fontFamily: "Noto Sans",
        color: "white",
      },
    },
    h("img", { src: sky, width, height, style: { position: "absolute", inset: 0 } }),
    h("div", {
      style: {
        position: "absolute",
        inset: 0,
        backgroundImage:
          "linear-gradient(0deg, rgba(16,13,34,0.85) 0%, rgba(16,13,34,0) 40%), linear-gradient(90deg, rgba(16,13,34,0.82) 0%, rgba(16,13,34,0.45) 52%, rgba(16,13,34,0) 78%)",
      },
    }),
    cornerAt({ top: 22, left: 22 }),
    cornerAt({ top: 22, right: 22 }, "scaleX(-1)"),
    cornerAt({ bottom: 22, left: 22 }, "scaleY(-1)"),
    cornerAt({ bottom: 22, right: 22 }, "scale(-1, -1)"),
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: 70,
          left: 96,
          display: "flex",
          alignItems: "center",
          gap: 16,
        },
      },
      h("img", { src: favicon, width: 44, height: 44, style: { borderRadius: 6 } }),
      h("div", { style: { fontSize: 26, fontWeight: 600, opacity: 0.9 } }, "Tools by Tyranny"),
    ),
    h(
      "div",
      {
        style: {
          position: "absolute",
          left: 96,
          top: 170,
          width: 660,
          display: "flex",
          flexDirection: "column",
        },
      },
      h(
        "div",
        {
          style: {
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 4,
            color: gold,
            textTransform: "uppercase",
          },
        },
        label,
      ),
      h(
        "div",
        {
          style: {
            fontFamily: "Cormorant",
            fontSize: title.length > 18 ? 84 : 104,
            lineHeight: 1,
            marginTop: 18,
          },
        },
        title,
      ),
      h(
        "div",
        {
          style: { fontSize: 30, lineHeight: 1.35, marginTop: 24, color: "rgba(255,255,255,0.8)" },
        },
        description,
      ),
    ),
    h(
      "div",
      {
        style: {
          position: "absolute",
          right: 116,
          top: 165,
          width: 300,
          height: 300,
          borderRadius: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${gold}88`,
          backgroundColor: "rgba(230,192,114,0.08)",
          boxShadow: `0 0 80px ${gold}55`,
        },
      },
      emblem,
    ),
    h(
      "div",
      {
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          bottom: 62,
          display: "flex",
          alignItems: "center",
          gap: 14,
          color: gold,
        },
      },
      h("div", { style: { fontSize: 22, fontWeight: 600 } }, "tools.tyranny.me"),
      h("div", { style: { flex: 1, height: 1, backgroundColor: `${gold}66`, marginLeft: 12 } }),
      h("img", { src: scroll, width: 40, height: 16, style: { transform: "scaleX(-1)" } }),
      h(
        "div",
        {
          style: {
            fontFamily: "Cormorant",
            fontSize: 26,
            letterSpacing: 6,
            textShadow: "0 0 14px rgba(16,13,34,0.95)",
          },
        },
        "SIC SEMPER TYRANNIS",
      ),
      h("img", { src: scroll, width: 40, height: 16 }),
    ),
  );
}

async function render(file, page) {
  const svg = await satori(card({ ...page, sky: await background(file) }), {
    width,
    height,
    fonts,
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
  const path = join(root, "public/og", file);
  mkdirSync(dirname(path), { recursive: true });
  // JPEG keeps each card around 150 KB instead of 500 KB; ffmpeg does the encoding.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", "pipe:0", "-q:v", "3", path], {
    input: png,
  });
  console.log(`public/og/${file}`);
}

const iconEmblem = (Icon) => h("img", { src: iconUrl(Icon), width: 170, height: 170 });

await render("home.jpg", {
  label: "Free browser tools",
  title: "Tools",
  description: `${tools.length} tools for images, video, documents, games, and 3D. Your files never leave your device.`,
  emblem: h("img", { src: favicon, width: 150, height: 150, style: { borderRadius: 18 } }),
});
for (const category of categories) {
  const count = toolsIn(category).length;
  if (count === 0) continue;
  await render(`${category.slug}.jpg`, {
    label: `${count} tools`,
    title: category.name,
    description: category.description,
    emblem: iconEmblem(category.icon),
  });
}
for (const tool of tools) {
  await render(`${tool.id}.jpg`, {
    label: tool.category.name,
    title: tool.name,
    description: tool.description,
    emblem: iconEmblem(tool.icon),
  });
}

gpu.dispose();
await vite.close();
