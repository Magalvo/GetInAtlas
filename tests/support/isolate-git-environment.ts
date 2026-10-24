// Corre antes de cada ficheiro de teste (vitest.config.ts → setupFiles).
// Num hook de git, o processo herda GIT_DIR, GIT_INDEX_FILE, etc.; qualquer
// `git -C <tmp> …` lançado pelos testes atuaria sobre o repositório REAL.
// Ver WI-0011.
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const localVariables = execFileSync('git', ['rev-parse', '--local-env-vars'], {
  cwd: tmpdir(),
  encoding: 'utf8',
  windowsHide: true,
})
  .split('\n')
  .filter((name) => name !== '');

for (const name of localVariables) {
  Reflect.deleteProperty(process.env, name);
}
