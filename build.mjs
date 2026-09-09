// Gera dist/filigrana.html — o ficheiro único portátil (offline, sem rede).
// Embute: style.css (+ fontes e imagens como data: URIs), o pdf.js (módulo ES inline, que define
// globalThis.pdfjsLib), o worker do pdf.js (bloco não executado, convertido em script clássico;
// o app.js lança-o como Worker a partir de um Blob) e o próprio app.js (como módulo, para correr
// depois do pdf.js). A CSP <meta> é reescrita com hashes SHA-256 dos blocos inline.
// Limite conhecido: os descodificadores JPEG 2000/JBIG2 (vendor/…/wasm/) não são embutidos — o
// worker importa-os por URL, o que um ficheiro sem servidor não permite; PDFs com essas imagens
// só no site.
// Uso: node build.mjs   (a partir da pasta do projecto)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const P = 'public/';
const read = f => readFileSync(P + f, 'utf8');
const dataUri = (f, mime) => `data:${mime};base64,${readFileSync(P + f).toString('base64')}`;
const sha = s => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const guard = (s, name) => {
  for (const bad of ['</script', '<!--']) must(!s.toLowerCase().includes(bad), `${name} contém "${bad}" — não pode ser embutido tal e qual`);
  return s;
};

let html = read('index.html');
let app = read('app.js');

// a pasta do pdf.js vem do app.js: é a única fonte da versão
const PDFJS_DIR = (app.match(/const PDFJS_DIR = '([^']+)';/) || [])[1];
must(PDFJS_DIR, 'app.js sem PDFJS_DIR');

// 1) CSS com fontes embutidas
const css = guard(
  read('style.css').replace(/url\(fonts\/([^)]+)\)/g, (_, f) => `url(${dataUri('fonts/' + f, 'font/woff2')})`),
  'style.css');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`);

// 2) app.js no ficheiro único: a biblioteca já está carregada (módulo inline anterior) e não há
//    pasta vendor/ (os descodificadores JPEG 2000/JBIG2 ficam de fora)
const loadLine = (app.match(/^.*const loadPdfjs = .*$/m) || [])[0];
must(loadLine, 'app.js sem a linha loadPdfjs');
app = app.replace(loadLine, '  const loadPdfjs = () => Promise.resolve(globalThis.pdfjsLib); // ficheiro único: pdf.js embutido');
app = app.replace(`const PDFJS_DIR = '${PDFJS_DIR}';`, "const PDFJS_DIR = 'embutido/';");

// 3) worker do pdf.js como script clássico: o Chrome recusa Workers módulo criados a partir de
//    blob: numa página file:// (origem opaca), mas aceita clássicos. O bundle só é ESM por causa
//    do `export{…}` final e de dois `import.meta.url` em código exclusivo do Node.js; tira-se um
//    e neutraliza-se o outro, com guardas para uma versão futura que mude a forma do ficheiro.
function workerAsClassic(src){
  const metas = (src.match(/import\.meta/g) || []).length;
  must(metas === (src.match(/import\.meta\.url/g) || []).length, 'import.meta usado de forma inesperada no worker');
  src = src.replace(/import\.meta\.url/g, 'undefined');
  const exp = src.match(/export\s*\{[^}]*\};?\s*$/);
  must(exp, 'o worker não termina com export{…}');
  src = src.slice(0, exp.index);
  must(!/\bexport\s*[{*]|^\s*export\s|\bimport\.meta\b/m.test(src), 'o worker ainda tem sintaxe de módulo');
  return src;
}

// 4) scripts inline (guardamos o conteúdo exacto para calcular os hashes CSP)
const inlineScripts = [];
const inlineModule = (name, src) => {
  const body = `/* inlined ${name} */\n${guard(src, name)}\n`;
  inlineScripts.push(body);
  return `<script type="module">${body}</script>`;
};
const pdfjs = read(PDFJS_DIR + 'pdf.min.mjs');
must(pdfjs.includes('globalThis.pdfjsLib'), 'pdf.min.mjs não define globalThis.pdfjsLib');
html = html.replace('<script src="app.js"></script>', () =>
  inlineModule(`pdf.min.mjs — ${PDFJS_DIR.replace(/^vendor\//, '')}`, pdfjs) +
  `\n<script id="pdfjs-worker-inline" type="text/js-worker">${guard(workerAsClassic(read(PDFJS_DIR + 'pdf.worker.min.mjs')), 'pdf.worker.min.mjs')}</script>\n` +
  inlineModule('app.js', app));

// 5) imagens SVG → data: URIs; extras que só fazem sentido servidos saem
html = html.replace(/(src|href)="assets\/([^"]+\.svg)"/g, (_, a, f) => `${a}="${dataUri('assets/' + f, 'image/svg+xml')}"`);
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '').replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace(/\s*<link rel="icon" href="\/favicon\.ico"[^>]*>/, '');
// a página de privacidade não vai no ficheiro único: a ligação aponta para o site
html = html.replace('href="privacidade"', 'href="https://filigrana.ao/privacidade"');

// 6) CSP estrita com hashes
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

// 7) sanidade: nada pode ficar a apontar para ficheiros
const leftover = html.match(/(src|href)="(vendor|fonts|assets|style\.css|app\.js)[^"]*"/);
must(!leftover, `sobrou uma referência por embutir: ${leftover && leftover[0]}`);
const code = html.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, ''); // sem comentários
must(!code.includes('vendor/'), 'o ficheiro único não pode referir vendor/ fora de comentários');
must(inlineScripts.length === 2, `esperava 2 módulos inline, há ${inlineScripts.length}`);

mkdirSync('dist', { recursive: true });
writeFileSync('dist/filigrana.html', html);
console.log(`dist/filigrana.html: ${(html.length / 1024 / 1024).toFixed(2)} MB · ${inlineScripts.length} módulos inline · pdf.js ${PDFJS_DIR}`);
