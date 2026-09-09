// Verificações de integridade e de privacidade do Filigrana. Sem dependências, só Node.
// Corre localmente com `npm run check` e no GitHub Actions em cada pull request.
// Cada verificação lança um erro quando falha; o processo termina com código 1 se alguma falhar.
// As verificações codificam os invariantes do CLAUDE.md: nada sai do dispositivo, CSP estrita,
// nada do documento é guardado, pdf.js fixado por hash, duas línguas em paridade, sem segredos.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const rel = f => join(ROOT, f);
const read = f => readFileSync(rel(f), 'utf8');
const sha256 = f => createHash('sha256').update(readFileSync(rel(f))).digest('hex');
const fail = msg => { throw new Error(msg); };

// hosts para onde as páginas podem ter ligações <a> (nunca recursos: esses são sempre locais)
const ALLOWED_LINK_HOSTS = ['auroraborealis-ao.com', 'github.com', 'www.cloudflare.com'];

const results = [];
function check(name, fn){
  try { results.push({ name, ok: true, note: fn() || '' }); }
  catch (e){ results.push({ name, ok: false, note: e.message }); }
}

const lock = JSON.parse(read('vendor.lock.json'));
const pkg = JSON.parse(read('package.json'));
const html = read('public/index.html');
const app = read('public/app.js');
const headersTxt = read('public/_headers');
const walk = d => readdirSync(rel(d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);

// src/href de recursos (script, link, img, …) que apontam para fora do site
function externalResources(doc, { flagData } = {}){
  const out = [];
  for (const tag of doc.match(/<(script|link|img|source|video|audio)\b[^>]*>/gi) || []){
    if (/^<link\b/i.test(tag) && /rel="(canonical|alternate|author|license|me)"/i.test(tag)) continue;
    const m = tag.match(/\b(?:src|href)="([^"]*)"/i);
    if (!m) continue;
    if (/^(?:https?:)?\/\//i.test(m[1]) || (flagData && /^data:/i.test(m[1]))) out.push(m[1]);
  }
  return out;
}

// ---------- vendor ----------
check('vendor: hashes SHA-256 conferem com vendor.lock.json e não há ficheiros a mais', () => {
  const listed = new Set();
  for (const entry of Object.values(lock.packages)){
    for (const [file, hash] of Object.entries(entry.files)){
      listed.add(file);
      if (!existsSync(rel(file))) fail(`${file} não existe`);
      const got = sha256(file);
      if (got !== hash) fail(`${file}: esperado ${hash.slice(0, 12)}…, obtido ${got.slice(0, 12)}…`);
    }
  }
  const extra = walk('public/vendor').filter(f => !listed.has(f));
  if (extra.length) fail(`ficheiros em public/vendor/ fora do lock: ${extra.join(', ')}`);
  return Object.entries(lock.packages).map(([n, e]) => `${n} ${e.version}`).join(', ');
});

check('vendor: versão do pdf.js coerente em app.js (PDFJS_DIR), README, CLAUDE.md e LICENSE', () => {
  const { version, files } = lock.packages['pdf.js'];
  const dir = `vendor/pdfjs-${version}/`;
  if (!app.includes(`const PDFJS_DIR = '${dir}';`)) fail(`app.js sem PDFJS_DIR = '${dir}'`);
  for (const f of Object.keys(files)) if (!f.startsWith('public/' + dir)) fail(`${f} fora de public/${dir}`);
  for (const f of ['README.md', 'CLAUDE.md', 'LICENSE']) if (!read(f).includes(version)) fail(`${f} não menciona ${version}`);
  const readme = read('README.md');
  for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) if (!readme.includes(files['public/' + dir + f])) fail(`README não lista o hash de ${f}`);
});

check('vendor: sem eval, new Function nem importScripts em nenhum ficheiro JS', () => {
  const files = walk('public/vendor').filter(f => /\.m?js$/.test(f));
  if (!files.length) fail('nenhum ficheiro JS em public/vendor/');
  for (const f of files){
    const src = read(f);
    for (const [re, what] of [[/\beval\s*\(/, 'eval('], [/\bnew\s+Function\s*\(/, 'new Function('], [/\bimportScripts\s*\(/, 'importScripts(']]) if (re.test(src)) fail(`${f}: ${what}`);
  }
  return `${files.length} ficheiros`;
});

// ---------- app.js ----------
check('app.js: getDocument sempre com worker próprio e useWasm:false; import() só do vendor próprio', () => {
  const calls = app.match(/getDocument\(\{[^}]*\}/g) || [];
  if (!calls.length) fail('nenhuma chamada a getDocument encontrada');
  for (const c of calls){
    if (!/\bworker\b/.test(c)) fail(`sem worker próprio: ${c}`);
    if (!/useWasm:\s*false/.test(c)) fail(`sem useWasm:false: ${c}`);
  }
  const imports = app.match(/\bimport\([^)]*\)/g) || [];
  const bad = imports.filter(i => !i.startsWith('import(pdfjsUrl('));
  if (bad.length) fail(`import() fora do vendor: ${bad.join(' | ')}`);
  return `${calls.length} chamada(s), ${imports.length} import()`;
});

const FORBIDDEN = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'navigator.share', 'postMessage',
  'window.open', 'importScripts', 'document.cookie', 'indexedDB', 'sessionStorage', 'http:', 'https:', 'eval(', 'new Function'];
check('app.js: sem APIs de rede, cookies, armazenamento extra ou eval', () => {
  const code = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1'); // sem comentários
  const hits = FORBIDDEN.filter(p => code.includes(p));
  if (hits.length) fail(`encontrado: ${hits.join(', ')}`);
  return `${FORBIDDEN.length} padrões ausentes`;
});

check('app.js: localStorage só guarda preferências (nunca o texto da marca)', () => {
  const sets = app.match(/localStorage\.setItem\([^)]*\)/g) || [];
  if (!sets.length) fail('nenhum setItem (esperava-se o das preferências)');
  for (const s of sets){
    if (!s.startsWith('localStorage.setItem(PREFS_KEY')) fail(`setItem com outra chave: ${s.slice(0, 60)}`);
    if (/text|wm|marca/i.test(s)) fail(`o objecto guardado parece incluir o texto da marca: ${s.slice(0, 80)}`);
  }
  for (const k of app.match(/localStorage\.(?:getItem|removeItem)\([^)]*\)/g) || []) if (!k.includes('PREFS_KEY')) fail(`acesso a outra chave: ${k}`);
});

// ---------- páginas HTML ----------
const pages = walk('public').filter(f => /^public\/[^/]+\.html$/.test(f));
check('páginas HTML: sem scripts inline (e só index.html tem scripts), sem estilos inline, sem recursos externos, ligações só para hosts autorizados', () => {
  const problems = [];
  let anchorsTotal = 0;
  for (const f of pages){
    const doc = read(f);
    if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(doc)) problems.push(`${f}: script inline`);
    if (f !== 'public/index.html' && /<script\b/i.test(doc)) problems.push(`${f}: não pode ter scripts`);
    if (/<style[\s>]/i.test(doc)) problems.push(`${f}: <style> inline`);
    if (/\sstyle="/i.test(doc)) problems.push(`${f}: atributo style=`);
    if (/\son[a-z]+="/i.test(doc)) problems.push(`${f}: handler on*= inline`);
    if (/<(form|iframe|object|embed)[\s>]/i.test(doc)) problems.push(`${f}: form/iframe/object/embed`);
    if (/http-equiv="refresh"/i.test(doc)) problems.push(`${f}: meta refresh`);
    for (const r of externalResources(doc, { flagData: true })) problems.push(`${f}: recurso externo: ${r}`);
    const anchors = doc.match(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/gi) || [];
    anchorsTotal += anchors.length;
    for (const a of anchors){
      const host = a.match(/href="https?:\/\/([^/"]+)/i)[1];
      if (!ALLOWED_LINK_HOSTS.includes(host)) problems.push(`${f}: ligação para host não autorizado: ${host}`);
      if (/target="_blank"/i.test(a) && !/rel="[^"]*noopener/i.test(a)) problems.push(`${f}: target=_blank sem noopener: ${host}`);
    }
    // recursos e páginas locais referenciados existem (páginas ligam-se sem .html: o Pages
    // redirecciona /pagina.html para /pagina e serve pagina.html)
    for (const m of doc.matchAll(/\b(?:src|href)="(\/?(?:assets|fonts|vendor)\/[^"#?]+|\/?[a-z0-9-]+(?:\.(?:css|js|webmanifest))?)"/gi)){
      const target = m[1].replace(/^\//, '');
      const candidates = extname(target) ? [target] : [target + '.html'];
      if (!candidates.some(c => existsSync(rel('public/' + c)))) problems.push(`${f}: referência sem ficheiro: ${m[1]}`);
    }
    if (/href="[a-z0-9-]+\.html"/i.test(doc)) problems.push(`${f}: ligação com .html (usar o URL limpo, como o Pages)`);
  }
  if (problems.length) fail(problems.join('; '));
  return `${pages.length} páginas, ${anchorsTotal} ligações externas, todas para hosts autorizados`;
});

check('CSP: <meta> e _headers com a mesma política (mais frame-ancestors no cabeçalho)', () => {
  const meta = (html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || fail('index.html sem CSP');
  const line = headersTxt.split(/\r?\n/).find(l => /^\s*Content-Security-Policy:/i.test(l)) || fail('_headers sem Content-Security-Policy');
  const norm = s => s.split(';').map(d => d.trim().replace(/\s+/g, ' ')).filter(Boolean).sort();
  const m = norm(meta), h = norm(line.replace(/^\s*Content-Security-Policy:\s*/i, ''));
  if (!h.includes("frame-ancestors 'none'")) fail("cabeçalho sem frame-ancestors 'none'");
  const hh = h.filter(d => !d.startsWith('frame-ancestors'));
  if (JSON.stringify(m) !== JSON.stringify(hh)) fail(`diferem: meta=[${m.join('; ')}] cabeçalho=[${hh.join('; ')}]`);
  for (const must of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'"]) if (!m.includes(must)) fail(`falta ${must}`);
  if (/unsafe-inline|unsafe-eval|https?:|\*/.test(meta)) fail('política contém unsafe-*, URLs ou wildcards');
  // as outras páginas têm a sua própria <meta>: sem script-src (scripts impossíveis) e sem ligações
  for (const f of pages.filter(p => p !== 'public/index.html')){
    const p = (read(f).match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || fail(`${f} sem CSP`);
    for (const must of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'"]) if (!p.includes(must)) fail(`${f}: falta ${must}`);
    if (/script-src|unsafe-|https?:|\*/.test(p)) fail(`${f}: a CSP não pode permitir scripts, unsafe-* ou URLs`);
  }
  return `${m.length} directivas; ${pages.length} páginas com CSP`;
});

check('_headers: HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP e CORP', () => {
  const get = n => (headersTxt.match(new RegExp(`^\\s*${n}:\\s*(.+)$`, 'mi')) || [])[1]?.trim();
  const hsts = get('Strict-Transport-Security') || fail('sem HSTS');
  if (!(+(hsts.match(/max-age=(\d+)/) || [])[1] >= 31536000) || !/includeSubDomains/i.test(hsts)) fail(`HSTS fraco: ${hsts}`);
  if (get('X-Content-Type-Options') !== 'nosniff') fail('X-Content-Type-Options != nosniff');
  if (get('X-Frame-Options') !== 'DENY') fail('X-Frame-Options != DENY');
  if (get('Referrer-Policy') !== 'no-referrer') fail('Referrer-Policy != no-referrer');
  if (!get('Permissions-Policy')) fail('sem Permissions-Policy');
  if (get('Cross-Origin-Opener-Policy') !== 'same-origin') fail('COOP != same-origin');
  if (get('Cross-Origin-Resource-Policy') !== 'same-origin') fail('CORP != same-origin');
  const vendorRule = headersTxt.match(/^\/vendor\/\*\s*\r?\n\s*Cache-Control:\s*(.+)$/m);
  if (!vendorRule || !/immutable/.test(vendorRule[1])) fail('sem regra /vendor/* com Cache-Control immutable');
});

check('_headers: HTML com Cache-Control no-transform e max-age=0; Cache-Control definido por uma só regra por caminho', () => {
  // semântica do Pages, verificada num preview: todas as regras que casam aplicam-se e, se mais
  // de uma definir o mesmo cabeçalho, os valores são JUNTOS (não há "última prevalece")
  const rules = []; let cur = null;
  for (const raw of headersTxt.split(/\r?\n/)){
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)){ cur = { pattern: raw.trim(), headers: {} }; rules.push(cur); continue; }
    const i = raw.indexOf(':'); if (cur && i > 0) cur.headers[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
  }
  const re = p => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/:[A-Za-z0-9_]+/g, '[^/]+') + '$');
  const htmlPaths = pages.map(f => f.replace(/^public\//, '/').replace(/\.html$/, '').replace(/^\/index$/, '/'));
  const paths = [...htmlPaths, '/qualquer-caminho', '/app.js', '/style.css', '/fonts/sora.woff2', '/vendor/x/y.mjs'];
  for (const path of paths){
    const matching = rules.filter(r => re(r.pattern).test(path) && r.headers['Cache-Control']);
    if (matching.length > 1) fail(`${path}: Cache-Control definido por ${matching.length} regras (${matching.map(r => r.pattern).join(', ')}); o Pages juntaria os valores`);
    const cc = matching[0]?.headers['Cache-Control'] || '';
    if (htmlPaths.includes(path)){
      if (!/\bno-transform\b/.test(cc)) fail(`${path}: HTML sem no-transform (${cc || 'sem regra'})`);
      if (!/\bmax-age=0\b/.test(cc)) fail(`${path}: HTML deve ter max-age=0 (${cc})`);
    } else if (/\bno-transform\b/.test(cc)) fail(`${path}: no-transform fora do HTML desliga a compressão`);
  }
  return `${rules.length} regras; HTML: ${htmlPaths.join(', ')}`;
});

// ---------- i18n ----------
check('i18n: T.pt e T.en com as mesmas chaves, sem vazios e mesmos marcadores; HTML só usa chaves existentes', () => {
  const start = app.indexOf('const T = {');
  const end = app.indexOf('\n  };', start);
  if (start < 0 || end < 0) fail('dicionário T não encontrado');
  // o dicionário é um literal só com strings; avaliá-lo aqui (Node, sem DOM) dá as chaves exactas
  const T = new Function('return ' + app.slice(start + 'const T = '.length, end + '\n  }'.length))();
  const pt = Object.keys(T.pt), en = Object.keys(T.en);
  const missingEn = pt.filter(k => !(k in T.en)), missingPt = en.filter(k => !(k in T.pt));
  if (missingEn.length || missingPt.length) fail(`faltam em EN: [${missingEn}] faltam em PT: [${missingPt}]`);
  const ph = s => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(',');
  for (const k of pt){
    if (!String(T.pt[k]).trim() || !String(T.en[k]).trim()) fail(`chave vazia: ${k}`);
    if (ph(T.pt[k]) !== ph(T.en[k])) fail(`marcadores diferentes em ${k}: PT ${ph(T.pt[k]) || '-'} vs EN ${ph(T.en[k]) || '-'}`);
  }
  const used = new Set([...html.matchAll(/data-(?:i18n|i18n-ph|name)="([^"]+)"/g)].map(m => m[1]));
  const unknown = [...used].filter(k => !(k in T.pt));
  if (unknown.length) fail(`chaves usadas no HTML sem tradução: ${unknown.join(', ')}`);
  return `${pt.length} chaves, ${used.size} usadas no HTML`;
});

// ---------- ficheiros e versão ----------
check('versão: package.json igual ao rodapé de index.html', () => {
  if (!html.includes(`>v${pkg.version}<`)) fail(`rodapé sem v${pkg.version}`);
  return `v${pkg.version}`;
});

check('ficheiros: 404.html, manifest válido, ícones, fontes e imagens referenciados existem', () => {
  for (const f of ['public/404.html', 'public/_headers', 'public/manifest.webmanifest', 'public/assets/og.jpg']) if (!existsSync(rel(f))) fail(`falta ${f}`);
  const man = JSON.parse(read('public/manifest.webmanifest'));
  for (const ic of man.icons || []) if (!existsSync(rel('public/' + ic.src.replace(/^\//, '')))) fail(`ícone do manifest em falta: ${ic.src}`);
  const refs = [...html.matchAll(/\b(?:src|href)="((?:assets|fonts|vendor)\/[^"]+|style\.css|app\.js|manifest\.webmanifest)"/g)].map(m => m[1]);
  refs.push(...[...read('public/style.css').matchAll(/url\((fonts\/[^)]+)\)/g)].map(m => m[1]));
  for (const r of refs) if (!existsSync(rel('public/' + r))) fail(`referência sem ficheiro: ${r}`);
  return `${refs.length} referências verificadas`;
});

// ---------- build ----------
check('build: dist/filigrana.html gera sem erros e mantém as garantias', () => {
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, stdio: 'pipe' });
  const dist = read('dist/filigrana.html');
  const modules = (dist.match(/<script type="module">/g) || []).length;
  if (modules !== 2) fail(`esperava 2 módulos inline (pdf.js e app.js), há ${modules}`);
  if (!dist.includes('type="text/js-worker"')) fail('dist sem o worker embutido');
  if (dist.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '').includes('vendor/')) fail('dist refere vendor/ fora de comentários');
  const csp = (dist.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || fail('dist sem CSP');
  if (!/connect-src 'none'/.test(csp) || /unsafe-|'self'|https?:/.test(csp)) fail(`CSP do dist inesperada: ${csp.slice(0, 80)}…`);
  const ext = externalResources(dist);
  if (ext.length) fail(`dist referencia recursos externos: ${ext.join(', ')}`);
  return `${(dist.length / 1048576).toFixed(2)} MB`;
});

// ---------- segredos e dados pessoais ----------
check('repositório: sem tokens, chaves privadas, e-mails pessoais ou caminhos locais', () => {
  let files;
  try { files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean); }
  catch { fail('git ls-files falhou'); }
  const TEXT = new Set(['', '.js', '.mjs', '.json', '.md', '.html', '.css', '.yml', '.yaml', '.txt', '.webmanifest', '.svg']);
  const PATTERNS = [
    [/ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}/, 'token GitHub'],
    [/sk-[A-Za-z0-9_-]{20,}/, 'chave de API (sk-…)'],
    [/AKIA[0-9A-Z]{16}/, 'chave AWS'],
    [/AIza[0-9A-Za-z_-]{35}/, 'chave Google'],
    [/xox[abprs]-[A-Za-z0-9-]{10,}/, 'token Slack'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada'],
    [/[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo|icloud|proton)\.[a-z.]+/i, 'e-mail pessoal'],
    [/[A-Za-z]:\\Users\\|\/home\/[a-z]+\/|\/Users\/[A-Za-z]+\//, 'caminho local'],
  ];
  const hits = [];
  for (const f of files){
    if (f.startsWith('public/vendor/') || f.startsWith('public/fonts/') || !TEXT.has(extname(f).toLowerCase())) continue;
    const txt = read(f);
    for (const [re, what] of PATTERNS) if (re.test(txt)) hits.push(`${f}: ${what}`);
  }
  if (hits.length) fail(hits.join('; '));
  return `${files.length} ficheiros no índice do git`;
});

// ---------- relatório ----------
let failed = 0;
for (const r of results){
  console.log(`${r.ok ? ' OK ' : 'FAIL'}  ${r.name}${r.ok && r.note ? `  (${r.note})` : ''}`);
  if (!r.ok){ failed++; console.log(`      -> ${r.note}`); }
}
console.log(failed ? `\n${failed} de ${results.length} verificações falharam` : `\n${results.length} verificações passaram`);
process.exitCode = failed ? 1 : 0;
