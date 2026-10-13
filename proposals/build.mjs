import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const directory = fileURLToPath(new URL(".", import.meta.url));
const sampleImage = fileURLToPath(new URL("./assets/door.webp", import.meta.url));
const result = await build({
  configFile: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [tailwindcss(), react()],
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  build: {
    write: false,
    cssCodeSplit: false,
    lib: { entry: directory + "image-resize.tsx", name: "ToolsProposal", formats: ["iife"] },
  },
});
const outputs = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
const javascript = outputs
  .filter((item) => item.type === "chunk")
  .map((item) => item.code)
  .join("\n");
const css = outputs
  .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
  .map((item) => item.source)
  .join("\n");
const document = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tools | focused layout</title>
<style>${css}
html, body { background: transparent; }
html { font-size: 16px; }
body { margin: 0; }
</style>
</head>
<body>
<img id="sample-source" src="${sampleImage}" alt="" hidden>
<div id="tools-proposal"></div>
<script>${javascript.replaceAll("</script", "<\\/script")}</script>
</body>
</html>
`;
await writeFile(directory + "image-resize.html", document);
console.log("Built proposal from shadcn Base UI components.");
