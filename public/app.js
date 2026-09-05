// Marca d'Água — Aurora Borealis · app.js
// Processamento 100% local: nenhum byte do documento sai do navegador.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const show = (el, on) => { el.hidden = !on; };
  const MAX_SIDE = 4000;   // limite seguro p/ canvas em browsers móveis
  const MAX_PAGES = 30;    // limite de páginas PDF
  const PREFS_KEY = 'marca-dagua-prefs';
  const SITE = 'https://auroraborealis-ao.com';

  // ---------- i18n ----------
  const T = {
    pt: {
      docTitle: "Marca d'Água — Aurora Borealis",
      eyebrow: 'Ferramenta gratuita',
      tagline: 'Marque as cópias dos seus documentos com o destinatário e a data antes de as partilhar com terceiros.',
      badge: '100% no navegador — nada é enviado · funciona offline',
      panelTitle: "Marca d'água",
      textLabel: 'Texto',
      textPh: 'Ex.: Cópia exclusiva para Banco X — abertura de conta',
      btnDate: '+ data de hoje',
      btnPreset: 'usar exemplo',
      entity: '[entidade]',
      presetTemplate: 'Cópia exclusiva para [entidade] — {date}',
      size: 'Tamanho', opacity: 'Opacidade', rotation: 'Rotação', density: 'Densidade',
      sparse: 'esparsa', dense: 'densa', color: 'Cor',
      colorDark: 'Escuro', colorLight: 'Claro', colorRed: 'Vermelho',
      download: 'Transferir documento marcado',
      reset: 'Escolher outro ficheiro',
      dzTitle: 'Arraste uma imagem ou PDF para aqui',
      dzSub: 'ou clique para escolher · também pode colar (Ctrl+V)',
      dzSmall: 'JPG · PNG · WebP · PDF — o ficheiro nunca sai do seu dispositivo',
      hint: "⬆ Escreva o texto da marca d'água para o ver aplicado.",
      holdCompare: '👁 manter premido: ver original',
      exportsAs: 'exporta como {fmt}',
      exif: 'EXIF removido na exportação',
      resized: 'redimensionada p/ limite do navegador',
      rasterChip: 'rasterizado — marca inseparável',
      pagesChip: '{n} páginas',
      pageLabel: 'Página {i} de {n}',
      loadingPdf: 'A ler o PDF…',
      procPage: 'A preparar página {i}/{n}…',
      exportPage: 'A marcar página {i}/{n}…',
      whyTitle: 'Porquê esta ferramenta',
      whyBody: 'Todos os dias enviamos cópias do BI, do passaporte ou de comprovativos a bancos, operadoras, senhorios e empregadores — e depois perdemos-lhes o rasto. Uma cópia com o destinatário e a data escritos por cima deixa de servir para outra coisa: quem tentar reutilizá-la denuncia-se a si próprio. A Aurora Borealis trabalha com instituições financeiras em Angola e vê de perto o custo do roubo de identidade. Esta ferramenta é a nossa contribuição gratuita para reduzir esse risco — sem nunca ver os seus documentos.',
      footBy: 'Uma ferramenta gratuita da',
      linkPrivacy: 'Privacidade',
      linkSource: 'Código-fonte',
      privacyTitle: 'Privacidade:',
      privacyBody: 'todo o processamento acontece localmente no seu navegador; nenhum ficheiro é enviado para servidor algum. Sem cookies, sem analítica, sem contas. Os metadados da imagem (EXIF, localização, dispositivo) são removidos automaticamente ao exportar. As suas preferências (idioma, ajustes) ficam só neste dispositivo — o texto da marca nunca é guardado.',
      honestTitle: 'Nota honesta:',
      honestBody: "a marca d'água dificulta muito a reutilização indevida e torna fugas rastreáveis — não torna o abuso impossível. Cubra sempre o documento inteiro, incluindo a fotografia.",
      errNotImage: 'Formato não suportado. Use JPG, PNG, WebP ou PDF.',
      errDecode: 'Não foi possível ler esta imagem. HEIC (iPhone) ainda não é suportado fora do Safari — no iPhone partilhe como JPG (Definições › Câmara › Mais Compatível) ou use uma captura de ecrã.',
      errExport: 'Falha ao gerar o ficheiro.',
      errPdfRead: 'Não foi possível ler este PDF.',
      errPdfPassword: 'Este PDF está protegido por palavra-passe — remova a protecção primeiro.',
      errTooMany: 'Esta ferramenta suporta PDFs até 30 páginas.',
      suffix: 'marca-dagua',
      dateLocale: 'pt-PT',
      privacyPath: '/privacidade/',
    },
    en: {
      docTitle: "Marca d'Água — Aurora Borealis",
      eyebrow: 'Free tool',
      tagline: 'Stamp copies of your documents with the recipient and date before sharing them with third parties.',
      badge: '100% in your browser — nothing is uploaded · works offline',
      panelTitle: 'Watermark',
      textLabel: 'Text',
      textPh: 'E.g.: Copy exclusively for Bank X — account opening',
      btnDate: "+ today's date",
      btnPreset: 'use example',
      entity: '[recipient]',
      presetTemplate: 'Copy exclusively for [recipient] — {date}',
      size: 'Size', opacity: 'Opacity', rotation: 'Rotation', density: 'Density',
      sparse: 'sparse', dense: 'dense', color: 'Color',
      colorDark: 'Dark', colorLight: 'Light', colorRed: 'Red',
      download: 'Download watermarked document',
      reset: 'Choose another file',
      dzTitle: 'Drag an image or PDF here',
      dzSub: 'or click to choose · you can also paste (Ctrl+V)',
      dzSmall: 'JPG · PNG · WebP · PDF — the file never leaves your device',
      hint: '⬆ Type the watermark text to see it applied.',
      holdCompare: '👁 press and hold: see original',
      exportsAs: 'exports as {fmt}',
      exif: 'EXIF removed on export',
      resized: 'resized to browser limit',
      rasterChip: 'rasterised — mark inseparable',
      pagesChip: '{n} pages',
      pageLabel: 'Page {i} of {n}',
      loadingPdf: 'Reading the PDF…',
      procPage: 'Preparing page {i}/{n}…',
      exportPage: 'Marking page {i}/{n}…',
      whyTitle: 'Why this tool',
      whyBody: 'Every day we send copies of our ID, passport or proof documents to banks, telcos, landlords and employers — and then lose track of them. A copy with the recipient and date written across it is useless for anything else: whoever tries to reuse it exposes themselves. Aurora Borealis works with financial institutions in Angola and sees the cost of identity theft up close. This tool is our free contribution to reducing that risk — without ever seeing your documents.',
      footBy: 'A free tool by',
      linkPrivacy: 'Privacy',
      linkSource: 'Source code',
      privacyTitle: 'Privacy:',
      privacyBody: 'all processing happens locally in your browser; no file is ever sent to any server. No cookies, no analytics, no accounts. Image metadata (EXIF, location, device) is removed automatically on export. Your preferences (language, settings) stay on this device only — the watermark text is never stored.',
      honestTitle: 'Honest note:',
      honestBody: 'a watermark makes misuse much harder and leaks traceable — it does not make abuse impossible. Always cover the whole document, including the photo.',
      errNotImage: 'Unsupported format. Use JPG, PNG, WebP or PDF.',
      errDecode: "Couldn't read this image. HEIC (iPhone) isn't supported outside Safari yet — on iPhone share as JPG (Settings › Camera › Most Compatible) or use a screenshot.",
      errExport: 'Failed to generate the file.',
      errPdfRead: "Couldn't read this PDF.",
      errPdfPassword: 'This PDF is password-protected — remove the protection first.',
      errTooMany: 'This tool supports PDFs up to 30 pages.',
      suffix: 'watermarked',
      dateLocale: 'en-GB',
      privacyPath: '/privacy/',
    },
  };

  const canvas = $('preview'), ctx = canvas.getContext('2d');
  const els = {
    text: $('wmText'), size: $('size'), opacity: $('opacity'),
    rotation: $('rotation'), density: $('density'),
  };
  const state = {
    // páginas do documento carregado; imagens são documentos de 1 página
    // {kind:'canvas', canvas, pxW, pxH} | {kind:'jpeg', blob, pxW, pxH, wPts, hPts}
    pages: [],
    pageIdx: 0,
    cache: { idx: -1, bitmap: null },   // página corrente descodificada (kind:'jpeg')
    isPdf: false,
    color: '#1b1b1b',
    srcName: 'documento', srcIsJpeg: true, resized: false,
    lang: 'pt',
  };
  const t = key => T[state.lang][key];
  const fmtN = (s, i, n) => s.replace('{i}', i).replace('{n}', n);

  // ---------- preferências (nunca o texto da marca) ----------
  function savePrefs(){
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        lang: state.lang, color: state.color,
        size: els.size.value, opacity: els.opacity.value,
        rotation: els.rotation.value, density: els.density.value,
      }));
    } catch {}
  }
  function loadPrefs(){
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY));
      if (!p) return null;
      if (p.size) els.size.value = p.size;
      if (p.opacity) els.opacity.value = p.opacity;
      if (p.rotation != null) els.rotation.value = p.rotation;
      if (p.density) els.density.value = p.density;
      if (p.color) selectSwatch(p.color);
      return p.lang || null;
    } catch { return null; }
  }

  // ---------- idioma ----------
  function applyLang(lang){
    state.lang = T[lang] ? lang : 'pt';
    document.documentElement.lang = state.lang;
    document.title = t('docTitle');
    document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
    document.querySelectorAll('[data-i18n-ph]').forEach(el => el.placeholder = t(el.dataset.i18nPh));
    document.querySelectorAll('.swatch').forEach(sw => {
      sw.title = t(sw.dataset.name);
      sw.setAttribute('aria-label', t(sw.dataset.name));
    });
    $('linkPrivacy').href = SITE + t('privacyPath');
    $('langPt').setAttribute('aria-pressed', state.lang === 'pt');
    $('langEn').setAttribute('aria-pressed', state.lang === 'en');
    if (state.pages.length){ updateMeta(); updatePager(); }
  }
  $('langPt').addEventListener('click', () => { applyLang('pt'); savePrefs(); });
  $('langEn').addEventListener('click', () => { applyLang('en'); savePrefs(); });

  // ---------- carregamento ----------
  function invalidateCache(){
    if (state.cache.bitmap && state.cache.bitmap.close) state.cache.bitmap.close();
    state.cache = { idx: -1, bitmap: null };
  }

  async function loadFile(file){
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (isPdf) return loadPdf(file);
    if (!file.type.startsWith('image/')) return toast(t('errNotImage'));

    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      img.src = url;
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      return toast(t('errDecode'));
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const base = document.createElement('canvas');
    base.width = w; base.height = h;
    base.getContext('2d').drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);

    invalidateCache();
    state.pages = [{ kind: 'canvas', canvas: base, pxW: w, pxH: h }];
    state.pageIdx = 0;
    state.isPdf = false;
    state.resized = scale < 1;
    state.srcName = (file.name || 'imagem').replace(/\.[^.]+$/, '');
    state.srcIsJpeg = /jpe?g/i.test(file.type);
    showDoc();
  }

  async function loadPdf(file){
    if (!window.pdfjsLib) return toast(t('errPdfRead'));
    setBusy(t('loadingPdf'));
    try {
      const data = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data }).promise;
      const n = doc.numPages;
      if (n > MAX_PAGES){ doc.destroy(); return toast(t('errTooMany')); }
      const pages = [];
      for (let i = 1; i <= n; i++){
        setBusy(fmtN(t('procPage'), i, n));
        const pg = await doc.getPage(i);
        const vp1 = pg.getViewport({ scale: 1 });
        const scale = Math.min(2, MAX_SIDE / Math.max(vp1.width, vp1.height));
        const vp = pg.getViewport({ scale });
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const cx = c.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); // páginas podem ser transparentes
        await pg.render({ canvasContext: cx, viewport: vp }).promise;
        const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
        pages.push({
          kind: 'jpeg', blob, pxW: c.width, pxH: c.height,
          wPts: +vp1.width.toFixed(2), hPts: +vp1.height.toFixed(2),
        });
        c.width = 0;
        pg.cleanup();
      }
      doc.destroy();
      invalidateCache();
      state.pages = pages;
      state.pageIdx = 0;
      state.isPdf = true;
      state.resized = false;
      state.srcName = (file.name || 'documento').replace(/\.[^.]+$/, '');
      showDoc();
    } catch (e){
      toast(e && e.name === 'PasswordException' ? t('errPdfPassword') : t('errPdfRead'));
    } finally {
      setBusy(null);
    }
  }

  function showDoc(){
    show($('dropzone'), false);
    show($('canvasBox'), true);
    show($('meta'), true);
    $('btnDownload').disabled = false;
    updateMeta();
    updatePager();
    render();
  }

  function updateMeta(){
    if (!state.pages.length) return;
    const p = state.pages[state.pageIdx];
    $('metaDims').textContent = `${p.pxW} × ${p.pxH}px`;
    $('metaFmt').textContent = t('exportsAs').replace('{fmt}', state.isPdf ? 'PDF' : (state.srcIsJpeg ? 'JPG' : 'PNG'));
    $('metaPages').textContent = t('pagesChip').replace('{n}', state.pages.length);
    show($('metaPages'), state.pages.length > 1);
    show($('metaRaster'), state.isPdf);
    show($('metaResized'), state.resized);
  }

  function updatePager(){
    const n = state.pages.length;
    show($('pager'), n > 1);
    if (n > 1){
      $('pageLabel').textContent = fmtN(t('pageLabel'), state.pageIdx + 1, n);
      $('btnPrev').disabled = state.pageIdx === 0;
      $('btnNext').disabled = state.pageIdx === n - 1;
    }
  }
  $('btnPrev').addEventListener('click', () => gotoPage(state.pageIdx - 1));
  $('btnNext').addEventListener('click', () => gotoPage(state.pageIdx + 1));
  function gotoPage(i){
    if (i < 0 || i >= state.pages.length) return;
    state.pageIdx = i;
    updatePager(); updateMeta();
    render();
  }

  // ---------- render ----------
  let raf = 0, renderToken = 0;
  const scheduleRender = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => render()); };

  function currentBitmapSync(){
    const p = state.pages[state.pageIdx];
    if (!p) return null;
    if (p.kind === 'canvas') return p.canvas;
    return state.cache.idx === state.pageIdx ? state.cache.bitmap : null;
  }

  async function render(){
    if (!state.pages.length) return;
    const tok = ++renderToken;
    const p = state.pages[state.pageIdx];
    let bmp = currentBitmapSync();
    if (!bmp){
      const decoded = await createImageBitmap(p.blob);
      if (tok !== renderToken){ decoded.close(); return; }
      invalidateCache();
      state.cache = { idx: state.pageIdx, bitmap: decoded };
      bmp = decoded;
    }
    if (tok !== renderToken) return;
    const w = p.pxW, h = p.pxH;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0);

    const text = els.text.value.trim();
    show($('hintText'), !text);
    if (!text) return;
    drawWatermark(ctx, w, h, text);
  }

  function drawWatermark(g, w, h, text){
    const fontPx = Math.max(10, w * (+els.size.value) / 100);
    g.font = `bold ${fontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    g.textBaseline = 'middle';
    g.fillStyle = state.color;
    g.globalAlpha = (+els.opacity.value) / 100;

    const textW = g.measureText(text).width;
    const k = 11 - (+els.density.value); // slider mais alto = mais denso
    const stepX = textW + fontPx * (0.8 + k * 0.35);
    const stepY = fontPx * (1.5 + k * 0.45);
    const angle = (+els.rotation.value) * Math.PI / 180;
    const diag = Math.hypot(w, h);

    g.translate(w / 2, h / 2);
    g.rotate(angle);
    let row = 0;
    for (let y = -diag / 2; y <= diag / 2; y += stepY, row++){
      const stagger = (row % 2) * stepX / 2;
      for (let x = -diag / 2 - stagger; x <= diag / 2; x += stepX){
        g.fillText(text, x, y);
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
  }

  // ---------- comparação (manter premido) ----------
  function showOriginal(){
    const bmp = currentBitmapSync();
    if (!bmp) return;
    renderToken++; // cancela renders assíncronos pendentes
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(bmp, 0, 0);
  }
  const cmp = $('btnCompare');
  cmp.addEventListener('pointerdown', e => { e.preventDefault(); showOriginal(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => cmp.addEventListener(ev, () => render()));
  cmp.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- escrita de PDF (mínima, feita à mão: 1 JPEG por página) ----------
  function buildPdf(pages){
    const enc = new TextEncoder();
    const chunks = [];
    let offset = 0;
    const offsets = [];
    const push = d => { const u8 = typeof d === 'string' ? enc.encode(d) : d; chunks.push(u8); offset += u8.length; };
    const beginObj = num => { offsets[num] = offset; push(`${num} 0 obj\n`); };
    const pageObj = i => 3 + i * 3, imgObj = i => 4 + i * 3, contObj = i => 5 + i * 3;
    const total = 2 + pages.length * 3;

    push('%PDF-1.4\n');
    push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A])); // marcador binário
    beginObj(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    beginObj(2);
    push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`);
    pages.forEach((p, i) => {
      beginObj(pageObj(i));
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.wPts} ${p.hPts}] ` +
           `/Resources << /XObject << /Im0 ${imgObj(i)} 0 R >> >> /Contents ${contObj(i)} 0 R >>\nendobj\n`);
      beginObj(imgObj(i));
      push(`<< /Type /XObject /Subtype /Image /Width ${p.pxW} /Height ${p.pxH} ` +
           `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg);
      push('\nendstream\nendobj\n');
      const content = `q ${p.wPts} 0 0 ${p.hPts} 0 0 cm /Im0 Do Q`;
      beginObj(contObj(i));
      push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    });
    const xrefStart = offset;
    let xref = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
    for (let j = 1; j <= total; j++) xref += String(offsets[j]).padStart(10, '0') + ' 00000 n \n';
    push(xref);
    push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  // ---------- exportação ----------
  function saveBlob(blob, filename){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function download(){
    if (!state.pages.length) return;
    if (!state.isPdf){
      const type = state.srcIsJpeg ? 'image/jpeg' : 'image/png';
      canvas.toBlob(blob => {
        if (!blob) return toast(t('errExport'));
        saveBlob(blob, `${state.srcName}_${t('suffix')}.${state.srcIsJpeg ? 'jpg' : 'png'}`);
      }, type, 0.92);
      return;
    }
    const btn = $('btnDownload');
    btn.disabled = true;
    try {
      const text = els.text.value.trim();
      const out = [];
      for (let i = 0; i < state.pages.length; i++){
        setBusy(fmtN(t('exportPage'), i + 1, state.pages.length));
        const p = state.pages[i];
        const bmp = await createImageBitmap(p.blob);
        const c = document.createElement('canvas');
        c.width = p.pxW; c.height = p.pxH;
        const cx = c.getContext('2d');
        cx.drawImage(bmp, 0, 0);
        bmp.close();
        if (text) drawWatermark(cx, p.pxW, p.pxH, text);
        const jblob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
        out.push({
          jpeg: new Uint8Array(await jblob.arrayBuffer()),
          pxW: p.pxW, pxH: p.pxH, wPts: p.wPts, hPts: p.hPts,
        });
        c.width = 0;
      }
      saveBlob(buildPdf(out), `${state.srcName}_${t('suffix')}.pdf`);
    } catch {
      toast(t('errExport'));
    } finally {
      setBusy(null);
      btn.disabled = false;
    }
  }

  // ---------- entrada de ficheiros ----------
  const dz = $('dropzone'), fi = $('fileInput');
  dz.addEventListener('click', () => fi.click());
  fi.addEventListener('change', () => { loadFile(fi.files[0]); fi.value = ''; });

  ['dragover', 'dragenter'].forEach(ev => document.addEventListener(ev, e => {
    e.preventDefault(); document.body.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => {
    e.preventDefault(); document.body.classList.remove('dragging');
  }));
  document.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
  window.addEventListener('paste', e => {
    const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (f) loadFile(f);
  });

  // ---------- controlos ----------
  const outputs = () => {
    $('sizeOut').textContent = els.size.value + '%';
    $('opacityOut').textContent = els.opacity.value + '%';
    $('rotationOut').textContent = els.rotation.value + '°';
  };
  Object.values(els).forEach(el => el.addEventListener('input', () => {
    outputs(); scheduleRender();
    if (el !== els.text) savePrefs();
  }));

  function selectSwatch(color){
    const sw = [...document.querySelectorAll('.swatch')].find(s => s.dataset.color === color);
    if (!sw) return;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
    sw.classList.add('sel');
    state.color = color;
  }
  $('swatches').addEventListener('click', e => {
    const sw = e.target.closest('.swatch');
    if (!sw) return;
    selectSwatch(sw.dataset.color);
    scheduleRender(); savePrefs();
  });
  $('swatches').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const sw = e.target.closest('.swatch');
    if (!sw) return;
    e.preventDefault();
    selectSwatch(sw.dataset.color);
    scheduleRender(); savePrefs();
  });

  const today = () => new Date().toLocaleDateString(t('dateLocale'));
  $('btnDate').addEventListener('click', () => {
    els.text.value = (els.text.value.trim() ? els.text.value.trim() + ' — ' : '') + today();
    scheduleRender(); els.text.focus();
  });
  $('btnPreset').addEventListener('click', () => {
    els.text.value = t('presetTemplate').replace('{date}', today());
    scheduleRender();
    els.text.focus();
    const i = els.text.value.indexOf(t('entity'));
    if (i >= 0) els.text.setSelectionRange(i, i + t('entity').length);
  });

  $('btnDownload').addEventListener('click', download);
  $('btnReset').addEventListener('click', () => fi.click());

  // ---------- avisos ----------
  let toastTimer = 0;
  function toast(msg){
    const tEl = $('toast');
    tEl.textContent = msg;
    show(tEl, true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => show(tEl, false), 5000);
  }
  function setBusy(msg){
    const b = $('busy');
    b.textContent = msg || '';
    show(b, !!msg);
  }

  // ---------- worker do pdf.js (JS same-origin, sem rede) ----------
  if (window.pdfjsLib){
    const embed = document.getElementById('pdfjs-worker-inline'); // presente só no ficheiro único
    pdfjsLib.GlobalWorkerOptions.workerSrc = embed
      ? URL.createObjectURL(new Blob([embed.textContent], { type: 'text/javascript' }))
      : 'vendor/pdf.worker.min.js';
  }

  // ---------- arranque ----------
  const savedLang = loadPrefs();
  applyLang(savedLang || ((navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en'));
  outputs();
})();
