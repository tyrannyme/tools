# Tools

Free tools that run in your browser. Your files never leave your device.

By [Tyranny](https://tyranny.me), live at [tools.tyranny.me](https://tools.tyranny.me).

[![TanStack Start](https://shieldcn.dev/badge/framework-TanStack%20Start.svg?variant=outline&size=sm&font=geist)](https://tanstack.com/start)
[![Cloudflare Workers](https://shieldcn.dev/badge/hosting-Cloudflare%20Workers.svg?variant=outline&size=sm&font=geist)](https://developers.cloudflare.com/workers/)
[![TypeScript 7](https://shieldcn.dev/badge/language-TypeScript%207.svg?variant=outline&size=sm&font=geist)](https://www.typescriptlang.org/)
[![vgpu](https://shieldcn.dev/badge/graphics-vgpu.svg?variant=outline&size=sm&font=geist)](https://vgpu.sh)
[![Transformers.js](https://shieldcn.dev/badge/AI-Transformers.js.svg?variant=outline&size=sm&font=geist)](https://huggingface.co/docs/transformers.js)
[![MIT license](https://shieldcn.dev/badge/license-MIT-71717A.svg?variant=outline&size=sm&font=geist)](LICENSE)

![The card artwork for all 42 tools](docs/artwork.webp)

## The tools

| Category        | Tools                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI              | Remove background, Upscale image, 3D photo, Click to cut out, Read text from an image, Transcribe, Text to speech, Translate, Summarize, Proofread |
| Images          | Image resize, Image converter, Remove photo metadata, Redact a screenshot, Color palette                                                           |
| Video and audio | Compress video, Trim video, Extract audio, Audio trimmer, Video loop                                                                               |
| Documents       | Merge PDFs, Split PDF, Images to PDF, QR code, Text stats                                                                                          |
| Developer       | UUID generator, JSON formatter, Base64, Hash, JWT decoder, Timestamp converter, Color converter                                                    |
| Games           | Minecraft resource pack starter, Minecraft text formatter, Pixel art scaler, Sprite sheet slicer, Dice roller                                      |
| 3D              | 3D model viewer, Model converter, Normal map generator, Seamless texture checker, Turntable video                                                  |

The AI tools run on your device with [Transformers.js](https://huggingface.co/docs/transformers.js), [Kokoro](https://github.com/hexgrad/kokoro), and Chrome's built-in AI. Models download once, after you start a task, and stay cached. Video and audio go through [Mediabunny](https://mediabunny.dev) and WebCodecs.

## Develop

Requires Node.js 24 or newer and pnpm 12.5.1.

```sh
pnpm install
pnpm dev
```

| Command        | What it does                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm check`   | TypeScript, oxlint, and oxfmt                                                                     |
| `pnpm format`  | Apply formatting                                                                                  |
| `pnpm build`   | Build the client, Worker, and prerendered pages                                                   |
| `pnpm preview` | Serve the production build locally                                                                |
| `pnpm dev:lan` | Serve HTTPS on the local network, for testing on a phone                                          |
| `pnpm thumbs`  | Render the tool card artwork (needs [Automedia](https://automedia.tyranny.me), a GPU, and ffmpeg) |
| `pnpm og`      | Render the social preview images (needs a GPU and ffmpeg)                                         |
| `pnpm deploy`  | Build and deploy to Cloudflare                                                                    |

`pnpm dev:lan` needs a self-signed certificate in `.dev-certs/` for your machine's address:

```sh
mkdir -p .dev-certs && openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout .dev-certs/key.pem -out .dev-certs/cert.pem -subj "/CN=Tools dev" \
  -addext "subjectAltName=IP:192.168.1.126,DNS:localhost"
```

Search matches tool names on its own. With an [OpenRouter](https://openrouter.ai) key it also asks [Jev](https://openrouter.ai/typesafe) which tools fit a request like "shrink a video for Discord". The key is managed with [varlock](https://varlock.dev) and stored encrypted on your machine:

```sh
printf 'OPENROUTER_API_KEY=varlock(prompt)\n' >> .env.local
pnpm exec varlock load
```

## How it works

- **Tools** are folders in `src/tools/<category>/<slug>/` with a `meta.ts`, a `tool.tsx`, and an `art.html`. The registry in `src/lib/tools.ts` finds them, and two routes render every category and tool page. `AGENTS.md` has the rules for adding one.
- **Pages** are prerendered, so content is in the HTML before JavaScript runs. A tool's code loads only when you open it, and heavy libraries and models load only when you use them.
- **Pages are cross-origin isolated** (`public/_headers`), so on-device AI can use every CPU thread. The server build swaps browser-only libraries for stubs, which keeps the Worker under 1 MB compressed.
- **The dusk sky** in the hero and footer is a WebGPU shader written with [vgpu](https://vgpu.sh), with a CSS gradient underneath when WebGPU is missing. It renders the fog at a quarter of the size and the gold motes at full size, and phones draw it at 30 frames per second.
- **The card artwork** is HTML and CSS in each tool's `art.html`, drawn over that tool's own moment of the sky and rendered by Automedia into `public/thumbs/`. The social preview images in `public/og/` use the same shader.
- **The interface** is [shadcn/ui](https://ui.shadcn.com) on Base UI with light and dark mode. Gold is the one accent.

## Deploy

Authenticate Wrangler with the Cloudflare account that owns `tyranny.me`, then run `pnpm deploy`. It builds the site and runs `varlock-wrangler deploy`, which uploads the OpenRouter key as a secret and updates the `tyranny-tools` Worker on `tools.tyranny.me`.

Versions are pinned exactly, and pnpm keeps a minimum release age, with exceptions for Vite 8.3.4 and vgpu 0.6.0. Only `esbuild` and `workerd` may run install scripts.

## License

[MIT](LICENSE). The design skills in `.claude/skills/` keep their own licenses.
