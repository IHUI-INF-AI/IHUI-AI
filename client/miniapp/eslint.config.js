import js from '@eslint/js'
import ts from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import * as vueParser from 'vue-eslint-parser'

// uni-app 小程序全局变量
const uniappGlobals = {
  // uni-app API
  uni: 'readonly',
  UniApp: 'readonly',
  UniHelper: 'readonly',
  uniCloud: 'readonly',
  requirePlugin: 'readonly',
  // 微信小程序原生 API
  wx: 'readonly',
  App: 'readonly',
  Page: 'readonly',
  Component: 'readonly',
  getApp: 'readonly',
  getCurrentPages: 'readonly',
  getCurrentPages_: 'readonly',
  // APP 端 plus API
  plus: 'readonly',
  // 通用
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  // ES module
  module: 'readonly',
  require: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  // DOM (H5 平台)
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  fetch: 'readonly',
  XMLHttpRequest: 'readonly',
  WebSocket: 'readonly',
  FileReader: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  // Vue Composition API (auto-imported by uni-app)
  ref: 'readonly',
  reactive: 'readonly',
  computed: 'readonly',
  watch: 'readonly',
  watchEffect: 'readonly',
  toRef: 'readonly',
  toRefs: 'readonly',
  readonly: 'readonly',
  markRaw: 'readonly',
  onMounted: 'readonly',
  onUnmounted: 'readonly',
  onBeforeMount: 'readonly',
  onBeforeUnmount: 'readonly',
  onUpdated: 'readonly',
  onBeforeUpdate: 'readonly',
  nextTick: 'readonly',
  defineComponent: 'readonly',
  defineProps: 'readonly',
  defineEmits: 'readonly',
  defineExpose: 'readonly',
  withDefaults: 'readonly',
}

const commonPlugins = {
  '@typescript-eslint': ts,
  vue,
}

const commonRules = {
  ...ts.configs.recommended.rules,
  ...vue.configs['flat/recommended'].rules,
  'vue/multi-word-component-names': 'off',
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/ban-ts-comment': 'off',
  // 历史代码风格：未使用变量改为 warn，避免阻塞 lint
  '@typescript-eslint/no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
  // 小程序场景需要 console 调试，允许 console.log/warn/error/info/debug
  'no-console': ['warn', { allow: ['warn', 'error', 'log', 'info', 'debug'] }],
  'vue/no-v-html': 'off',
  // 小程序 template 中 v-for + v-if 同元素常见，vue-tsc 已校验，eslint 不重复报错
  'vue/no-use-v-if-with-v-for': 'off',
  // 历史代码风格：放宽以下规则为 warn
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-unused-expressions': 'off',
  '@typescript-eslint/no-unused-expressions': 'warn',
  // uni-app 条件编译（// #ifdef / // #ifndef / // #endif）会导致 eslint 误报 no-unreachable
  // 例：return 'app'; // #endif 后的代码在非 APP 平台是有效分支，但 eslint 认为是 unreachable
  // 关闭规则避免误报（uni-app 场景必然有条件编译）
  'no-unreachable': 'off',
  'no-useless-escape': 'warn',
  'no-case-declarations': 'warn',
  'no-constant-condition': 'warn',
  'no-fallthrough': 'warn',
  'no-irregular-whitespace': 'warn',
  'no-useless-catch': 'warn',
  'no-cond-assign': 'warn',
  'no-redeclare': 'warn',
  '@typescript-eslint/no-this-alias': 'warn',
  // 历史代码大量使用 Function 类型，改为 warn
  '@typescript-eslint/no-unsafe-function-type': 'warn',
  // 历史代码 .vue 文件中也有 require() 动态导入，改为 warn
  '@typescript-eslint/no-require-imports': 'warn',
  'no-import-assign': 'warn',
  'no-prototype-builtins': 'warn',
  'no-async-promise-executor': 'warn',
  'no-control-regex': 'warn',
  'no-dupe-keys': 'warn',
}

export default [
  js.configs.recommended,
  // .vue 文件
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: uniappGlobals,
    },
    plugins: commonPlugins,
    rules: {
      ...commonRules,
      // 小程序全局变量多，vue-tsc 已校验类型，eslint 不重复报 no-undef
      'no-undef': 'off',
    },
  },
  // .ts 文件（需要类型信息，project 指向 tsconfig）
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: uniappGlobals,
    },
    plugins: commonPlugins,
    rules: {
      ...commonRules,
      'no-undef': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      // .ts 文件中的 require() 改为 warn（历史代码动态导入）
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
  // .js 文件（不要求 project，避免解析错误；小程序老代码常用 require）
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: uniappGlobals,
    },
    plugins: commonPlugins,
    rules: {
      ...commonRules,
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  // .d.ts 类型声明文件放宽规则（不要求 project，避免根目录 .d.ts 解析错误）
  {
    files: ['**/*.d.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: null,
      },
      globals: uniappGlobals,
    },
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  // 自动生成的文件不校验
  {
    files: ['src/typings/wx.d.ts', 'src/shims.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // wx.d.ts 是微信小程序官方类型声明，包含不规则空白和重复声明
      'no-irregular-whitespace': 'off',
      'no-redeclare': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'unpackage/**',
      '**/uniCloud-aliyun/**',
      // uni_modules 为 uni-app 插件市场第三方代码，不应 lint
      'src/uni_modules/**',
      'src/vendor/**',
      'scripts/**',
      '*.config.js',
      '*.config.ts',
      'public/**',
      'static/**',
    ],
  },
]
