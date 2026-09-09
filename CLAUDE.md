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
   analytics scripts, error reporting or cookies; no service worker without an explicit
   decision. Visit statistics exist, but only as the host's aggregate request counts; every
   public text says "no analytics scripts", never "no analytics".
   All assets (fonts, pdf.js, icons) are self-hosted in `public/`.
2. **CSP stays strict, in both places.** The policy lives in the `<meta>` of
   `public/index.html` and in `public/_headers` (which adds `frame-ancestors`). Keep them
   equivalent. Keep `default-src 'none'`, `connect-src 'none'`, `form-action 'none'`,
   `base-uri 'none'`; never add `unsafe-inline` or `unsafe-eval`. Two paths a CSP cannot
   govern in today's browsers: a top-level navigation carrying data in the URL, and WebRTC.
   Both need code in the public, hashed app.js, and the README says so. Do not add
   `webrtc 'block'`: Chromium does not recognise the directive and logs a console error on
   every page (tested 2026-09-09); the check refuses it. No inline scripts or styles
   in `index.html`: they would violate the policy and break the hashed single-file build.
3. **Never persist document content or the watermark text.** `localStorage` holds only
   preferences (`lang`, `color`, `size`, `opacity`, `rotation`, `density`) under the key
   `filigrana-prefs`. Nothing else is stored anywhere. `public/privacidade.html` and
   `SECURITY.md` describe exactly this state to users, auditors and the APD; any change to
   what the site stores, who processes it, or which third party is involved updates both files
   in the same pull request, before it ships.
4. **Output is flattened raster.** The mark is drawn into the pixels. PDFs are rasterised page
   by page (scale ≤ 2, longest side ≤ 4000 px, flattened on white) and rewritten by the
   minimal PDF writer in `app.js` (`buildPdf`: one JPEG XObject per page, original MediaBox).
   Do not turn this into a text or vector layer; a removable layer defeats the purpose.
   Re-encoding also strips EXIF; keep it that way.
5. **pdf.js is vendored, pinned, hashed and lazy.** `public/vendor/pdfjs-<version>/` holds
   the official legacy build from the npm package `pdfjs-dist` (ES modules `pdf.min.mjs` and
   `pdf.worker.min.mjs`) plus the pure-JavaScript JPEG 2000 and JBIG2 decoders from its
   `wasm/` directory, unmodified, with their licences. `app.js` imports the library only when
   the first PDF is opened (`loadPdfjs`), creates the module worker itself and calls
   `getDocument` with `worker` and `useWasm: false`: no `.wasm` fetch can ever happen under
   the CSP, and the decoders are imported by the worker from `vendor/…/wasm/` only when a PDF
   needs them. The version lives in one place, `PDFJS_DIR` in `app.js`; `build.mjs` reads
   it. `vendor.lock.json` pins the SHA-256 of every vendored file and `npm run check` refuses
   any difference, any extra file, and any `eval(`, `new Function(` or `importScripts(` in
   the vendored code. To update: `npm pack pdfjs-dist@<v>`, copy the files into a new
   `pdfjs-<v>/` directory, delete the old one, change `PDFJS_DIR`, then update
   `vendor.lock.json`, README ("Como verificar"), LICENSE and this file. Current: 6.3.289
   (legacy build: Chrome 125+, Firefox ESR, Safari 18+; older browsers get the "could not
   read this PDF" message and images keep working).
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
  privacidade.html   privacy page (Lei 22/11): controller, processor, access logs, rights; no scripts
  404.html           required: without it Pages' SPA fallback answers 200 for unknown paths
  vendor/pdfjs-<v>/  pdf.js legacy build + JS decoders (pinned, hashed)   fonts/  Sora, JetBrains Mono
  assets/            mark, PWA icons, OG image      manifest.webmanifest
build.mjs            builds dist/filigrana.html (single file, CSP by SHA-256 hashes); optional
vendor.lock.json     version, source and SHA-256 of every file in public/vendor/
tools/serve.mjs      dev server (npm run dev); applies _headers to responses from public/
tools/check.mjs      integrity and privacy checks (npm run check); also runs in CI
tools/*.html         generators for brand assets and press images; open them in a browser
tests/               Playwright suite (npm test) + helpers that generate the fixtures in code
playwright.config.mjs  two Chromium profiles: desktop pt-PT, Pixel 5 en-GB; test server on 8778
.github/workflows/   check.yml runs npm run check and npm test on every pull request and on main
SECURITY.md          security document (Lei 22/11 art. 30) + vulnerability reporting; GitHub shows it
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
  bottom of `app.js` spawns one module `Worker` (served: `vendor/pdfjs-<v>/pdf.worker.min.mjs`;
  single file: a Blob URL of the embedded `<script type="text/js-worker">`, see `build.mjs`)
  and passes it to `getDocument` as `worker`. Never go back to `GlobalWorkerOptions.workerSrc`:
  pdf.js's own start-up falls back to a main-thread "fake worker" loaded through a `<script>`
  tag, which hangs on `page.render()` and is blocked by the hash CSP, and from `file://` its
  blob wrapper fails as well (found by the tests, 2026-09-08).
- The library is loaded lazily with `import()` (`loadPdfjs` in `app.js`). The single file
  inlines `pdf.min.mjs` as an inline `<script type="module">` (it defines
  `globalThis.pdfjsLib`), then the worker source, then `app.js` as a second module, and
  `build.mjs` swaps the `loadPdfjs` line for `Promise.resolve(globalThis.pdfjsLib)`. Inline
  module scripts are hashed like any other; keep exactly two.
- Chromium refuses a *module* worker created from a `blob:` (or `data:`) URL on a `file://`
  page, but accepts a classic one. So `build.mjs` converts the embedded worker to a classic
  script (strips the final `export{…}` and neutralises the Node-only `import.meta.url`, with
  guards) and `app.js` starts the embedded worker without `type: 'module'`; the served worker
  stays the untouched ES module from `vendor/`.
- `file://` cannot start a worker from a file URL, so `public/index.html` opened from disk
  handles images only; the single file works from disk because its worker is a Blob. Always
  test through `npm run dev` or `npm test`.
- Cloudflare Pages serves clean URLs: `/privacidade.html` is a 308 redirect to `/privacidade`,
  and `/index.html` to `/`. Link pages without the `.html` suffix (the check refuses it) and keep
  canonical URLs in the clean form; `tools/serve.mjs` mirrors both behaviours locally.
- Cloudflare Pages caches HTML not at all and other assets for 4 hours, except `vendor/*`,
  which `_headers` marks `immutable` for a year because the version is in the path. Airplane
  mode after a first PDF therefore keeps working: the worker persists for the session and the
  files stay cached. The single file is the fully offline story.
- Rendering is cancellable through `renderToken` in `app.js`. Keep that pattern for any new
  async step, or fast slider moves will paint stale frames.
- HEIC is deliberately unsupported: no decoder is shipped and the UI explains how to export a
  JPG. A decoder would add megabytes and native-code risk; decide explicitly before adding one.
- `MAX_SIDE = 4000` and `MAX_PAGES = 30` exist for mobile canvas memory. Raising them needs a
  test on a mid-range Android phone, not a laptop.
- Cloudflare: analytics come only from edge request logs. Never enable the JavaScript beacon
  ("Web Analytics"), Rocket Loader, Email Obfuscation or any feature that injects scripts.
  Dashboard toggles are not the control, though: every HTML page carries `Cache-Control:
  no-transform` from `_headers`, which Cloudflare honours by injecting nothing (its docs say
  so explicitly for JavaScript Detections, which on the Free plan cannot be switched off).
  HTML only: on other files `no-transform` also disables Brotli compression, and injection
  never touches them. Never remove it; the check verifies it per path and the tests on the
  served pages. Found the hard way on 2026-09-08, when both the analytics beacon and the
  bot-detection snippet appeared in production HTML and were blocked by the CSP.
- Pages `_headers` mechanics, verified on a preview: every matching rule applies, and a header
  set by more than one matching rule gets its values joined, not overridden. So Cache-Control
  must come from exactly one rule per path; the check enforces it and `serve.mjs` joins the
  same way so a duplicate shows up locally.

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
