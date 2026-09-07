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
     `index.html`, `style.css`, `app.js`, as fontes `.woff2`, os `.svg`, `pdf.min.js` e, ao
     abrir o primeiro PDF, `pdf.worker.min.js`;
   - entradas `blob:` — ficheiros em memória do navegador; não são pedidos de rede.
4. Confirme a ausência: escreva `method:POST` na caixa de filtro → lista vazia. Active a coluna
   **Domain** (clique direito no cabeçalho) → só aparece `filigrana.ao`. Depois de carregar o
   documento não é feito nenhum pedido novo, à excepção do worker do PDF — um ficheiro do próprio
   site.

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
   "connect-src 'none'"*. O mesmo com `navigator.sendBeacon('https://example.com', 'x')`, que
   devolve `false`.

A política chega num cabeçalho HTTP (a página não a pode alterar) e está repetida numa `<meta>`.
Na linha de comandos: `curl -sI https://filigrana.ao | grep -i content-security-policy`.

### 3. O código

- Não há passo de build: o que o servidor entrega é, byte a byte, o que está em `public/` neste
  repositório. Compare `curl -s https://filigrana.ao/app.js | sha256sum` com
  `sha256sum public/app.js`.
- `app.js` é legível (~550 linhas, sem minificação). Procure `fetch(`, `XMLHttpRequest`,
  `WebSocket`, `sendBeacon`: zero ocorrências. O único `.src` atribuído é um `blob:` local; o PDF
  é entregue ao pdf.js em memória (`getDocument({ data })`); a exportação é
  `URL.createObjectURL` mais uma ligação `download`.
- O pdf.js é a biblioteca da Mozilla, versão 3.11.174, sem alterações. Confirme com o hash dos
  ficheiros publicados em `cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/`:
  - `public/vendor/pdf.min.js` — SHA-256 `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946`
  - `public/vendor/pdf.worker.min.js` — SHA-256 `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b`

  A biblioteca contém código de rede para *abrir PDFs a partir de URLs*, que esta ferramenta não
  usa — e que a CSP bloquearia de qualquer forma.

### 4. Modo avião — a prova mais simples, sem ferramentas

Abra a página e ponha o telemóvel em modo avião (ou, no DevTools, **Network → No throttling →
Offline**). Imagens, marca e transferência continuam a funcionar. Para PDFs, abra um PDF uma vez
antes de cortar a rede, para que o navegador guarde o worker. Uma ferramenta que dependesse de um
servidor pararia aqui.

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
  manifest.webmanifest
  vendor/         pdf.js 3.11.174 (pdf.min.js + pdf.worker.min.js)
  fonts/          Sora e JetBrains Mono (woff2, variáveis, subset latin)
  assets/         marca Filigrana, ícones PWA, cartão OG, marca Aurora (crédito)
tools/brand-assets.html   gera og.jpg e ícones a partir das fontes e da marca
build.mjs         gera dist/filigrana.html — ficheiro único, offline, com CSP por hashes
```

## Desenvolvimento

Não há build para desenvolver: sirva `public/` com qualquer servidor estático.

```bash
python -m http.server 8768 --directory public
```

Para gerar o ficheiro único portátil (`dist/filigrana.html`, ~1,5 MB):

```bash
node build.mjs
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
- A marca dificulta e rastreia a reutilização indevida; não a torna impossível.

## Licença

MIT — ver [LICENSE](LICENSE). pdf.js (Apache-2.0), Sora e JetBrains Mono (OFL-1.1) mantêm as
suas licenças. Os nomes e marcas *Filigrana* e *Aurora Borealis* não são abrangidos pela licença MIT.
