import js from '@eslint/js'
import ts from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import * as vueParser from 'vue-eslint-parser'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
// 自定义规则：检测响应式对象中未使用 markRaw 包装的组件 icon
const markrawIconRule = require('./eslint-rules/markraw-icon.cjs')
// 自定义规则：禁止在 onUnmounted/onBeforeUnmount 中直接做清理
const noManualCleanupRule = require('./eslint-rules/no-manual-cleanup.cjs')

const commonGlobals = {
  // Environment flags
  browser: true,
  es2021: true,
  node: true,
  // Node.js globals
  module: 'readonly',
  require: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  NodeJS: 'readonly',
  // Core browser globals
  console: 'readonly',
  document: 'readonly',
  window: 'readonly',
  Window: 'readonly',
  navigator: 'readonly',
  Navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  alert: 'readonly',
  prompt: 'readonly',
  confirm: 'readonly',
  // Timers
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  requestIdleCallback: 'readonly',
  cancelIdleCallback: 'readonly',
  queueMicrotask: 'readonly',
  // Fetch API
  fetch: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  RequestInit: 'readonly',
  HeadersInit: 'readonly',
  Headers: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  // DOM Elements
  HTMLElement: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLButtonElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  HTMLImageElement: 'readonly',
  HTMLAudioElement: 'readonly',
  HTMLVideoElement: 'readonly',
  HTMLCanvasElement: 'readonly',
  HTMLScriptElement: 'readonly',
  HTMLLinkElement: 'readonly',
  HTMLStyleElement: 'readonly',
  HTMLIFrameElement: 'readonly',
  HTMLFormElement: 'readonly',
  Element: 'readonly',
  Node: 'readonly',
  Image: 'readonly',
  SVGSVGElement: 'readonly',
  // Events
  Event: 'readonly',
  CustomEvent: 'readonly',
  EventListener: 'readonly',
  EventTarget: 'readonly',
  EventListenerOrEventListenerObject: 'readonly',
  AddEventListenerOptions: 'readonly',
  EventListenerOptions: 'readonly',
  MouseEvent: 'readonly',
  KeyboardEvent: 'readonly',
  FocusEvent: 'readonly',
  WheelEvent: 'readonly',
  DragEvent: 'readonly',
  PointerEvent: 'readonly',
  ClipboardEvent: 'readonly',
  ErrorEvent: 'readonly',
  TouchEvent: 'readonly',
  MessageEvent: 'readonly',
  ProgressEvent: 'readonly',
  PromiseRejectionEvent: 'readonly',
  // Canvas
  CanvasRenderingContext2D: 'readonly',
  ImageData: 'readonly',
  // Web APIs
  Blob: 'readonly',
  BlobPart: 'readonly',
  BlobEvent: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextDecoder: 'readonly',
  TextEncoder: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  FileList: 'readonly',
  FormData: 'readonly',
  WebSocket: 'readonly',
  CloseEvent: 'readonly',
  XMLHttpRequest: 'readonly',
  DOMParser: 'readonly',
  DOMException: 'readonly',
  EventSource: 'readonly',
  ClipboardItem: 'readonly',
  // Observers
  MutationObserver: 'readonly',
  MutationCallback: 'readonly',
  ResizeObserver: 'readonly',
  ResizeObserverEntry: 'readonly',
  ResizeObserverCallback: 'readonly',
  IntersectionObserver: 'readonly',
  IntersectionObserverEntry: 'readonly',
  IntersectionObserverInit: 'readonly',
  IntersectionObserverCallback: 'readonly',
  PerformanceObserver: 'readonly',
  // Performance
  performance: 'readonly',
  Performance: 'readonly',
  PerformanceEntry: 'readonly',
  PerformanceNavigationTiming: 'readonly',
  PerformanceResourceTiming: 'readonly',
  PerformancePaintTiming: 'readonly',
  // Media APIs
  MediaRecorder: 'readonly',
  MediaRecorderOptions: 'readonly',
  MediaStream: 'readonly',
  MediaStreamTrack: 'readonly',
  MediaQueryList: 'readonly',
  MediaQueryListEvent: 'readonly',
  AudioContext: 'readonly',
  OfflineAudioContext: 'readonly',
  AnalyserNode: 'readonly',
  Audio: 'readonly',
  // Workers
  Worker: 'readonly',
  SharedWorker: 'readonly',
  // Storage
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  StorageEvent: 'readonly',
  Storage: 'readonly',
  indexedDB: 'readonly',
  IDBDatabase: 'readonly',
  IDBObjectStore: 'readonly',
  IDBIndex: 'readonly',
  IDBRequest: 'readonly',
  IDBOpenDBRequest: 'readonly',
  IDBCursorWithValue: 'readonly',
  IDBKeyRange: 'readonly',
  IdleDeadline: 'readonly',
  caches: 'readonly',
  // Service Worker
  ServiceWorkerRegistration: 'readonly',
  ServiceWorkerState: 'readonly',
  // Notifications
  Notification: 'readonly',
  NotificationOptions: 'readonly',
  NotificationPermission: 'readonly',
  // Speech APIs
  SpeechRecognition: 'readonly',
  SpeechRecognitionEvent: 'readonly',
  SpeechRecognitionResult: 'readonly',
  SpeechSynthesis: 'readonly',
  SpeechSynthesisUtterance: 'readonly',
  SpeechSynthesisVoice: 'readonly',
  speechSynthesis: 'readonly',
  // Audio Nodes
  MediaStreamAudioSourceNode: 'readonly',
  // XPath
  XPathResult: 'readonly',
  // DOM Types
  Document: 'readonly',
  HTMLAnchorElement: 'readonly',
  HTMLSelectElement: 'readonly',
  // Node.js (for plugins)
  Buffer: 'readonly',
  // Crypto
  crypto: 'readonly',
  // Fonts
  FontFace: 'readonly',
  // Share API
  ShareData: 'readonly',
  // Animation
  Animation: 'readonly',
  Keyframe: 'readonly',
  // CSS
  getComputedStyle: 'readonly',
  CSSStyleDeclaration: 'readonly',
  ScrollBehavior: 'readonly',
  // Encoding
  btoa: 'readonly',
  atob: 'readonly',
  // FileSystem API
  FileSystem: 'readonly',
  FileSystemEntry: 'readonly',
  FileSystemFileEntry: 'readonly',
  FileSystemDirectoryEntry: 'readonly',
  FileSystemDirectoryReader: 'readonly',
  DataTransferItem: 'readonly',
  DataTransferItemList: 'readonly',
  // Web Workers / Service Workers
  self: 'readonly',
  ExtendableEvent: 'readonly',
  FetchEvent: 'readonly',
  InstallEvent: 'readonly',
  ActivateEvent: 'readonly',
  PushEvent: 'readonly',
  NotificationEvent: 'readonly',
  SyncEvent: 'readonly',
  Clients: 'readonly',
  Cache: 'readonly',
  CacheStorage: 'readonly',
  Client: 'readonly',
  WindowClient: 'readonly',
  RegistrationOptions: 'readonly',
  DedicatedWorkerGlobalScope: 'readonly',
  ServiceWorkerGlobalScope: 'readonly',
  // Global types
  GlobalThis: 'readonly',
  Component: 'readonly',
  HLJS: 'readonly',
  // Element Plus (auto-imported)
  ElMessage: 'readonly',
  ElMessageBox: 'readonly',
  ElNotification: 'readonly',
  ElLoading: 'readonly',
  // Vue Composition API (auto-imported)
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
  useRouter: 'readonly',
  useRoute: 'readonly',
  useSlots: 'readonly',
  useAttrs: 'readonly',
  // i18n global
  t: 'readonly',
  // UniApp globals
  uni: 'readonly',
  getCurrentPages: 'readonly',
  // UUID utility
  uuid: 'readonly',
  // Logger
  logger: 'readonly',
}

const commonPlugins = {
  '@typescript-eslint': ts,
  vue,
  // 自定义规则插件：ihui/markraw-icon, ihui/no-manual-cleanup
  ihui: {
    rules: {
      'markraw-icon': markrawIconRule,
      'no-manual-cleanup': noManualCleanupRule,
    },
  },
}

const commonRules = {
  ...ts.configs.recommended.rules,
  ...vue.configs['flat/recommended'].rules,
  'vue/multi-word-component-names': 'off',
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/ban-ts-comment': 'off',
  // 自定义规则：响应式对象中的组件 icon 必须使用 markRaw 包装
  'ihui/markraw-icon': 'error',
  // 自定义规则：禁止在 onUnmounted/onBeforeUnmount 中直接做清理，应使用 useCleanup composable
  'ihui/no-manual-cleanup': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
  'no-console': ['warn', { allow: ['warn', 'error', 'log', 'info', 'debug'] }],
  // P19-3: v-html XSS 防护 - 所有 v-html 均已通过 sanitizeHtml/DOMPurify/hljs.highlight/escapeHtml 处理
  // 项目统一 sanitize 工具: @/utils/htmlSanitizer, 新增 v-html 必须包 sanitizeHtml
  'vue/no-v-html': 'off',
}

export default [
  js.configs.recommended,
  // .vue 文件使用 vue-eslint-parser (支持 <template> 解析)
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
      globals: commonGlobals,
    },
    plugins: commonPlugins,
    rules: commonRules,
  },
  // .ts/.js/.tsx/.jsx 文件使用 @typescript-eslint/parser (避免 vue-eslint-parser 误报正则转义)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
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
      globals: commonGlobals,
    },
    plugins: commonPlugins,
    rules: {
      ...commonRules,
      // TypeScript 编译器已处理未定义变量检查, no-undef 在 TS 文件中会误报 ES 模块导入
      'no-undef': 'off',
      // 拦截未处理的 Promise（.then() 无 .catch() 或 async 无 try-catch），从源头杜绝未处理 rejection
      // 仅 .ts 文件启用（需类型信息），.vue 文件靠手动修复 + 第10轮修复覆盖
      '@typescript-eslint/no-floating-promises': 'warn',
    },
  },
  {
    files: ['*.js', '*.cjs', 'check-*.js', 'proxy-*.js', 'code-simplifier/**/*.js', 'config/**/*.js', 'packages/**/*.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['env.d.ts', '*.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  // OpenAPI Generator 自动生成的 SDK 文件 - 不要手写修改, 加新规则需更新生成器
  // 排除在 no-explicit-any 警告之外 (生成代码需兼容所有 API 响应类型)
  {
    files: ['src/api/v2-sdk/**/*.ts', 'src/api/generated-client.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // 测试文件配置
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx', '**/*.test.ts', '**/*.spec.ts', '**/*.e2e.ts', 'e2e/helpers/**/*.ts', '**/__tests__/**/*.ts'],
    languageOptions: {
      // 测试文件被 tsconfig.json 排除，关闭 project 避免解析错误
      parserOptions: { project: null },
      globals: {
        // Vitest / Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
        // Node.js test globals
        global: 'readonly',
        // DOM types for tests
        Document: 'readonly',
        // Web Crypto API types
        Crypto: 'readonly',
        CryptoKey: 'readonly',
      },
    },
    rules: {
      // 测试文件中放宽规则
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // 测试文件中允许 require() 动态导入模块
      '@typescript-eslint/no-require-imports': 'off',
      // 测试文件无类型信息，关闭需要类型信息的规则
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'off',
      'no-undef': 'off',
    },
  },
  {
    files: ['src/api/admin/**/*.ts', 'src/store/admin/**/*.ts', 'src/utils/admin/**/*.ts', 'src/views/admin-ruoyi/**', 'src/layout-admin/**', 'src/plugins/admin/**', 'src/components/admin-ruoyi/**'],
    languageOptions: {
      // 这些目录在 tsconfig.json 的 exclude 中, parserOptions.project 会失败
      parserOptions: { project: null },
    },
    rules: {
      // 关闭需要类型信息的规则
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      'public/**',
      '.eslintrc-auto-import.json',
      'test-*.js',
      'test-*.cjs',
      'test-*.ts',
      'scripts/**',
      'lib/**',
      'backend/**',
      'backend-docs/**',
      'miniapp/**',
      'storybook-static/**',
      'packages/shared-edu-api/**',
      'packages/shared-edu-types/**',
      '.storybook/**',
      'electron/**',
      'logs/**',
      'docs/**',
      'screenshots/**',
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
      'backups/**',
      'packages/**/dist/**',
      'packages/shared-tokens/build.js',
      'packages/shared-logic/sync.js',
      'packages/shared-logic/sync.config.js',
      'packages/shared-ui/index.js',
      'src/locales/_*.cjs',
    ],
  },
]
