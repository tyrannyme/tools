import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { varlockCloudflareVitePlugin } from "@varlock/cloudflare-integration";
import { wgslVitePlugin } from "@vgpu/wgsl/loader-vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  // Lets several dev servers share this checkout without fighting over the dependency cache.
  cacheDir: process.env.VITE_CACHE_DIR,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    wgslVitePlugin(),
    varlockCloudflareVitePlugin({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({ prerender: { enabled: true, crawlLinks: true } }),
    react(),
  ],
});
