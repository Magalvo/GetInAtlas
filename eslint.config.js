// Camada 3 — loop determinístico: o linter dá feedback que o agente lê e corrige.
// Regras estritas de propósito. Cada regra desligada exige justificação em ADR.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Agentes tendem a "resolver" erros de tipo com escape hatches. Bloquear.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      // Promessas esquecidas são a classe de bug mais comum em código gerado.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    // O domínio é puro (ADR-0003): sem I/O e nunca depende das apps.
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'fs', 'fs/*', 'net', 'http', 'https', 'child_process'],
              message: 'packages/domain não faz I/O (ADR-0003): recebe os dados por parâmetro.',
            },
            {
              group: [
                '**/apps/**',
                '@getinatlas/api',
                '@getinatlas/api/*',
                '@getinatlas/web',
                '@getinatlas/web/*',
              ],
              message: 'packages/domain nunca importa de apps/* (ADR-0003).',
            },
          ],
        },
      ],
    },
  },
  {
    // Scripts de tooling (Node puro, sem type-checking de projeto)
    files: ['scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly' },
    },
  }
);
