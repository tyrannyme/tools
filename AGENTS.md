# Agent instructions

Tyranny Tools: browser utilities at tools.tyranny.me. TanStack Start (React) on Cloudflare Workers, with Vite, Tailwind CSS 4, shadcn/ui (`base-nova`, Base UI primitives), TypeScript 7, and vgpu for WebGPU. Setup and deployment details are in `README.md`.

Solve problems as simply as possible.

## Commands

- `pnpm check` runs the typecheck, oxlint, and oxfmt. Run it before handing work back. `pnpm format` fixes formatting.
- Run installed binaries with `pnpm exec`, never `npx` or `pnpm dlx`.
- Dependencies are pinned exactly. Do not bypass pnpm's release-age policy.
- `pnpm deploy` publishes to production. Only run it when asked.

## UI and copy

- Build from the shadcn components in `src/components/ui/` with their stock variants and patterns. Add missing ones with `pnpm exec shadcn add <name>` instead of writing look-alikes.
- Use the standard neutral theme. Gold (`text-gold`, `--gold`) is the only accent, reserved for ornaments and the motto. No other custom colors, paper effects, or textures.
- Reuse `OrnamentRule` and `OrnateFrame` from `src/components/ornament.tsx` instead of drawing new ornaments.
- Every label must tell the user something the interface does not already show. Cut redundant badges, obvious status text, and filler copy. Keep field labels, units, validation messages, and real status.
- No em dashes in code, comments, UI text, or docs.

## Rendering

- Static routes are prerendered. Their content must be in the initial HTML, and client-side navigation must keep working.
- No loading screens or artificial delays. Show a loading indicator only for real pending work.
- WebGPU is an enhancement. Load vgpu with a dynamic import, keep a CSS fallback underneath, and only reveal the canvas after the pipeline compiles. GPU errors must fall back, not leave a blank canvas.

## Shaders

- Shaders are `.wgsl` files compiled by the `@vgpu/wgsl` Vite plugin. Keep `vgpu` and `@vgpu/wgsl` on the same version.
- Validate every shader change with `pnpm exec vgpu check <file> --require-validation`.
- The vgpu docs ship with the package: `pnpm exec vgpu docs find <topic>` and `pnpm exec vgpu docs cat <path>`.

## Verification

- Check changes in the running app. For startup changes, inspect the earliest frames, not just the settled page.
- Look for empty content, flashes of unstyled content, layout shifts, and console errors.
- For routing changes, test direct visits and client-side navigation in both `pnpm dev` and `pnpm preview`.
- Headless Chrome may not get a hardware WebGPU adapter. Check GPU output in a real browser, or render frames headlessly with `vgpu/node`.
- Report only what you actually verified.
