<div align="center">

# 🎛 no-tone.com

**A desktop, not a website.**

![Astro](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Worker-F38020?logo=cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Wrangler](https://img.shields.io/badge/Wrangler-CF?logo=cloudflare&logoColor=white)
![CSP](https://img.shields.io/badge/CSP-locked-2ea44f)

<p>
  <a href="#overview">Overview</a>
  ·
  <a href="#commands">Commands</a>
  ·
  <a href="#structure">Structure</a>
  ·
  <a href="#globe">Globe</a>
  ·
  <a href="#deploy">Deploy</a>
  ·
  <a href="#security">Security</a>
</p>

</div>

---

Interactive desktop built with [Astro](https://astro.build), deployed on [Cloudflare Workers](https://developers.cloudflare.com/workers/). The homepage is a canvas-based globe you can drag — click a node to open a slide-over panel with projects, CV, or colophon.

## Overview

```
no-tone.com  ───  Cloudflare Worker  ───  edge (global)
      │
      ├── index.astro      canvas + globe + rail navigation
      ├── /projects/       GitHub repos (fetched server-side)
      ├── /tldr/           quick-read profile
      ├── /usr/            directory-style reference
      ├── /cv/             curriculum vitae (panel)
      └── rss.xml          feed of main pages
```

The site is a single Worker that serves everything — no separate static host, no client-side framework. The globe runs on a `<canvas>` with a 2D context; panels are vanilla DOM built from TypeScript modules. All content, headers, and origins are locked at the edge with a CSP-enforced middleware layer.

## Commands

Run from the project root:

| Command | Action |
|---|---|
| `npm run dev` | Start local dev server (default `localhost:4321`) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally (Workers) |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run check` | Type check + dry-run deploy check |
| `npm run cf-typegen` | Regenerate Cloudflare type definitions |
| `npm run audit` | Production dependency audit |
| `npm run audit:full` | Full dependency audit (including dev) |

## Structure

| Path | What |
|---|---|
| `src/pages/index.astro` | Homepage — canvas desktop, globe, rail, clocks |
| `src/pages/404.astro` | Standalone 404 page |
| `src/pages/rss.xml.js` | RSS feed builder |
| `src/pages/robots.txt.ts` | Dynamic robots.txt (respects dev domain) |
| `src/pages/api/projects.json.ts` | Server-side GitHub proxy (cached, no rate-limit) |
| `src/pages/api/csp-report.ts` | CSP violation report endpoint |
| `src/scripts/desktop/` | Desktop app — globe, panels, data, cursor, i18n |
| `src/styles/desktop/` | Desktop design tokens + component CSS (inlined under CSP nonce) |
| `src/styles/global.css` | Global styles (used by non-desktop pages) |
| `src/components/` | Astro components (`BaseHead.astro`, `Header.astro`) |
| `src/middleware.ts` | CSP + security headers middleware |
| `src/worker.ts` | Cloudflare Worker entrypoint |
| `public/` | Static assets — icons, favicon, meta images |
| `public/site.webmanifest` | PWA manifest for android-chrome icons |
| `astro.config.mjs` | Astro configuration |
| `wrangler.json` | Cloudflare Workers configuration |

## Globe

The globe (`VireGlobe` in `src/scripts/desktop/globe.ts`) is a dotted Earth rendered on `<canvas>`:

- **Land** dots are brighter, **ocean** dots are faint — the silhouette reads from any angle.
- **Auto-rotates** at a slow pace; drag to spin/tilt.
- **Nodes** (projects, cv, about, contact, github) are positioned at lat/lon and rendered as DOM overlays via `translate()` each frame.
- **Colour** is read live from `--accent`, so the globe tracks the signature palette.
- **Arcs** connect adjacent nodes with quadratic curves.

The globe is pure 2D canvas — no WebGL, no Three.js, no dependencies. Continent outlines are hardcoded as lon/lat rings and rasterised to an offscreen mask once.

## Deploy

```bash
git clone https://github.com/no-tone/no-tone.com.git
cd no-tone.com
npm install
npm run dev        # local
npm run deploy     # to Cloudflare Workers
```

Requires a Cloudflare account with Workers enabled. The `wrangler.json` expects:
- `KV` namespace binding named `SESSION` (for Astro sessions)
- Optional `SESSION_SECRET` secret

## Security

| Layer | What |
|---|---|
| **CSP** | Strict nonce-based policy — only inlined scripts with the correct nonce execute. `style-src 'unsafe-inline'` (the nonce'd `<style>` is replaced by the CSP nonce in the middleware). |
| **HTTPS** | Enforced at the edge by Cloudflare. |
| **Headers** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` locked down in middleware. |
| **CSP reports** | Violations POST to `/api/csp-report` (logged server-side). |
| **Dev domain** | `dev.no-tone.com` gets `noindex, nofollow` + full `Disallow: /` in robots.txt. |
| **Dependencies** | `npm run audit` checks production deps; `npm run audit:full` checks everything. |

## Getting started

Prerequisites: Node.js and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:4321` — the desktop should load with the globe spinning.
