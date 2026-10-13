# Tools

Small tools that run in your browser. By [Tyranny](https://tyranny.me), at [tools.tyranny.me](https://tools.tyranny.me).

[![TanStack Start](https://shieldcn.dev/badge/framework-TanStack%20Start.svg?variant=outline&size=sm&font=geist)](https://tanstack.com/start)
[![Cloudflare Workers](https://shieldcn.dev/badge/hosting-Cloudflare%20Workers.svg?variant=outline&size=sm&font=geist)](https://developers.cloudflare.com/workers/)
[![TypeScript 7](https://shieldcn.dev/badge/language-TypeScript%207.svg?variant=outline&size=sm&font=geist)](https://www.typescriptlang.org/)
[![vgpu](https://shieldcn.dev/badge/graphics-vgpu.svg?variant=outline&size=sm&font=geist)](https://vgpu.sh)

Image resize is the first planned tool. Its page is a placeholder for now.

## Develop

Requires Node.js 24 or newer and pnpm 12.5.1.

```sh
pnpm install
pnpm dev
```

```sh
pnpm check     # TypeScript, oxlint, and oxfmt
pnpm format    # Apply formatting
pnpm build     # Build the client, Worker, and prerendered pages
pnpm preview   # Serve the production build locally
pnpm proposal  # Rebuild the standalone design preview
```

## How it works

Pages live in `src/routes/` and are prerendered into `dist/client/`, so their content is in the HTML before JavaScript runs. After that, navigation happens in the browser. The Worker handles everything else.

The interface uses shadcn/ui with Base UI primitives (`base-nova`) on the standard neutral theme. Gold is the one accent: the flourishes, framed corners, and footer motto come from `src/components/ornament.tsx`.

The home page hero is a WebGPU shader written with [vgpu](https://vgpu.sh): dusk fog with gold motes that warm up under the cursor. The shader is `src/components/gilded-dusk.wgsl`, and `src/components/gilded-dusk.ts` runs it. vgpu loads after the page is up. Without WebGPU, the hero shows a matching CSS gradient. The animation pauses off screen and holds still for reduced motion.

Validate shader changes against a real GPU:

```sh
pnpm exec vgpu check src/components/gilded-dusk.wgsl --require-validation
```

`proposals/image-resize.tsx` is a design preview of the image resize tool, built from the same components as the app. `pnpm proposal` turns it into `proposals/image-resize.html`. It uses sample data and does not resize files.

## Deploy

Cloudflare configuration lives in `wrangler.jsonc`. Authenticate Wrangler with the Cloudflare account that owns `tyranny.me`, then run:

```sh
pnpm deploy
```

This creates or updates the `tyranny-tools` Worker and its `tools.tyranny.me` custom domain.

## Dependencies

Versions are pinned exactly. pnpm keeps the machine's release-age policy, with exceptions for Vite 8.3.4 and vgpu 0.6.0 because this project uses their latest releases. Only `esbuild` and `workerd` may run install scripts. vgpu's Node GPU backend is denied them because the site only uses vgpu in the browser.
