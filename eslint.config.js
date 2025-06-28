import antfu from '@antfu/eslint-config'
import perfectionist from 'eslint-plugin-perfectionist'

export default antfu({
  formatters: true,
  ignores: ['**/*.md/*.ts'], // ignore TypeScript in Markdown files
  stylistic: true,
  typescript: {
    overrides: {
      'ts/no-explicit-any': 'error',
      'ts/no-inferrable-types': 'error',
      'ts/prefer-destructuring': [
        'error',
        {
          AssignmentExpression: {
            array: true,
            object: false,
          },
          VariableDeclarator: {
            array: true,
            object: true,
          },
        },
        {
          enforceForRenamedProperties: false,
        },
      ],
    },
    parserOptions: {
      projectService: true,
    },
    tsconfigPath: 'tsconfig.json',
  },
  unicorn: {
    allRecommended: true,
  },
}, {
  name: 'project/global',
  rules: {
    ...perfectionist.configs['recommended-natural'].rules,
    '@stylistic/operator-linebreak': ['error', 'before', { overrides: { '?': 'after' } }], // equivalent to Prettier's `experimentalTernaries` option
    '@stylistic/padding-line-between-statements': [
      'error',
      { blankLine: 'always', next: 'block-like', prev: 'expression' },
      { blankLine: 'always', next: 'block-like', prev: 'function' },
      { blankLine: 'always', next: 'block-like', prev: 'if' },
      { blankLine: 'always', next: 'block-like', prev: 'switch' },
      { blankLine: 'always', next: 'const', prev: 'block-like' },
      { blankLine: 'always', next: 'export', prev: '*' },
      { blankLine: 'any', next: 'export', prev: 'export' },
      { blankLine: 'always', next: 'expression', prev: 'block-like' },
      { blankLine: 'always', next: 'expression', prev: 'multiline-const' },
      { blankLine: 'always', next: 'function', prev: 'block-like' },
      { blankLine: 'always', next: 'function', prev: 'const' },
      { blankLine: 'always', next: 'if', prev: 'block-like' },
      { blankLine: 'always', next: 'if', prev: 'const' },
      { blankLine: 'always', next: 'if', prev: 'multiline-const' },
      { blankLine: 'always', next: 'let', prev: 'block-like' },
      { blankLine: 'always', next: 'multiline-const', prev: 'expression' },
      { blankLine: 'always', next: 'multiline-const', prev: 'if' },
      { blankLine: 'always', next: 'multiline-const', prev: 'multiline-const' },
      { blankLine: 'always', next: 'return', prev: '*' },
      { blankLine: 'always', next: 'switch', prev: '*' },
    ],
    '@stylistic/quote-props': ['error', 'as-needed'],
    '@stylistic/quotes': ['error', 'single', { allowTemplateLiterals: false, avoidEscape: true }],
    'arrow-body-style': 'error',
    'id-denylist': ['error', 'err', 'cb', '_unused', 'unused'],
    'id-length': 'error',
    'no-console': 'off',
    'no-lonely-if': 'error',
    'no-useless-concat': 'error',
    'node/prefer-global/process': ['error', 'always'],
    'test/no-import-node-test': 'off',
    'unicorn/filename-case': [
      'error',
      {
        case: 'kebabCase',
        ignore: [String.raw`.*\.md$`],
      },
    ],
    'unicorn/no-null': 'off',
    'unicorn/no-process-exit': 'off',
    'unicorn/prefer-top-level-await': 'off',
    'unicorn/prevent-abbreviations': ['error', { checkFilenames: false }],
  },
}, {
  files: ['test/**/*.test.ts'],
  name: 'project/tests',
  rules: {
    'ts/no-floating-promises': 'off', // describe() and test() calls are not promises
    'unicorn/no-useless-undefined': 'off',
  },
}, {
  files: ['test/**/*'],
  name: 'project/tests',
  rules: {
    'no-control-regex': 'off',
  },
}, {
  files: ['**/*.md'],
  name: 'project/markdown',
  rules: {
    '@stylistic/no-trailing-spaces': 'off',
  },
}, {
  files: ['package.json'],
  name: 'project/packagejson',
  rules: { 'jsonc/sort-keys': 'off' },
})
