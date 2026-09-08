# Filigrana

**Marque a cópia. Partilhe com confiança.** Filigrana escreve o destinatário e a data por cima
das cópias do seu BI, passaporte ou PDF antes de as partilhar — 100% no navegador, nada é enviado.

Um projecto open-source da [Aurora Borealis](https://auroraborealis-ao.com). Em produção em
[filigrana.ao](https://filigrana.ao).

*Filigrana* é a marca de água que protege as notas contra a falsificação. Aqui, protege as cópias
dos seus documentos: todos os dias partilhamos cópias do BI ou de comprovativos com bancos,
operadoras, senhorios e empregadores, e depois perdemos-lhes o rasto. Uma cópia com o destinatário e
a data escritos por cima deixa de servir para outra coisa — e, se fugir, sabe-se por onde.

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
- **Por escrito.** A [página de privacidade](https://filigrana.ao/privacidade.html) diz quem é o
  responsável, o que o site regista (os acessos, como qualquer site, através da Cloudflare) e o
  enquadramento na Lei n.º 22/11; o [documento de segurança](SECURITY.md) descreve as medidas e
  como comunicar vulnerabilidades.

## Como verificar que nada sai do seu dispositivo

A promessa "nada é enviado" não pede confiança: verifica-se em minutos com as ferramentas de
programador de qualquer navegador. Os passos estão escritos para Chrome/Edge (os nomes dos
separadores aparecem em inglês); no Firefox são equivalentes. *(English speakers: the same four
checks apply — the DevTools labels below are already in English.)*

### 1. Tráfego de rede — a prova principal

1. Abra `https://filigrana.ao`, prima **F12** e escolha o separador **Network**. Marque
   **Preserve log** e **Disable cache**.
2. Carregue um documento (imagem ou PDF), escreva o texto da marca, mexa nos ajustes e transfira
   o resultado.
3. Leia a lista de pedidos. Deve ver apenas:
   - pedidos **GET** ao próprio domínio (`filigrana.ao`) dos ficheiros estáticos do site —
     `index.html`, `style.css`, `app.js`, as fontes `.woff2`, os `.svg` e, só ao abrir o primeiro
     PDF, a biblioteca de PDF (`vendor/pdfjs-6.3.289/pdf.min.mjs` e `pdf.worker.min.mjs`; se o
     PDF tiver imagens JPEG 2000 ou JBIG2, também o descodificador correspondente em
     `vendor/pdfjs-6.3.289/wasm/`);
   - entradas `blob:` — ficheiros em memória do navegador; não são pedidos de rede.
4. Confirme a ausência: escreva `method:POST` na caixa de filtro → lista vazia. Active a coluna
   **Domain** (clique direito no cabeçalho) → só aparece `filigrana.ao`. Depois de carregar o
   documento não é feito nenhum pedido novo, à excepção, no primeiro PDF, da biblioteca de PDF —
   ficheiros do próprio site.

### 2. A política que o navegador impõe — CSP

1. Em **Network**, clique no primeiro pedido (`filigrana.ao`) → **Headers** → **Response
   Headers** → `content-security-policy`.
2. Confirme `default-src 'none'`, `connect-src 'none'` e `form-action 'none'`. Significado: o
   navegador **recusa** qualquer `fetch`, XHR, WebSocket ou beacon (`connect-src 'none'`),
   qualquer envio de formulário (`form-action 'none'`) e qualquer recurso de terceiros
   (`default-src 'none'` — scripts, estilos, imagens e fontes só do próprio site). Mesmo que
   houvesse um erro no código, ou uma alteração maliciosa, o navegador bloqueava o envio.
3. Prova activa: no separador **Console** escreva `fetch('https://example.com')` e prima Enter.
   O navegador responde *Refused to connect … violates the Content Security Policy directive
   "connect-src 'none'"*. O mesmo com `navigator.sendBeacon('https://example.com', 'x')` e com
   `new WebSocket('wss://example.com')`: a consola regista a violação e nada é enviado. (O
   `sendBeacon` pode devolver `true`, porque o Chrome só bloqueia o pedido a seguir; o que conta
   é a violação registada e a ausência do pedido no separador Network.)

A política chega num cabeçalho HTTP (a página não a pode alterar) e está repetida numa `<meta>`.
Na linha de comandos: `curl -sI https://filigrana.ao | grep -i content-security-policy`.

### 3. O código

- Não há passo de build: o que o servidor entrega é, byte a byte, o que está em `public/` neste
  repositório. Compare `curl -s https://filigrana.ao/app.js | sha256sum` com
  `sha256sum public/app.js`.
- `app.js` é legível (~550 linhas, sem minificação). Procure `fetch(`, `XMLHttpRequest`,
  `WebSocket`, `sendBeacon`: zero ocorrências. O único `.src` atribuído é um `blob:` local; o PDF
  é entregue ao pdf.js em memória (`getDocument({ data, … })`); a exportação é
  `URL.createObjectURL` mais uma ligação `download`. O único `import()` aponta para a pasta
  `vendor/` do próprio site.
- O pdf.js é a biblioteca da Mozilla, versão 6.3.289 (build *legacy*, o que suporta navegadores
  mais antigos), sem alterações, copiada do pacote npm `pdfjs-dist@6.3.289` (integridade do
  tarball: `sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw==`).
  Confirme com o hash dos ficheiros publicados em
  `cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/legacy/build/` (espelho exacto do npm):
  - `public/vendor/pdfjs-6.3.289/pdf.min.mjs` — SHA-256 `f401927e692efc7735e0cd528c490d0dd31b7f0972c122b7040df805be45cce4`
  - `public/vendor/pdfjs-6.3.289/pdf.worker.min.mjs` — SHA-256 `a33cfe728c584fdba4fcc1fd54bcdc2f9f2f13889ddbb5b2bd1d0f8cbe49b84e`
  - os descodificadores JPEG 2000 e JBIG2 em JavaScript (`wasm/*_nowasm_fallback.js`, de
    `cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/wasm/`) e as licenças: hashes em `vendor.lock.json`.

  Os mesmos hashes estão em [`vendor.lock.json`](vendor.lock.json) e são conferidos em cada
  alteração ao código por `npm run check` (localmente e no GitHub Actions), juntamente com a
  ausência de APIs de rede em `app.js`, a igualdade entre a CSP da página e a do cabeçalho, e
  os restantes cabeçalhos de segurança. Por cima disso, `npm test` abre a página num Chromium
  ([`tests/`](tests/)), carrega uma imagem e um PDF, aplica a marca, exporta, repete tudo em
  modo avião e no ficheiro único, e falha se um único pedido sair do site.

  A biblioteca só é descarregada quando abre o primeiro PDF (quem só marca imagens nunca a pede).
  Contém código de rede para *abrir PDFs a partir de URLs* e para ir buscar descodificadores
  `.wasm`, que esta ferramenta não usa: o PDF é entregue em memória e a opção `useWasm: false`
  faz o worker importar os descodificadores em JavaScript do próprio site, só se um PDF os
  pedir. A CSP bloquearia qualquer outra coisa.
- O código do pdf.js não contém `eval(` nem `new Function(`: procure em `public/vendor/`, zero
  ocorrências (`npm run check` também o confirma). A versão 3.x compilava glifos de fontes com
  `new Function`, a via explorada pela CVE-2024-4367; a 6.x já não tem essa via. A CSP, sem
  `unsafe-eval`, bloqueá-la-ia de qualquer forma.

### 4. Modo avião — a prova mais simples, sem ferramentas

Abra a página e ponha o telemóvel em modo avião (ou, no DevTools, **Network → No throttling →
Offline**). Imagens, marca e transferência continuam a funcionar. Para PDFs, abra um PDF uma vez
antes de cortar a rede: a biblioteca é carregada nesse momento, fica na página e em cache até um
ano (a pasta traz a versão no nome e é servida como *immutable*). Para
trabalhar sem rede sem limite de tempo, use o ficheiro único (`dist/filigrana.html`, gerado com
`npm run build`), que leva tudo dentro e funciona mesmo aberto do disco. Uma ferramenta que
dependesse de um servidor pararia aqui.

### O que sai, de facto

Só os pedidos dos ficheiros estáticos do próprio site. Como em qualquer site, o alojamento
(Cloudflare) vê o endereço IP, o navegador e a hora do pedido — nunca o conteúdo de um documento,
o texto da marca ou os ajustes. As estatísticas de visitas que usamos vêm exclusivamente desses
registos de pedidos, contados na rede da Cloudflare — não há qualquer script de analítica, beacon
ou cookie na página (a CSP bloqueá-los-ia). As preferências ficam no `localStorage` do navegador;
o texto da marca nunca é guardado.

## Estrutura

```
public/           ← raiz de deploy (Cloudflare Pages)
  index.html      markup + CSP <meta>
  style.css       tokens de design + estilos
  app.js          toda a lógica (imagens, PDF, i18n, escrita de PDF mínima)
  _headers        cabeçalhos de segurança para Cloudflare Pages
  privacidade.html  política de privacidade (Lei 22/11): responsável, registos de acesso, direitos
  404.html        página de erro própria (sem ela o Pages responderia 200 a tudo)
  manifest.webmanifest
  vendor/pdfjs-6.3.289/   pdf.js (build legacy: pdf.min.mjs + pdf.worker.min.mjs) e, em wasm/,
                  os descodificadores JPEG 2000 e JBIG2 em JavaScript, com as licenças
  fonts/          Sora e JetBrains Mono (woff2, variáveis, subset latin)
  assets/         marca Filigrana, ícones PWA, cartão OG, marca Aurora (crédito)
tools/serve.mjs   servidor de desenvolvimento (npm run dev) — sem dependências
tools/check.mjs   verificações de integridade e privacidade (npm run check) — também no CI
tools/*.html      geradores de imagens de marca e de imprensa (abrir no navegador)
tests/            testes de navegador (npm test, Playwright): imagem, PDF, exportação, modo
                  avião, ficheiro único, CSP; os ficheiros de teste são gerados em código
playwright.config.mjs
build.mjs         gera dist/filigrana.html — ficheiro único, offline, com CSP por hashes
vendor.lock.json  versão, origem e SHA-256 de cada ficheiro em public/vendor/
package.json      scripts (dev, build, check, test); única dependência, de desenvolvimento: @playwright/test
.github/          workflows/check.yml corre npm run check e npm test em cada pull request e em main
CLAUDE.md         regras para quem mantém o projecto (pessoas e agentes de IA)
SECURITY.md       documento de segurança (art. 30.º da Lei 22/11) e comunicação de vulnerabilidades
```

## Desenvolvimento

Não há build para desenvolver e não há dependências de execução — basta Node (≥ 20):

```bash
npm run dev
```

Abre `public/` em `http://127.0.0.1:8768/` com os mesmos cabeçalhos de segurança de produção
(lê `public/_headers`). Qualquer outro servidor estático a servir `public/` também serve.

Antes de propor uma alteração, corra as verificações (as mesmas que o GitHub Actions corre em
cada pull request; `main` só aceita pull requests com esta verificação a passar):

```bash
npm run check
```

Os testes de navegador (Playwright, Chromium) carregam uma imagem e um PDF, aplicam a marca,
transferem o resultado, repetem tudo em modo avião e no ficheiro único, e falham se algum pedido
sair do site. Correm também no CI. Localmente, a primeira vez instala o Playwright (a única
dependência, de desenvolvimento) e o Chromium de testes:

```bash
npm install
npx playwright install chromium
npm test
```

Para gerar o ficheiro único portátil (`dist/filigrana.html`, ~1,5 MB):

```bash
npm run build
```

> O PDF precisa de um Web Worker, por isso funciona quando servido (site) ou a partir do
> ficheiro único; abrir `public/index.html` directamente do disco (`file://`) só trata imagens.

## Deploy (Cloudflare Pages + filigrana.ao)

1. **Cloudflare → Workers & Pages → Create → Pages → Connect to Git** → este repositório.
2. Build settings: *Framework preset* = None · *Build command* = (vazio) · *Build output directory* = `public`.
3. Deploy. O site fica em `filigrana.pages.dev`.
4. **Domínio:** adicionar a zona `filigrana.ao` ao Cloudflare e apontar os nameservers no registo
   `.ao` para os que o Cloudflare indicar. Depois, no projecto Pages, **Custom domains → Set up a
   custom domain → `filigrana.ao`** (e `www.filigrana.ao`, se quiser). O Cloudflare cria os registos.
5. Cada `git push` para `main` volta a publicar.

Alternativa sem Git: `wrangler login` e depois `wrangler pages deploy public --project-name filigrana`.

## Limites conhecidos

- HEIC (iPhone) não é descodificado fora do Safari — a ferramenta explica como partilhar em JPG.
- PDFs até 30 páginas; páginas renderizadas a ≤ 2× / ≤ 4000 px para caber nos limites de canvas móveis.
- PDFs precisam de um navegador recente (Chrome/Edge 125+, Firefox ESR, Safari 18+, o mínimo do
  build *legacy* do pdf.js 6). Em navegadores mais antigos aparece «Não foi possível ler este
  PDF»; as imagens funcionam na mesma.
- No ficheiro único (`dist/filigrana.html`), PDFs com imagens JPEG 2000 ou JBIG2 não são
  suportados: os descodificadores não são embutidos. No site funcionam.
- A marca dificulta e rastreia a reutilização indevida; não a torna impossível.

## Licença

MIT — ver [LICENSE](LICENSE). pdf.js (Apache-2.0), os descodificadores OpenJPEG (BSD-2) e JBIG2
do PDFium (BSD-3) que o acompanham, e as fontes Sora e JetBrains Mono (OFL-1.1) mantêm as suas
licenças. Os nomes e marcas *Filigrana* e *Aurora Borealis* não são abrangidos pela licença MIT.
