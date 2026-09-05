// Gera dist/filigrana.html — o ficheiro único portátil (offline, sem rede).
// Embute: style.css (+ fontes e imagens como data: URIs), pdf.js, o worker (não
// executado, lançado via Blob URL pelo app.js) e o próprio app.js. A CSP <meta> é
// reescrita com hashes SHA-256 dos blocos inline, para continuar estrita.
// Uso: node build.mjs   (a partir da pasta do projecto)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const P = 'public/';
const read = f => readFileSync(P + f, 'utf8');
const dataUri = (f, mime) => `data:${mime};base64,${readFileSync(P + f).toString('base64')}`;
const sha = s => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const guard = (s, name, closer) => {
  if (s.includes(closer)) throw new Error(`${name} contém "${closer}" — não pode ser embutido tal e qual`);
  return s;
};

let html = read('index.html');

// 1) CSS com fontes embutidas
const css = guard(
  read('style.css').replace(/url\(fonts\/([^)]+)\)/g, (_, f) => `url(${dataUri('fonts/' + f, 'font/woff2')})`),
  'style.css', '</style>');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`);

// 2) scripts inline (guardamos o conteúdo exacto para calcular os hashes CSP)
const inlineScripts = [];
const inline = (name, src) => {
  const body = `/* inlined ${name} */\n${guard(src, name, '</script>')}\n`;
  inlineScripts.push(body);
  return `<script>${body}</script>`;
};
html = html.replace('<script src="vendor/pdf.min.js"></script>', () =>
  inline('pdf.min.js — pdf.js 3.11.174 (cdnjs)', read('vendor/pdf.min.js')) +
  `\n<script id="pdfjs-worker-inline" type="text/js-worker">${guard(read('vendor/pdf.worker.min.js'), 'pdf.worker.min.js', '</script>')}</script>`);
html = html.replace('<script src="app.js"></script>', () => inline('app.js', read('app.js')));

// 3) imagens SVG → data: URIs; extras que só fazem sentido servidos saem
html = html.replace(/(src|href)="assets\/([^"]+\.svg)"/g, (_, a, f) => `${a}="${dataUri('assets/' + f, 'image/svg+xml')}"`);
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '').replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '');

// 4) CSP estrita com hashes
const csp = [
  "default-src 'none'",
  `script-src ${inlineScripts.map(sha).join(' ')}`,
  `style-src ${sha(css)}`,
  'img-src data: blob:',
  'font-src data:',
  'worker-src blob:',
  "connect-src 'none'", "base-uri 'none'", "form-action 'none'",
].join('; ');
html = html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, () =>
  `<meta http-equiv="Content-Security-Policy" content="${csp}">`);

// 5) sanidade: nada pode ficar a apontar para ficheiros
const leftover = html.match(/(src|href)="(vendor|fonts|assets|style\.css|app\.js)[^"]*"/);
if (leftover) throw new Error(`sobrou uma referência por embutir: ${leftover[0]}`);

mkdirSync('dist', { recursive: true });
writeFileSync('dist/filigrana.html', html);
console.log(`dist/filigrana.html: ${(html.length / 1024 / 1024).toFixed(2)} MB · ${inlineScripts.length} scripts inline`);
