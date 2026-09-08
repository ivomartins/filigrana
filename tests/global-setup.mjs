// Gera dist/filigrana.html antes dos testes (o teste do ficheiro único precisa dele).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function globalSetup(){
  const root = fileURLToPath(new URL('..', import.meta.url));
  execFileSync(process.execPath, ['build.mjs'], { cwd: root, stdio: 'inherit' });
}
