const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['coverage/**', 'reports/**', 'node_modules/**', 'data/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      complexity: ['error', 10],
      'max-lines-per-function': ['warn', 80],
      'no-console': 'off',
      eqeqeq: 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.jest } },
    rules: { 'max-lines-per-function': 'off' },
  },
];