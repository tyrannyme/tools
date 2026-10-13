import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { varlockCloudflareVitePlugin } from "@varlock/cloudflare-integration";
import { wgslVitePlugin } from "@vgpu/wgsl/loader-vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

// `pnpm dev:lan` serves HTTPS so phones on the network get a secure context
// (WebGPU, clipboard, and share need one). The certificate is self-signed.
const lanHttps = process.env.DEV_LAN
  ? { key: readFileSync(".dev-certs/key.pem"), cert: readFileSync(".dev-certs/cert.pem") }
  : undefined;

// transformers.js loads the ONNX runtime's WASM from jsDelivr, pinned to the installed version.
// The copies onnxruntime-web references for bundlers are never fetched, and one is larger than
// Cloudflare's 25 MiB asset limit, so they are left out of the build.
function dropOnnxWasm(): Plugin {
  return {
    name: "drop-onnx-wasm",
    generateBundle(_, bundle) {
      for (const name of Object.keys(bundle)) {
        if (/(^|\/)ort-wasm[^/]*\.wasm$/.test(name)) delete bundle[name];
      }
    },
  };
}

// Libraries that only ever run in the browser, inside event handlers and effects. Server
// rendering never calls them, so the Worker gets a stub instead of megabytes of dead code.
// Each importing file gets its own stub that exports exactly the names it imports.
const browserOnly =
  /^(three|three\/.*|mediabunny|@mediabunny\/.*|pdf-lib|@huggingface\/transformers|kokoro-js|onnxruntime-web(\/.*)?)$/;
const stubPrefix = "\0browser-only:";

function importedNames(importer: string, source: string) {
  const code = readFileSync(importer, "utf8");
  const quoted = source.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const names = new Set<string>();
  for (const match of code.matchAll(
    new RegExp(`import\\s+([^;]*?)\\s+from\\s+["']${quoted}["']`, "g"),
  )) {
    const clause = match[1]!;
    for (const named of clause.match(/\{([^}]*)\}/)?.[1]?.split(",") ?? []) {
      const name = named
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]!;
      if (name && !named.trim().startsWith("type ")) names.add(name);
    }
    const namespace = clause.match(/\*\s+as\s+(\w+)/)?.[1];
    if (namespace) {
      for (const use of code.matchAll(new RegExp(`\\b${namespace}\\.(\\w+)`, "g")))
        names.add(use[1]!);
    }
  }
  names.delete("default");
  return [...names];
}

function stubBrowserOnly(): Plugin {
  return {
    name: "stub-browser-only",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.name === "ssr",
    resolveId(source, importer) {
      if (importer && browserOnly.test(source.replace(/\?.*$/, ""))) {
        return `${stubPrefix}${source}|${importer}`;
      }
    },
    // Web Workers are only started by user actions, so the server never needs their bundles.
    transform(code, id) {
      if (!id.includes("/src/") || !code.includes("new Worker(")) return;
      return code.replace(
        /new\s+Worker\(\s*new\s+URL\([^)]*import\.meta\.url\s*\)\s*(,\s*\{[^}]*\})?\s*\)/g,
        "null",
      );
    },
    // Drop JavaScript nothing on the server can reach, such as Web Worker bundles.
    generateBundle: {
      order: "post",
      handler(_, bundle) {
        const reachable = new Set<string>();
        const visit = (name: string) => {
          const output = bundle[name];
          if (reachable.has(name) || output?.type !== "chunk") return;
          reachable.add(name);
          for (const next of [...output.imports, ...output.dynamicImports]) visit(next);
        };
        for (const [name, output] of Object.entries(bundle)) {
          if (output.type === "chunk" && output.isEntry) visit(name);
        }
        const code = [...reachable]
          .map((name) => (bundle[name] as { code: string }).code)
          .join("\n");
        for (const [name, output] of Object.entries(bundle)) {
          if (!name.endsWith(".js") || reachable.has(name)) continue;
          if (output.type === "chunk" || !code.includes(name.split("/").pop()!))
            delete bundle[name];
        }
      },
    },
    load(id) {
      if (!id.startsWith(stubPrefix)) return;
      const [source, importer] = id.slice(stubPrefix.length).split("|") as [string, string];
      const names = importedNames(importer, source);
      return [
        "const stub = new Proxy(function () {}, {",
        '  get: (_, key) => (key === "then" ? undefined : stub),',
        "  apply: () => stub,",
        "  construct: () => stub,",
        "});",
        "export default stub;",
        ...names.map((name) => `export const ${name} = stub;`),
      ].join("\n");
    },
  };
}

// The same cross-origin isolation headers as public/_headers, for the dev and preview servers.
function crossOriginIsolation(): Plugin {
  const isolate = (
    _: unknown,
    response: { setHeader(name: string, value: string): void },
    next: () => void,
  ) => {
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    next();
  };
  return {
    name: "cross-origin-isolation",
    configureServer: (server) => void server.middlewares.use(isolate),
    configurePreviewServer: (server) => void server.middlewares.use(isolate),
  };
}

export default defineConfig({
  server: { https: lanHttps },
  // Lets several dev servers share this checkout without fighting over the dependency cache.
  cacheDir: process.env.VITE_CACHE_DIR,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  worker: { format: "es", plugins: () => [dropOnnxWasm()] },
  plugins: [
    crossOriginIsolation(),
    dropOnnxWasm(),
    stubBrowserOnly(),
    wgslVitePlugin(),
    varlockCloudflareVitePlugin({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      prerender: { enabled: true, crawlLinks: true },
      pages: [{ path: "/sitemap.xml" }],
    }),
    react(),
  ],
});
