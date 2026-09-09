// Servidor estático de desenvolvimento — sem dependências, só Node.
//
// Serve public/ na raiz (como em produção) e expõe também public/, tools/, press/ e dist/
// pelos seus nomes, para que as páginas em tools/ continuem a usar caminhos relativos
// (../public/fonts/…, ../press/…). Às respostas vindas de public/ aplica os cabeçalhos de
// public/_headers, para que a CSP por cabeçalho se comporte localmente como no Cloudflare Pages.
// Caminhos desconhecidos respondem 404 com public/404.html, como em produção.
//
// Uso: npm run dev            → http://127.0.0.1:8768/
//      node tools/serve.mjs --port 8080 --host 0.0.0.0
//      --cache   imita o Cache-Control do Cloudflare Pages (HTML sem cache, restantes ficheiros
//                4 h) em vez de "no-store"; usado pelos testes para reproduzir o modo avião
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };
const PORT = Number(opt('--port', process.env.PORT || 8768));
const HOST = opt('--host', '127.0.0.1');
const CACHE = args.includes('--cache');

// ordem importa: o prefixo mais específico primeiro, a raiz por último
const MOUNTS = [['/public/', 'public'], ['/tools/', 'tools'], ['/press/', 'press'], ['/dist/', 'dist'], ['/', 'public']];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

// public/_headers no formato do Cloudflare Pages: uma linha "/padrão" seguida de linhas "  Nome: valor"
async function loadHeaderRules(){
  try {
    const rules = []; let cur = null;
    for (const raw of (await readFile(join(ROOT, 'public', '_headers'), 'utf8')).split(/\r?\n/)){
      if (!raw.trim() || raw.trim().startsWith('#')) continue;
      if (!/^\s/.test(raw)){ cur = { pattern: raw.trim(), headers: [] }; rules.push(cur); continue; }
      const i = raw.indexOf(':');
      if (cur && i > 0) cur.headers.push([raw.slice(0, i).trim(), raw.slice(i + 1).trim()]);
    }
    return rules;
  } catch { return []; }
}
const patternToRegExp = p => new RegExp('^' +
  p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/:[A-Za-z0-9_]+/g, '[^/]+') + '$');
const RULES = (await loadHeaderRules()).map(r => ({ re: patternToRegExp(r.pattern), headers: r.headers }));

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
};

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const [prefix, dir] = MOUNTS.find(([p]) => path.startsWith(p));
    let rel = path.slice(prefix.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const base = join(ROOT, dir);
    // como o Cloudflare Pages: /pagina.html redirecciona para /pagina, e /pagina serve pagina.html
    if (dir === 'public' && /\.html$/.test(rel) && rel !== 'index.html'){
      res.writeHead(308, { Location: path.replace(/\.html$/, '') }); return res.end();
    }
    let file = resolve(base, rel);
    if (file !== base && !file.startsWith(base + sep)) return send(res, 403, 'Forbidden');
    if (dir === 'public' && !extname(file) && !(await stat(file).catch(() => null)) && await stat(file + '.html').catch(() => null)) file += '.html';

    const st = await stat(file).catch(() => null);
    if (st?.isDirectory()){ res.writeHead(301, { Location: path + '/' }); return res.end(); }
    if (!st){
      const nf = await readFile(join(ROOT, 'public', '404.html')).catch(() => null);
      return send(res, 404, nf || 'Not found', nf ? { 'Content-Type': MIME['.html'] } : {});
    }

    const body = await readFile(file);
    const headers = { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': body.length };
    // como o Pages: todas as regras que casam aplicam-se e um cabeçalho repetido tem os valores juntos
    if (dir === 'public') for (const r of RULES) if (r.re.test(path)) for (const [k, v] of r.headers) headers[k] = headers[k] ? `${headers[k]}, ${v}` : v;
    // em desenvolvimento nunca queremos ficheiros em cache; com --cache, o mesmo que a produção
    // (uma regra de _headers com Cache-Control próprio, como /vendor/*, prevalece)
    if (!CACHE) headers['Cache-Control'] = 'no-store';
    else if (!headers['Cache-Control']) headers['Cache-Control'] = extname(file) === '.html' ? 'public, max-age=0, must-revalidate' : 'public, max-age=14400, must-revalidate';
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e){
    send(res, 500, String(e));
  }
}).listen(PORT, HOST, () => {
  // só ASCII no terminal: consolas Windows sem UTF-8 estragam acentos e setas
  console.log(`Filigrana dev: http://${HOST}:${PORT}/  (mounts: /tools/ /press/ /dist/ /public/)`);
  console.log(`_headers: ${RULES.length} rule(s) applied to responses from public/; cache: ${CACHE ? 'like production' : 'no-store'}`);
});
