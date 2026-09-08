// Auxiliares dos testes: geram os ficheiros de teste em código (nunca há documentos reais no
// repositório) e lêem o essencial dos ficheiros exportados.
import { readFileSync } from 'node:fs';

// Cartão "espécime" fictício da Testelândia, desenhado num canvas dentro do navegador e
// codificado em JPEG; recebe depois um segmento EXIF (APP1) para provar que a exportação o remove.
export async function makeSpecimenJpeg(page, { width = 1200, height = 760 } = {}){
  const dataUrl = await page.evaluate(async ({ width, height }) => {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const g = c.getContext('2d');
    g.fillStyle = '#e8eef7'; g.fillRect(0, 0, width, height);
    g.fillStyle = '#1c2235'; g.font = 'bold 44px sans-serif'; g.fillText('REPÚBLICA DE TESTELÂNDIA', 60, 90);
    g.font = '28px sans-serif'; g.fillText('BILHETE DE IDENTIDADE · ESPÉCIME', 60, 140);
    g.fillStyle = '#9aa3bc'; g.fillRect(60, 200, 300, 380); // lugar da "fotografia"
    g.fillStyle = '#1c2235'; g.font = '30px sans-serif';
    ['NOME: MARIA EXEMPLO', 'N.º 000000000TL0', 'VÁLIDO ATÉ 01-01-2030'].forEach((s, i) => g.fillText(s, 420, 260 + i * 70));
    g.fillStyle = '#c62828'; g.font = 'bold 26px sans-serif'; g.fillText('DOCUMENTO FICTÍCIO PARA TESTES', 60, 690);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  }, { width, height });
  return withExif(Buffer.from(dataUrl.split(',')[1], 'base64'));
}

// Insere um APP1 "Exif" mínimo e válido (cabeçalho TIFF little-endian com um IFD vazio) a seguir ao SOI.
export function withExif(jpeg){
  const tiff = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const len = payload.length + 2;
  const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1, len >> 8, len & 0xFF]), payload]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

// Percorre os segmentos JPEG até ao SOS e procura um APP1 Exif.
export function hasExif(jpeg){
  let i = 2;
  while (i + 4 <= jpeg.length && jpeg[i] === 0xFF){
    const marker = jpeg[i + 1];
    if (marker === 0xDA) break;
    if (marker === 0xE1 && jpeg.subarray(i + 4, i + 10).toString('latin1') === 'Exif\0\0') return true;
    i += 2 + jpeg.readUInt16BE(i + 2);
  }
  return false;
}

// Dimensões lidas do SOF (baseline ou progressivo).
export function jpegSize(jpeg){
  let i = 2;
  while (i + 4 <= jpeg.length && jpeg[i] === 0xFF){
    const marker = jpeg[i + 1];
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) return { width: jpeg.readUInt16BE(i + 7), height: jpeg.readUInt16BE(i + 5) };
    i += 2 + jpeg.readUInt16BE(i + 2);
  }
  return null;
}

// PDF mínimo feito à mão: páginas com um rectângulo e texto em Helvetica (fonte base14, não
// embutida). `pages` = [{ w, h, text }] em pontos; o texto tem de ser ASCII sem parênteses.
export function makePdf(pages){
  const objs = [];
  const add = body => { objs.push(body); return objs.length; };
  const catalog = add(null), pagesObj = add(null);
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [];
  for (const p of pages){
    const content = `q 0.85 0.9 1 rg 40 40 ${p.w - 80} ${p.h - 80} re f Q\nBT /F1 28 Tf 60 ${p.h - 100} Td (${p.text}) Tj ET`;
    const cont = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${p.w} ${p.h}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${cont} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// O que interessa saber de um PDF exportado pelo Filigrana.
export function pdfInfo(buf){
  const raw = buf.toString('latin1');
  // os bytes das imagens JPEG são aleatórios e podem conter "BT" por acaso: retiram-se os streams
  // de imagem e analisa-se só a estrutura e os streams de conteúdo
  const txt = raw.replace(/(\/DCTDecode[^>]*>>\s*stream\r?\n)[\s\S]*?(\r?\nendstream)/g, '$1$2');
  return {
    header: txt.slice(0, 8),
    pages: (txt.match(/\/Type\s*\/Page\b(?!s)/g) || []).length,
    mediaBoxes: [...txt.matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map(m => m[1].trim()),
    dct: /\/DCTDecode/.test(txt),
    hasTextOps: /\bBT\b/.test(txt) || /\/Font\b/.test(txt),
  };
}

export async function readDownload(download){
  return readFileSync(await download.path());
}

// Resumo rápido do que está no canvas de pré-visualização (amostra de píxeis), para detectar mudanças.
export const canvasDigest = page => page.evaluate(() => {
  const c = document.getElementById('preview');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0;
  return `${c.width}x${c.height}:${h}`;
});
