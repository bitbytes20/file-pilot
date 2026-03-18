const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');

module.exports = {
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest',
  },
  plugins: ['@typescript-eslint', 'import', 'promise', 'react', 'react-hooks', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/strict',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:promise/recommended',
    'prettier',
  ],
  settings: {
    react: {
      version: '18.2',
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: [
          path.join(repoRoot, 'tsconfig.json'),
          path.join(repoRoot, 'packages/*/tsconfig.json'),
          path.join(repoRoot, 'apps/*/tsconfig.json'),
          path.join(repoRoot, 'apps/*/tsconfig.*.json'),
        ],
      },
    },
  },
  rules: {
    'import/no-default-export': 'error',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/tests/**', '**/*.test.*', '**/*.spec.*', '**/vite.config.*', '**/vitest.config.*'],
      },
    ],
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  overrides: [
    {
      files: ['**/*.cts', '**/*.cjs'],
      parserOptions: {
        sourceType: 'script',
      },
    },
  ],
};
