# CLAUDE.md — Filigrana

Rules for whoever maintains this project, human or AI coding agent. The README (Portuguese) is
the public description; this file is the maintainer's rulebook. Private notes belong in
`CLAUDE.local.md` (gitignored), never here. Nothing in this file is secret, and it must stay
that way: no tokens, account IDs, local paths or personal contact details.

## What this is

Filigrana (https://filigrana.ao) stamps a recipient and date across copies of ID documents,
images and PDFs, so a copy handed to one entity cannot be reused elsewhere. It is a static
site: `public/` is served as-is by Cloudflare Pages, there is no backend, no build step is
needed to run it, and the only runtime dependency is the vendored pdf.js. Every push to `main`
is a production deploy within about a minute. Treat `main` as production.

## Invariants

If a change conflicts with one of these, change the change, not the invariant.

1. **Nothing leaves the device.** No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or
   `navigator.sendBeacon`; no `<img>`, `<link>` or `<script>` to other origins; no CDNs; no
   analytics, error reporting or cookies; no service worker without an explicit decision.
   All assets (fonts, pdf.js, icons) are self-hosted in `public/`.
2. **CSP stays strict, in both places.** The policy lives in the `<meta>` of
   `public/index.html` and in `public/_headers` (which adds `frame-ancestors`). Keep them
   equivalent. Keep `default-src 'none'`, `connect-src 'none'`, `form-action 'none'`,
   `base-uri 'none'`; never add `unsafe-inline` or `unsafe-eval`. No inline scripts or styles
   in `index.html`: they would violate the policy and break the hashed single-file build.
3. **Never persist document content or the watermark text.** `localStorage` holds only
   preferences (`lang`, `color`, `size`, `opacity`, `rotation`, `density`) under the key
   `filigrana-prefs`. Nothing else is stored anywhere.
4. **Output is flattened raster.** The mark is drawn into the pixels. PDFs are rasterised page
   by page (scale ≤ 2, longest side ≤ 4000 px, flattened on white) and rewritten by the
   minimal PDF writer in `app.js` (`buildPdf`: one JPEG XObject per page, original MediaBox).
   Do not turn this into a text or vector layer; a removable layer defeats the purpose.
   Re-encoding also strips EXIF; keep it that way.
5. **pdf.js is vendored, pinned and hashed.** `public/vendor/` holds the official Mozilla
   build, unmodified. `getDocument` is always called with `isEvalSupported: false`
   (mitigation for CVE-2024-4367; the CSP blocks eval as well, keep both). The pinned
   SHA-256 of each vendored file lives in `vendor.lock.json` and `npm run check` refuses any
   difference. To update: download the release from github.com/mozilla/pdf.js/releases,
   verify the SHA-256 of the files, then update `vendor.lock.json`, README ("Como
   verificar"), `build.mjs`, the comment in `index.html` and this file; the check enforces
   all five. Current: 3.11.174. Planned: 6.x, whose builds are ES modules and will need
   `type="module"` script tags, a module worker and a change to the worker embedding in
   `build.mjs`.
6. **Two languages, one dictionary.** All UI strings live in `T.pt` and `T.en` in
   `public/app.js` and reach the DOM through `data-i18n` / `data-i18n-ph` attributes. Every
   new string gets both languages. Portuguese is European/Angolan with pre-AO90 spelling
   (marca de água, protecção, ficheiro, actividade, objectivo); no Brazilian forms.
   Default language: `navigator.language` starting with `pt` gives PT, anything else EN; a
   saved preference wins.
7. **No real documents, ever.** Tests, screenshots, fixtures and press material use only the
   fictional "Testelândia" specimen (see `tools/press-kit.html`; the tests draw their own on a
   canvas and build PDFs by hand, so no binary fixtures exist). Never commit, paste or
   generate anything that looks like a real ID.
8. **Stay dependency-free.** Vanilla JS and CSS, no framework, no bundler, no runtime npm
   dependencies. The only devDependency is `@playwright/test`, pinned to an exact version and
   bumped by Dependabot. The single-file `dist/filigrana.html` must keep working offline,
   opened from disk, images and PDFs alike; the tests enforce it.

## Repository map

```
public/              deploy root (Cloudflare Pages: output dir = public, no build command)
  index.html         markup, meta CSP, OG tags; show/hide only via the `hidden` attribute
  app.js             all logic in one IIFE: i18n, image/PDF loading, render, watermark, PDF writer
  style.css          design tokens, layout, self-hosted @font-face
  _headers           security headers for Cloudflare Pages (CSP, HSTS, X-Frame-Options, ...)
  404.html           required: without it Pages' SPA fallback answers 200 for unknown paths
  vendor/            pdf.js (pinned, hashed)        fonts/    Sora, JetBrains Mono (woff2)
  assets/            mark, PWA icons, OG image      manifest.webmanifest
build.mjs            builds dist/filigrana.html (single file, CSP by SHA-256 hashes); optional
vendor.lock.json     version, source and SHA-256 of every file in public/vendor/
tools/serve.mjs      dev server (npm run dev); applies _headers to responses from public/
tools/check.mjs      integrity and privacy checks (npm run check); also runs in CI
tools/*.html         generators for brand assets and press images; open them in a browser
tests/               Playwright suite (npm test) + helpers that generate the fixtures in code
playwright.config.mjs  two Chromium profiles: desktop pt-PT, Pixel 5 en-GB; test server on 8778
.github/workflows/   check.yml runs npm run check and npm test on every pull request and on main
dist/, press/        build output and press material; gitignored
```

## Commands

```
npm run dev      serves the repo at http://127.0.0.1:8768/  (public/ at the root; also /tools/, /press/, /dist/)
npm run build    writes dist/filigrana.html
npm run check    vendor hashes, no-network grep, CSP parity, headers, i18n parity, build, secrets scan
npm test         Playwright in Chromium: image, PDF, export, compare, airplane mode, single file
                 (served and file://), CSP refusals, language, prefs, 404; fails on any request
                 leaving the site. First time: npm install && npx playwright install chromium
```

`npm run check` and `npm test` are the merge gate: GitHub Actions runs both on every pull
request and `main` only accepts pull requests with both passing. Run them locally before
pushing. The test server (`tools/serve.mjs --cache`) mirrors production's Cache-Control so the
airplane-mode test reflects what users get.

## Things that cost hours once

- pdf.js must run in a real Web Worker, and we create it ourselves: `getPdfWorker()` at the
  bottom of `app.js` spawns one `Worker` (served: `vendor/pdf.worker.min.js`; single file: a
  Blob URL of the embedded `<script type="text/js-worker">`, see step 2 of `build.mjs`) and
  passes it to `getDocument` as `worker`. Never go back to `GlobalWorkerOptions.workerSrc`:
  pdf.js's own start-up falls back to a main-thread "fake worker" loaded through a `<script>`
  tag, which hangs on `page.render()` and is blocked by the hash CSP, and from `file://` its
  blob wrapper fails as well (found by the tests, 2026-09-08).
- `file://` cannot start a worker from a file URL, so `public/index.html` opened from disk
  handles images only; the single file works from disk because its worker is a Blob. Always
  test through `npm run dev` or `npm test`.
- Cloudflare Pages caches assets for 4 hours (`max-age=14400, must-revalidate`) and HTML not
  at all. Airplane mode after a first PDF therefore works for about 4 hours; the single file
  is the real offline story. Changing that means versioned vendor paths plus long caching.
- Rendering is cancellable through `renderToken` in `app.js`. Keep that pattern for any new
  async step, or fast slider moves will paint stale frames.
- HEIC is deliberately unsupported: no decoder is shipped and the UI explains how to export a
  JPG. A decoder would add megabytes and native-code risk; decide explicitly before adding one.
- `MAX_SIDE = 4000` and `MAX_PAGES = 30` exist for mobile canvas memory. Raising them needs a
  test on a mid-range Android phone, not a laptop.
- Cloudflare: analytics come only from edge request logs. Never enable the JavaScript beacon
  ("Web Analytics"), Rocket Loader, Email Obfuscation or any feature that injects scripts.

## Workflow

- Branch, pull request, wait for the `check` and `test` jobs, look at the Cloudflare Pages
  preview URL, merge to `main`. `main` is protected: no direct pushes, no force pushes, pull
  request and passing `check` and `test` required, admins included.
- Commit with the noreply address configured in this repository (`git config user.email`).
- Before merging anything that touches `app.js`, `index.html`, `_headers` or `vendor/`:
  1. `npm run build` succeeds.
  2. Load an image and a multi-page PDF, apply a mark, download both, open the outputs.
  3. DevTools Network: only same-origin GETs and `blob:` entries; nothing new after loading
     a document except the PDF worker. Console: no CSP violations.
  4. Both languages, mobile width (below 880 px), hold-to-compare.
- The version string lives in `package.json` and in the footer of `public/index.html`. Bump
  both, tag `vX.Y.Z`, and attach `dist/filigrana.html` with its SHA-256 to the GitHub release.

## Style

Vanilla ES2020+, two-space indent, single quotes, no globals (everything stays inside the
IIFE), `hidden` attribute for visibility, colours and spacing from the tokens in `style.css`.
Comments and commit messages in Portuguese or English; UI text only through the dictionary.

## Out of scope unless explicitly decided

Backend or accounts, analytics beacons, cookies, third-party fonts or CDNs, HEIC decoding,
selectable-text PDF output, service worker or offline PWA (privacy-neutral, but it changes how
updates reach users), frameworks or bundlers.
