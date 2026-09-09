// Testes de navegador do Filigrana. Cada teste regista todos os pedidos de rede e erros de
// consola; no fim, nenhum pedido pode ter saído do site, nenhum pode ser diferente de GET e não
// pode haver erros. É a versão automática da secção "Como verificar" do README.
import { test as base, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { makeSpecimenJpeg, makePdf, hasExif, jpegSize, pdfInfo, readDownload, canvasDigest } from './helpers.mjs';

const MARK = 'Cópia exclusiva para Banco Teste — 08-09-2026';
const DIST = fileURLToPath(new URL('../dist/filigrana.html', import.meta.url));

const test = base.extend({
  audit: [async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL).origin;
    const requests = [], errors = [], allowedConsole = [];
    page.on('request', r => requests.push({ url: r.url(), method: r.method() }));
    page.on('websocket', ws => errors.push('websocket aberto: ' + ws.url()));
    page.on('console', m => { if (m.type() === 'error') errors.push('consola: ' + m.text()); });
    page.on('pageerror', e => errors.push('erro de página: ' + e.message));
    await use({ requests, errors, allowedConsole, origin });
    const foreign = requests.filter(r => !r.url.startsWith(origin + '/') && !r.url.startsWith('blob:') && !r.url.startsWith('file:'));
    expect(foreign, 'pedidos para fora do site').toEqual([]);
    expect(requests.filter(r => r.method !== 'GET'), 'pedidos que não são GET').toEqual([]);
    expect(errors.filter(e => !allowedConsole.some(re => re.test(e))), 'erros de consola ou de página').toEqual([]);
  }, { auto: true }],
});

const expectedLang = page => page.evaluate(() => (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en');
const suffixFor = lang => lang === 'pt' ? 'marca-de-agua' : 'watermarked';

async function loadFile(page, file){
  await page.fill('#wmText', ''); // o texto da marca persiste entre ficheiros; cada carga começa sem marca
  await page.setInputFiles('#fileInput', file);
  await expect(page.locator('#canvasBox')).toBeVisible();
  await expect(page.locator('#busy')).toBeHidden();
}

async function applyMark(page){
  const before = await canvasDigest(page);
  await page.fill('#wmText', MARK);
  await expect.poll(() => canvasDigest(page), 'a pré-visualização devia mudar ao escrever a marca').not.toBe(before);
  return before;
}

async function exportFile(page){
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnDownload')]);
  return { download, buffer: await readDownload(download) };
}

test('página inicial: idioma pelo navegador, cabeçalhos de segurança, sem transbordo horizontal', async ({ page }) => {
  const resp = await page.goto('/');
  const h = resp.headers();
  expect(h['content-security-policy']).toContain("connect-src 'none'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['strict-transport-security']).toContain('max-age=31536000');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['cache-control'], 'no-transform: a rede de entrega não pode alterar a página').toContain('no-transform');
  const lang = await expectedLang(page);
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page.locator('h1')).toContainText(lang === 'pt' ? 'Marque a cópia' : 'Stamp the copy');
  await expect(page.locator('#dropzone')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('imagem: marca aplicada, comparação com o original, JPG exportado sem EXIF; pdf.js nunca é descarregado', async ({ page, audit }) => {
  await page.goto('/');
  const jpeg = await makeSpecimenJpeg(page);
  expect(hasExif(jpeg), 'o ficheiro de teste tem EXIF de propósito').toBe(true);
  await loadFile(page, { name: 'especime-testelandia.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  await expect(page.locator('#metaDims')).toHaveText('1200 × 760px');
  await expect(page.locator('#hintText')).toBeVisible();

  const original = await applyMark(page);
  const marked = await canvasDigest(page);
  await expect(page.locator('#hintText')).toBeHidden();

  // manter premido mostra o original; largar volta à marca
  await page.dispatchEvent('#btnCompare', 'pointerdown');
  await expect.poll(() => canvasDigest(page)).toBe(original);
  await page.dispatchEvent('#btnCompare', 'pointerup');
  await expect.poll(() => canvasDigest(page)).toBe(marked);

  const lang = await expectedLang(page);
  const { download, buffer } = await exportFile(page);
  expect(download.suggestedFilename()).toBe(`especime-testelandia_${suffixFor(lang)}.jpg`);
  expect([buffer[0], buffer[1]]).toEqual([0xFF, 0xD8]);
  expect(jpegSize(buffer)).toEqual({ width: 1200, height: 760 });
  expect(hasExif(buffer), 'a exportação remove o EXIF').toBe(false);
  expect(buffer.equals(jpeg)).toBe(false);
  expect(audit.requests.filter(r => r.url.includes('/vendor/')), 'só imagens: a biblioteca de PDF não é pedida').toEqual([]);
});

test('PDF: duas páginas, marca em cada uma, exportação rasterizada com as dimensões originais', async ({ page, audit }) => {
  await page.goto('/');
  const pdf = makePdf([{ w: 595, h: 842, text: 'FILIGRANA TESTE - pagina 1' }, { w: 842, h: 595, text: 'pagina 2 em paisagem' }]);
  await loadFile(page, { name: 'teste-2pag.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.locator('#pager')).toBeVisible();
  await expect(page.locator('#pageLabel')).toHaveText(/Página 1 de 2|Page 1 of 2/);
  await expect(page.locator('#metaRaster')).toBeVisible();
  await expect(page.locator('#metaDims')).toHaveText('1190 × 1684px'); // 2x da página A4

  await applyMark(page);
  await page.click('#btnNext');
  await expect(page.locator('#pageLabel')).toHaveText(/Página 2 de 2|Page 2 of 2/);
  await expect(page.locator('#metaDims')).toHaveText('1684 × 1190px');

  const lang = await expectedLang(page);
  const { download, buffer } = await exportFile(page);
  expect(download.suggestedFilename()).toBe(`teste-2pag_${suffixFor(lang)}.pdf`);
  const info = pdfInfo(buffer);
  expect(info.header).toBe('%PDF-1.4');
  expect(info.pages).toBe(2);
  expect(info.mediaBoxes).toEqual(['0 0 595 842', '0 0 842 595']);
  expect(info.dct, 'cada página é uma imagem JPEG').toBe(true);
  expect(info.hasTextOps, 'sem texto nem fontes: a marca está nos píxeis').toBe(false);
  expect(buffer.length).toBeGreaterThan(20_000);
  const vendor = audit.requests.map(r => new URL(r.url).pathname).filter(p => p.includes('/vendor/'));
  expect(vendor.sort(), 'o primeiro PDF pede a biblioteca e o worker, mais nada').toEqual(['/vendor/pdfjs-6.3.289/pdf.min.mjs', '/vendor/pdfjs-6.3.289/pdf.worker.min.mjs']);
});

test('modo avião: depois do primeiro PDF, o site continua a funcionar sem rede', async ({ page, context }) => {
  await page.goto('/');
  await loadFile(page, { name: 'um.pdf', mimeType: 'application/pdf', buffer: makePdf([{ w: 400, h: 500, text: 'um' }]) });
  await context.setOffline(true);
  // "Escolher outro ficheiro" abre o selector de ficheiros do sistema
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btnReset')]);
  await page.fill('#wmText', '');
  await chooser.setFiles({ name: 'dois.pdf', mimeType: 'application/pdf', buffer: makePdf([{ w: 500, h: 400, text: 'dois' }, { w: 300, h: 300, text: 'tres' }]) });
  await expect(page.locator('#pageLabel')).toHaveText(/1 de 2|1 of 2/);
  await expect(page.locator('#busy')).toBeHidden();
  await applyMark(page);
  const { buffer } = await exportFile(page);
  expect(pdfInfo(buffer).pages).toBe(2);
  await context.setOffline(false);
});

test('ficheiro único (dist): um só pedido, depois tudo funciona sem rede, imagem e PDF', async ({ page, context, audit }) => {
  await page.goto('/dist/filigrana.html');
  await expect(page.locator('#dropzone')).toBeVisible();
  await context.setOffline(true);
  await loadFile(page, { name: 'especime.jpg', mimeType: 'image/jpeg', buffer: await makeSpecimenJpeg(page, { width: 900, height: 600 }) });
  await applyMark(page);
  const img = await exportFile(page);
  expect(jpegSize(img.buffer)).toEqual({ width: 900, height: 600 });
  await loadFile(page, { name: 'teste.pdf', mimeType: 'application/pdf', buffer: makePdf([{ w: 595, h: 842, text: 'dist' }]) });
  await applyMark(page);
  const pdf = await exportFile(page);
  expect(pdfInfo(pdf.buffer).pages).toBe(1);
  await context.setOffline(false);
  const sameOrigin = audit.requests.filter(r => r.url.startsWith(audit.origin + '/')).map(r => new URL(r.url).pathname);
  expect(sameOrigin, 'o ficheiro único não pede mais nada ao servidor').toEqual(['/dist/filigrana.html']);
});

test('ficheiro único aberto do disco (file://): imagem e PDF funcionam', async ({ page }) => {
  await page.goto('file:///' + DIST.replace(/\\/g, '/').replace(/^\//, ''));
  await expect(page.locator('#dropzone')).toBeVisible();
  await loadFile(page, { name: 'especime.jpg', mimeType: 'image/jpeg', buffer: await makeSpecimenJpeg(page, { width: 640, height: 400 }) });
  await applyMark(page);
  await loadFile(page, { name: 'teste.pdf', mimeType: 'application/pdf', buffer: makePdf([{ w: 300, h: 400, text: 'ficheiro' }, { w: 400, h: 300, text: 'local' }]) });
  await expect(page.locator('#pageLabel')).toHaveText(/1 de 2|1 of 2/);
  await applyMark(page);
  const { buffer } = await exportFile(page);
  expect(pdfInfo(buffer).pages).toBe(2);
});

test('CSP: o navegador recusa fetch, sendBeacon e WebSocket, mesmo que o código os tentasse', async ({ page, audit }) => {
  audit.allowedConsole.push(/Content Security Policy|Refused to connect|violates/i);
  await page.goto('/');
  // O navegador emite um evento securitypolicyviolation por cada tentativa bloqueada; o valor
  // devolvido por sendBeacon não é fiável (o Chromium devolve true e bloqueia depois), por isso
  // o que conta é a violação registada e, no fim, a ausência de qualquer pedido para fora (audit).
  const r = await page.evaluate(async () => {
    const violations = [];
    document.addEventListener('securitypolicyviolation', e => violations.push(`${e.violatedDirective} ${e.blockedURI}`));
    const out = {};
    out.fetch = await fetch('https://example.com/').then(() => 'permitido', e => 'bloqueado: ' + e.name);
    navigator.sendBeacon('https://example.com/', 'x');
    out.ws = await new Promise(res => {
      try {
        const ws = new WebSocket('wss://example.com/');
        ws.onopen = () => res('permitido');
        ws.onerror = () => res('bloqueado');
        ws.onclose = () => res('bloqueado');
      } catch (e){ res('bloqueado: ' + e.name); }
    });
    await new Promise(r => setTimeout(r, 300));
    out.violations = violations;
    return out;
  });
  expect(r.fetch).toBe('bloqueado: TypeError');
  expect(r.ws).toMatch(/^bloqueado/);
  expect(r.violations.filter(v => v.startsWith('connect-src') && v.includes('example.com')).length, 'fetch, sendBeacon e WebSocket geram violações de connect-src').toBeGreaterThanOrEqual(3);
});

test('idioma: alternar, persistir entre recargas; preferências guardadas sem o texto da marca', async ({ page }) => {
  await page.goto('/');
  await page.click('#langEn');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toContainText('Stamp the copy');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.click('#langPt');
  await expect(page.locator('h1')).toContainText('Marque a cópia');

  await page.fill('#wmText', MARK);
  await page.locator('#size').fill('6'); // dispara input → savePrefs
  const prefs = await page.evaluate(() => localStorage.getItem('filigrana-prefs'));
  expect(prefs).not.toBeNull();
  expect(Object.keys(JSON.parse(prefs)).sort()).toEqual(['color', 'density', 'lang', 'opacity', 'rotation', 'size']);
  expect(prefs).not.toContain('Banco Teste');
  expect(await page.evaluate(() => localStorage.length)).toBe(1);
});

test('privacidade: página estática sem scripts, ligada no rodapé, com responsável, subcontratado e contacto', async ({ page }) => {
  await page.goto('/');
  await page.click('a[href="privacidade"]');
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(page).toHaveTitle(/Privacidade/);
  expect(await page.evaluate(() => document.scripts.length), 'a página não tem scripts').toBe(0);
  const doc = page.locator('main.doc');
  await expect(doc).toContainText('Responsável pelo tratamento');
  await expect(doc).toContainText('Cloudflare, Inc.');
  await expect(doc).toContainText('info@auroraborealis-ao.com');
  await expect(doc).toContainText('art. 4.º');
  const resp = await page.request.get('/privacidade');
  expect(resp.status()).toBe(200);
  expect(resp.headers()['content-security-policy']).toContain("connect-src 'none'");
  expect(resp.headers()['cache-control']).toContain('no-transform');
  const old = await page.request.get('/privacidade.html', { maxRedirects: 0 });
  expect(old.status(), 'o URL com .html redirecciona para o limpo, como no Pages').toBe(308);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('404: caminhos desconhecidos respondem 404 com a página própria', async ({ page, audit }) => {
  audit.allowedConsole.push(/404/);
  const resp = await page.goto('/pagina-que-nao-existe');
  expect(resp.status()).toBe(404);
  await expect(page).toHaveTitle(/Página não encontrada/);
  await expect(page.getByRole('link', { name: /Voltar ao Filigrana/ })).toBeVisible();
});
