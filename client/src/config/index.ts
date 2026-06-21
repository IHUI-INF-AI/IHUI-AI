/**
 * 项目配置管理
 * 统一管理项目中的各种配置，包括路径别名、代理配置、环境变量等
 */

import { resolve } from 'path'

// 导出 OpenClaw 配置
export * from './openclaw.config'
export { default as openclawConfig } from './openclaw.config'

// 路径别名配置
export const pathAliases = {
  '@': resolve(__dirname, '../'),
  open: resolve(__dirname, '../open-platform'),
  'lucide-vue-next': resolve(__dirname, '../lib/lucide-fallback.ts'),
  // 注意：projects 目录已不再使用，但保留路径别名以兼容未来可能的需求
  '~projects': resolve(__dirname, '../../projects'),
  vue: 'vue/dist/vue.esm-bundler.js',
}

// 开发服务器端口配置 - 统一使用8888端口
export const devServerConfig = {
  // 主项目端口（严格限制）
  port: 8888,
  // 后台管理端口 - 统一使用8888
  adminPort: 8888,
  // 开放平台端口 - 统一使用8888
  openPlatformPort: 8888,
  // 后端API端口 - 统一使用8888
  apiPort: 8888,
}

// 支持的语言列表（仅支持：中文、英文、日文、韩文）
export const supportedLanguages = [
  { file: 'zh-CN.json', code: 'zh-CN' },
  { file: 'zh-TW.json', code: 'zh-TW' },
  { file: 'en.json', code: 'en' },
  { file: 'ja.json', code: 'ja' },
  { file: 'ko.json', code: 'ko' },
]

// 静态资源类型映射
export const mimeTypeMap: Record<string, string> = {
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
}

// 构建相关配置
export const buildConfig = {
  // chunk体积警告限制
  chunkSizeWarningLimit: 2000,
  // 构建目标
  target: 'es2020',
  // 生产环境是否生成sourcemap
  sourcemap: false,
}

// 组件自动导入配置
export const autoImportConfig = {
  imports: ['vue', 'vue-router', 'pinia'],
  dirs: [
    'src/components/design-system',
    'src/components/agents',
    'src/components/ai',
    'src/components/auth',
    'src/components/common',
    'src/components/header',
    'src/components/home',
    'src/components/login',
    'src/components/mcp',
    'src/components/statistics',
    'src/components/user',
  ],
  exclude: [/ElLoadingSpinner/, /src\/components\/ui\//],
}
