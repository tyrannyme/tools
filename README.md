# Tools

Browser utilities by Tyranny. Intended home: **tools.tyranny.me**.

[![TanStack Start](https://shieldcn.dev/badge/framework-TanStack%20Start.svg?variant=outline&size=sm&font=geist)](https://tanstack.com/start)
[![Cloudflare Workers](https://shieldcn.dev/badge/hosting-Cloudflare%20Workers.svg?variant=outline&size=sm&font=geist)](https://developers.cloudflare.com/workers/)
[![TypeScript 7](https://shieldcn.dev/badge/language-TypeScript%207.svg?variant=outline&size=sm&font=geist)](https://www.typescriptlang.org/)

The foundation uses TanStack Start with client-side navigation and prerendered initial pages, React, Vite, Tailwind CSS, and shadcn/ui with Base UI primitives (the `base-nova` style). Use the standard neutral theme and generated components. Image resize is the first planned tool; its route is currently a placeholder.

Requires Node.js 24 or newer and pnpm 12.5.1.

```sh
pnpm install
pnpm dev
```

```sh
pnpm check     # TypeScript 7, oxlint, and oxfmt
pnpm format    # Apply formatting
pnpm build    # Build the client, Worker, and prerendered pages
pnpm preview  # Preview the production build locally
```

TanStack generates `src/routeTree.gen.ts` during development or build. On a clean checkout, run `pnpm build` before `pnpm check`.

Cloudflare configuration lives in `wrangler.jsonc`. Static routes are prerendered into `dist/client/` and served as assets, so the page content is present before JavaScript starts. The Worker handles other requests. Vite emits the deployable Worker configuration in `dist/server/wrangler.json`.

After authenticating Wrangler with the Cloudflare account that owns `tyranny.me`, deployment is:

```sh
pnpm deploy
```

This creates or updates the `tyranny-tools` Worker and its `tools.tyranny.me` custom domain. Scaffolding does not deploy the site.

pnpm keeps the machine’s configured release-age policy. Vite 8.3.4 and vgpu 0.6.0 have specific exceptions because this project explicitly uses their latest releases. Only `esbuild` and `workerd` may run dependency installation scripts.

The focused design preview lives in `proposals/image-resize.tsx`. It imports the same generated shadcn Base UI components as the app. Run `pnpm proposal` to rebuild its standalone HTML preview. The preview uses sample data and does not resize files.
