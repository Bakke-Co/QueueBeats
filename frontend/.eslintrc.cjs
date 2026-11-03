module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  extends: ['eslint:recommended'],
  ignorePatterns: ['dist/', 'build/', 'node_modules/'],
  overrides: [{
    files: ['*.ts', '*.tsx'],
    // TypeScript checks identifier resolution; core rules do not understand type positions.
    rules: { 'no-undef': 'off', 'no-unused-vars': 'off' },
  }],
};
