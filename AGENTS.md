# Agent instructions

Tyranny Tools: browser utilities at tools.tyranny.me. TanStack Start (React) on Cloudflare Workers, with Vite, Tailwind CSS 4, shadcn/ui (`base-nova`, Base UI primitives), TypeScript 7, and vgpu for WebGPU. Setup and deployment details are in `README.md`.

Solve problems as simply as possible.

## Commands

- `pnpm check` runs the typecheck, oxlint, and oxfmt. Run it before handing work back. `pnpm format` fixes formatting.
- Run installed binaries with `pnpm exec`, never `npx` or `pnpm dlx`.
- Dependencies are pinned exactly. Do not bypass pnpm's release-age policy.
- `pnpm deploy` publishes to production. Only run it when asked.

## Tools

- A tool is a folder `src/tools/<category>/<slug>/` with `meta.ts` (`defineTool` from `@/lib/tools`) and `tool.tsx` (default export). The site discovers them; the URL is `/<category>/<slug>`. Categories live in `src/lib/tools.ts`. `src/tools/developer/uuid/` is a small reference.
- `meta.ts` imports only a lucide icon and `defineTool`; it is bundled into every page. The description is the card text, search text, and SEO description.
- Use the shared pieces: `FileDrop` (with `compact` once a file is loaded), `SampleButton` with files from `public/samples/`, `downloadBlob` and friends from `@/lib/files`, `useHydrated` for browser-only values, and sonner toasts for copy and download.
- Every action that takes time shows honest progress or a spinner on the button that started it, disables what it would conflict with, confirms success, and explains failures inline with what to do next.
- Everything stays on the tool's page. Heavy libraries (three, mediabunny, pdf-lib, transformers.js, kokoro-js) run only in handlers and effects, never during render or at module load. AI models download only after the user acts, with the model name, license, size, real download progress, and cache state shown.
- Every tool has card artwork in `art.html` next to `meta.ts`: one bold idea in gold over the dusk sky, no words or UI. `scripts/thumbs.mjs` explains the format; `src/tools/ai/remove-background/art.html` is the reference. `pnpm thumbs <category/slug>` renders it with Automedia, which must be running.
- After adding or renaming tools, run `pnpm thumbs` and `pnpm og` to regenerate the card artwork and social preview images.

## UI and copy

- Build from the shadcn components in `src/components/ui/` with their stock variants and patterns. Add missing ones with `pnpm exec shadcn add <name>` instead of writing look-alikes.
- Use the standard neutral theme. Gold (`text-gold`, `--gold`) is the only accent, reserved for ornaments and the motto. No other custom colors, paper effects, or textures.
- Reuse `OrnamentRule` and `OrnateFrame` from `src/components/ornament.tsx` instead of drawing new ornaments.
- Every label must tell the user something the interface does not already show. Cut redundant badges, obvious status text, and filler copy. Keep field labels, units, validation messages, and real status.
- No em dashes in code, comments, UI text, or docs.
- Design and motion skills live in `.claude/skills/` (Emil Kowalski's and Jakub Krehel's, plus Hugging Face's transformers-js). Read the relevant ones before UI or AI work. This file wins any conflict.

## Rendering

- Static routes are prerendered. Their content must be in the initial HTML, and client-side navigation must keep working.
- No loading screens or artificial delays. Show a loading indicator only for real pending work.
- The server build replaces browser-only libraries with stubs and drops Web Worker bundles (see `vite.config.ts`). Keep new browser-only libraries in that list.
- Pages are cross-origin isolated (`public/_headers`), so cross-origin resources must allow CORS or be fetched without credentials.
- WebGPU is an enhancement. Load vgpu with a dynamic import, keep a CSS fallback underneath, and only reveal the canvas after the pipeline compiles. GPU errors must fall back, not leave a blank canvas.

## Shaders

- Shaders are `.wgsl` files compiled by the `@vgpu/wgsl` Vite plugin. Keep `vgpu` and `@vgpu/wgsl` on the same version.
- Validate every shader change with `pnpm exec vgpu check <file> --require-validation`.
- The vgpu docs ship with the package: `pnpm exec vgpu docs find <topic>` and `pnpm exec vgpu docs cat <path>`.

## Verification

- Check changes in the running app. For startup changes, inspect the earliest frames, not just the settled page.
- Look for empty content, flashes of unstyled content, layout shifts, and console errors.
- For routing changes, test direct visits and client-side navigation in both `pnpm dev` and `pnpm preview`.
- Test on a phone with `pnpm dev:lan --port 5174`, which serves HTTPS on the local network (the certificate in `.dev-certs/` is self-signed).
- Headless Chrome may not get a hardware WebGPU adapter. Check GPU output in a real browser, or render frames headlessly with `vgpu/node`.
- Report only what you actually verified.
