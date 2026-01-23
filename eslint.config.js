import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
  typescript: true,
  ignores: ['.output', '.wxt', 'node_modules', 'dist', '*.md', '**/*.md'],

  // Enable stylistic rules
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: false,
  },

  // Additional rules
  rules: {
    // TypeScript
    'ts/no-explicit-any': 'warn',
    'ts/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

    // React
    'react/prop-types': 'off',
    'react-hooks/exhaustive-deps': 'warn',

    // Import - disable to avoid conflicts with type imports
    'import/order': 'off',

    // Style
    'style/max-len': [
      'warn',
      {
        code: 120,
        ignoreComments: true,
        ignoreStrings: true,
        ignoreUrls: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ],
    'style/comma-dangle': ['error', 'always-multiline'],
    'style/arrow-parens': ['error', 'always'],

    // Disable overly strict rules
    'antfu/if-newline': 'off',
    'antfu/top-level-function': 'off',
    'node/prefer-global/process': 'off',
    'perfectionist/sort-imports': 'off',
    'perfectionist/sort-named-imports': 'off',
    'perfectionist/sort-exports': 'off',
    'unicorn/prefer-number-properties': 'off',
    'jsonc/sort-keys': 'off',
    'no-console': 'off',
    'no-alert': 'off',
    'no-fallthrough': 'off',
    'unused-imports/no-unused-vars': 'off',
  },
})
