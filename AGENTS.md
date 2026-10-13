# Agent instructions

Tyranny Tools: browser utilities at tools.tyranny.me. TanStack Start (React) on Cloudflare Workers, with Vite, Tailwind CSS 4, shadcn/ui (`base-nova`, Base UI primitives), and TypeScript 7. Setup and deployment details are in `README.md`.

Solve problems as simply as possible.

## Commands

- `pnpm check` runs the typecheck, oxlint, and oxfmt. Run it before handing work back. `pnpm format` fixes formatting.
- Run installed binaries with `pnpm exec`, never `npx` or `pnpm dlx`.
- Dependencies are pinned exactly. Do not bypass pnpm's release-age policy.
- `pnpm deploy` publishes to production. Only run it when asked.

## UI and copy

- Build from the shadcn components in `src/components/ui/` with their stock variants and patterns. Add missing ones with `pnpm exec shadcn add <name>` instead of writing look-alikes.
- Use the standard neutral theme. No custom palettes, paper effects, or textures. Keep Tyranny branding restrained.
- Every label must tell the user something the interface does not already show. Cut redundant badges, obvious status text, and filler copy. Keep field labels, units, validation messages, and real status.
- No em dashes in code, comments, UI text, or docs.

## Rendering

- Static routes are prerendered. Their content must be in the initial HTML, and client-side navigation must keep working.
- No loading screens or artificial delays. Show a loading indicator only for real pending work.

## Verification

- Check changes in the running app. For startup changes, inspect the earliest frames, not just the settled page.
- Look for empty content, flashes of unstyled content, layout shifts, and console errors.
- For routing changes, test direct visits and client-side navigation in both `pnpm dev` and `pnpm preview`.
- Report only what you actually verified.
