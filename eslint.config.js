import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * ESLint cubre el código TypeScript de `src/`. Los archivos `.astro` los valida
 * `astro check` en el build (astro-eslint-parser no es compatible con
 * `projectService`). Config y scripts quedan fuera del type-checking.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'drizzle/',
      '.data/',
      'sdk/',
      'tests/e2e/',
      '**/*.astro',
      '*.config.ts',
      '*.config.mjs',
      '*.config.js',
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/unit/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // Funciones async por contrato (devuelven Promise) aunque su cuerpo actual
      // no tenga await.
      '@typescript-eslint/require-await': 'off',
      // Las rutas de Astro lanzan `Response` a propósito (redirecciones / 404).
      '@typescript-eslint/only-throw-error': [
        'error',
        { allow: [{ from: 'lib', name: 'Response' }] },
      ],
    },
  },
  {
    files: ['scripts/**/*.{mjs,js}'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
);
