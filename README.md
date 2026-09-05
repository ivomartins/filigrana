# Marca d'Água

**Marque as cópias dos seus documentos antes de as partilhar.** Uma ferramenta gratuita da
[Aurora Borealis](https://auroraborealis-ao.com) — 100% no navegador, nada é enviado.

Todos os dias partilhamos cópias do BI, do passaporte ou de comprovativos com bancos, operadoras,
senhorios e empregadores. Uma cópia com o destinatário e a data escritos por cima deixa de servir
para outra coisa — e, se fugir, sabe-se por onde. Esta ferramenta aplica essa marca a imagens
(JPG, PNG, WebP) e a PDFs, sem que o documento saia do dispositivo.

*English: stamp copies of your ID or documents with the recipient and date before sharing them —
free, fully client-side, nothing is uploaded. The UI is bilingual (PT/EN).*

## Garantias de privacidade

- **Nenhum upload.** Todo o processamento é feito com a Canvas API no navegador. A
  [Content-Security-Policy](public/_headers) inclui `connect-src 'none'`: a página é
  tecnicamente incapaz de enviar dados para qualquer lado.
- **Sem terceiros.** Fontes (Sora, JetBrains Mono) e a biblioteca de PDF (pdf.js) são servidas
  do próprio site. Sem CDNs, sem cookies, sem analítica, sem contas.
- **Metadados removidos.** A re-codificação da imagem descarta EXIF (localização, dispositivo).
- **Nada é guardado sobre o documento.** As preferências (idioma, ajustes) ficam em
  `localStorage`; o texto da marca nunca é guardado.
- **PDFs são rasterizados.** Cada página sai como imagem com a marca "cozida" nos píxeis — não é
  uma camada de texto que se apaga num editor. (Contrapartida: o texto deixa de ser seleccionável.)

## Estrutura

```
public/           ← raiz de deploy (Cloudflare Pages)
  index.html      markup + CSP <meta>
  style.css       tokens Aurora + estilos
  app.js          toda a lógica (imagens, PDF, i18n, escrita de PDF mínima)
  _headers        cabeçalhos de segurança para Cloudflare Pages
  manifest.webmanifest
  vendor/         pdf.js 3.11.174 (pdf.min.js + pdf.worker.min.js)
  fonts/          Sora e JetBrains Mono (woff2, variáveis, subset latin)
  assets/         logótipos Aurora, ícones PWA, cartão OG
tools/brand-assets.html   gera og.png e ícones a partir das fontes/logótipo reais
build.mjs         gera dist/marca-dagua.html — ficheiro único, offline, com CSP por hashes
```

## Desenvolvimento

Não há build para desenvolver: sirva `public/` com qualquer servidor estático.

```bash
python -m http.server 8768 --directory public
```

Para gerar o ficheiro único portátil (`dist/marca-dagua.html`, ~1,5 MB):

```bash
node build.mjs
```

> O PDF precisa de um Web Worker, por isso funciona quando servido (site) ou a partir do
> ficheiro único; abrir `public/index.html` directamente do disco (`file://`) só trata imagens.

## Deploy (Cloudflare Pages)

Mesmo padrão do site principal: repositório GitHub ligado a um projecto Cloudflare Pages.

1. **Cloudflare → Workers & Pages → Create → Pages → Connect to Git** → escolher este repositório.
2. Build settings: *Framework preset* = None · *Build command* = (vazio) · *Build output directory* = `public`.
3. Deploy. O site fica em `marca-dagua.pages.dev`.
4. **Custom domains → Set up a custom domain** → `marcadagua.auroraborealis-ao.com`. Como o DNS
   de `auroraborealis-ao.com` já está no Cloudflare, o CNAME é criado automaticamente.
5. Cada `git push` para `main` volta a publicar.

Alternativa sem Git: `wrangler login` e depois `wrangler pages deploy public --project-name marca-dagua`.

## Limites conhecidos

- HEIC (iPhone) não é descodificado fora do Safari — a ferramenta explica como partilhar em JPG.
- PDFs até 30 páginas; páginas renderizadas a ≤ 2× / ≤ 4000 px para caber nos limites de canvas móveis.
- A marca dificulta e rastreia a reutilização indevida; não a torna impossível.

## Licença

MIT — ver [LICENSE](LICENSE). pdf.js (Apache-2.0), Sora e JetBrains Mono (OFL-1.1) mantêm as
suas licenças. O nome e o logótipo Aurora Borealis não são abrangidos pela licença MIT.
