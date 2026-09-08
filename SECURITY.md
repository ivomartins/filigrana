# Segurança — Filigrana

Documento de segurança do Filigrana (filigrana.ao), nos termos do art. 30.º da Lei n.º 22/11, e
política de comunicação de vulnerabilidades. Responsável: Aurora Borealis, Luanda
(info@auroraborealis-ao.com). Última revisão: 8 de Setembro de 2026. Revisão trimestral.

*English summary at the end.*

## 1. Âmbito e princípio

O Filigrana é uma página estática que marca cópias de documentos de identificação no dispositivo
de quem a usa. O princípio de desenho é não ter nada para proteger do lado do servidor: nenhum
documento, texto de marca ou preferência sai do navegador. A segurança consiste em manter esse
princípio verdadeiro e verificável.

## 2. Activos protegidos

| Activo | Onde está | O que se protege |
|---|---|---|
| Documentos e texto da marca | Só no dispositivo do utilizador, em memória, durante a sessão | Nunca são transmitidos nem guardados pela Aurora Borealis |
| Código do site (`public/`) | Repositório GitHub `ivomartins/filigrana` e Cloudflare Pages | Integridade: o que é servido é o que está no repositório |
| Biblioteca pdf.js e descodificadores (`public/vendor/`) | Repositório, fixados por hash em `vendor.lock.json` | Integridade e ausência de código de rede activo |
| Domínio `filigrana.ao` e DNS | Registo `.ao` e Cloudflare | Controlo do nome e do certificado |
| Registos de acesso | Cloudflare (subcontratado), agregados para a Aurora Borealis | Minimização; ver a página de privacidade |

## 3. Classificação de dados

- **Documentos de identificação e texto da marca:** dados pessoais, potencialmente sensíveis.
  Tratados exclusivamente pelo titular, no seu dispositivo (art. 4.º da Lei 22/11). A Aurora
  Borealis não recolhe, não guarda, não consulta nem transmite.
- **Preferências** (idioma, tamanho, opacidade, rotação, densidade, cor): guardadas no
  `localStorage` do navegador do utilizador, sob a chave `filigrana-prefs`. Nunca o texto da marca.
- **Registos de acesso** (endereço IP, navegador, data e hora, página pedida): dados pessoais
  tratados pela Cloudflare por conta da Aurora Borealis, para servir e proteger o site. A Aurora
  Borealis só vê contagens agregadas.

## 4. Medidas técnicas

1. **Sem servidor aplicacional.** Não existe código a correr do lado do servidor nem qualquer
   ponto de recepção de dados. O alojamento (Cloudflare Pages) serve ficheiros estáticos.
2. **Content Security Policy** enviada por cabeçalho e repetida na página: `default-src 'none'`,
   `connect-src 'none'` (o navegador recusa qualquer `fetch`, XHR, WebSocket ou beacon),
   `form-action 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`; sem `unsafe-inline` nem
   `unsafe-eval`. Scripts, estilos, fontes e imagens só do próprio site.
3. **Cabeçalhos de segurança:** HSTS (um ano, subdomínios incluídos, preload),
   `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
   `Permissions-Policy` a desactivar câmara, microfone, geolocalização, pagamentos e USB,
   `Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy: same-origin`.
4. **Transporte:** HTTPS obrigatório com redireccionamento, TLS 1.2 no mínimo, certificado gerido
   pela Cloudflare. DNSSEC: planeado (depende do registo `.ao`).
5. **Sem terceiros na página:** fontes, biblioteca de PDF e imagens servidas do próprio site. Sem
   CDNs, sem analítica, sem cookies. As funcionalidades da Cloudflare que injectam scripts
   (Web Analytics, Bot Fight Mode, Rocket Loader, Email Obfuscation) ficam desligadas.
6. **Biblioteca de PDF isolada:** o pdf.js corre num Web Worker criado pelo próprio site, só é
   carregado quando o primeiro PDF é aberto, recebe o ficheiro em memória e não descarrega nada
   (`useWasm: false`). O código vendored não contém `eval`, `new Function` nem `importScripts`.
7. **Saída rasterizada:** a marca é escrita nos píxeis; os PDF são reconstruídos página a página
   como imagens. Os metadados EXIF são removidos ao exportar.
8. **Ficheiro único** (`dist/filigrana.html`): versão sem rede, com a mesma política, para uso
   offline ou em ambientes fechados.

## 5. Medidas organizativas

- **Quem pode alterar o site:** apenas quem tem acesso de escrita ao repositório e à conta
  Cloudflare. As pessoas com esse acesso devem usar autenticação de dois factores em ambas as
  contas e não partilhar credenciais.
- **Controlo de alterações:** o ramo `main` é a produção e está protegido: só aceita pull requests
  com as verificações `check` e `test` a passar, sem force push, também para administradores.
  Cada alteração fica no histórico público do repositório.
- **Verificações automáticas** (`npm run check`): hashes das dependências vendored, ausência de
  APIs de rede no código, igualdade entre a CSP da página e a do cabeçalho, cabeçalhos
  obrigatórios, paridade das traduções, ausência de segredos e de dados pessoais no repositório.
- **Testes de navegador** (`npm test`): carregam imagem e PDF, exportam, repetem em modo avião e
  no ficheiro único, e falham se um único pedido sair do site ou se houver erros de consola.
- **Dependências:** nenhuma em execução. A única dependência de desenvolvimento (Playwright) está
  fixada a uma versão exacta; as acções de CI estão fixadas por hash de commit; o Dependabot
  propõe actualizações mensais. A biblioteca de PDF é actualizada a partir do pacote oficial, com
  verificação de hashes e registo em `vendor.lock.json`.
- **Revisão:** trimestral, ou sempre que houver uma alteração de arquitectura, uma actualização de
  segurança do pdf.js ou uma alteração à Lei 22/11.

## 6. Terceiros

| Entidade | Papel | Dados | Enquadramento |
|---|---|---|---|
| Cloudflare, Inc. | Alojamento (Pages), DNS, rede e certificados; subcontratado (art. 23.º) | Registos de acesso | Data Processing Addendum da Cloudflare, parte integrante do contrato de serviço |
| GitHub, Inc. | Alojamento do código e integração contínua | Nenhum dado pessoal de utilizadores | Repositório público |
| npm (GitHub) | Distribuição do pdf.js e do Playwright | Nenhum | Só em desenvolvimento; ficheiros verificados por hash |

## 7. Comunicação de vulnerabilidades

Se encontrar uma vulnerabilidade, escreva para **info@auroraborealis-ao.com** com o assunto
«Filigrana: segurança». Inclua os passos para reproduzir e, se possível, a versão do navegador.
Compromissos:

- Resposta em 5 dias úteis; correcção prioritária para qualquer falha que permita a saída de dados
  do dispositivo ou a execução de código na página.
- Divulgação coordenada: pedimos que não publique antes da correcção; o crédito é dado no
  histórico do repositório, se o desejar.
- Não há programa de recompensas. Não teste contra utilizadores reais nem com documentos reais:
  use o espécime fictício da Testelândia.

Não são vulnerabilidades: a possibilidade de remover uma marca com edição de imagem (limite
declarado do produto) e as violações de CSP registadas na consola quando alguém tenta injectar
scripts, que são a política a funcionar.

## 8. Incidentes

Considera-se incidente qualquer situação em que dados de utilizadores possam ter saído do
dispositivo, em que o site sirva código diferente do repositório, ou em que o domínio ou o
certificado sejam comprometidos. Resposta: retirar a alteração (reverter em `main` publica em
menos de um minuto), confirmar o estado do site com `npm run check` e uma verificação da página
servida, registar o incidente no repositório e, se dados pessoais tiverem sido afectados,
avaliar a notificação à APD e a informação aos titulares.

---

## English summary

Filigrana is a static page that watermarks ID copies on the user's own device. Nothing leaves
the browser: no documents, no watermark text, no preferences. Security is about keeping that
true and verifiable: no application server; a strict Content Security Policy sent as a header
and repeated in the page (`connect-src 'none'`, no inline or third-party scripts); HSTS, nosniff,
frame denial, no referrer, restrictive permissions, same-origin isolation; TLS 1.2 minimum;
no CDNs, analytics or cookies; pdf.js vendored, hash-pinned, free of `eval`, loaded only when a
PDF is opened, running in a worker the site creates and never fetching anything; rasterised
output with EXIF stripped. Organisationally: a protected production branch that only accepts
pull requests with passing checks and browser tests, exact-pinned tooling, quarterly review.
Access logs are processed by Cloudflare as processor under its Data Processing Addendum; the
maintainers only see aggregate counts. Report vulnerabilities to info@auroraborealis-ao.com
with the subject "Filigrana: segurança"; we answer within five working days and ask for
coordinated disclosure. Never test with real documents.
