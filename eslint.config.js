import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tailwindcss from 'eslint-plugin-tailwindcss'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.orchestrator/**',
      '.playwright-mcp/**',
    ],
  },
  js.configs.recommended,
  vueTsConfigs.recommended,
  pluginVue.configs['flat/recommended'],
  tailwindcss.configs.recommended,
  {
    name: 'app/vue-custom-rules',
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'tailwindcss/classnames-order': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
