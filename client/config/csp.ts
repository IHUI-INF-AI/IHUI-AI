/**
 * Content Security Policy 统一配置
 *
 * 唯一来源：本文件被以下 4 处引用：
 *   1. vite.config.ts 的 dev server middleware（第 157 行）
 *   2. vite.config.ts 的 /ai-world/ 特殊 HTML 响应（第 420 行）
 *   3. vite.config.ts 的 /ai-world/ 目录 HTML 响应（第 456 行）
 *   4. vite.config.ts 的 server.headers（第 1106 行）
 *   5. nginx-production.conf 的 add_header（第 49 行）
 *   6. index.html 的 <meta http-equiv="Content-Security-Policy">（第 187 行，作为后备）
 *
 * 维护流程：
 *   - 修改本文件后，必须同步 6 处
 *   - 跑 npm run check:csp 校验一致性
 */

export interface CspConfig {
  /** script-src 允许的源 */
  scriptSrc: string[]
  /** style-src 允许的源 */
  styleSrc: string[]
  /** img-src 允许的源 */
  imgSrc: string[]
  /** media-src 允许的源 */
  mediaSrc: string[]
  /** font-src 允许的源 */
  fontSrc: string[]
  /** connect-src 允许的源 */
  connectSrc: string[]
  /** frame-src 允许的源 */
  frameSrc: string[]
  /** worker-src 允许的源 */
  workerSrc: string[]
  /** child-src 允许的源 */
  childSrc: string[]
}

const CDN_SOURCES = [
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com',
  'https://unpkg.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]

const DEV_HOST_SOURCES = [
  'http://localhost:*',
  'http://127.0.0.1:*',
]

const ANALYTICS_SOURCES = [
  'https://pv.sohu.com',
  'https://imgcache.qq.com',
]

const WECHAT_SOURCES = [
  'https://res.wx.qq.com',
  'https://open.weixin.qq.com',
  'http://res.wx.qq.com',
  'http://open.weixin.qq.com',
]

const API_SOURCES = [
  'https://api.aizhihui.com',
  'https://bsm.aizhs.top',
  'https://zca.aizhs.top',
]

const IMAGE_SOURCES = [
  'https://images.unsplash.com',
  'https://images.weserv.nl',
  'https://wsrv.nl',
]

/** 通用 CSP：开发与生产都可用 */
export const COMMON_CSP: CspConfig = {
  scriptSrc: ["'self'", "'unsafe-inline'", 'blob:', ...CDN_SOURCES, ...ANALYTICS_SOURCES, ...WECHAT_SOURCES],
  styleSrc: ["'self'", "'unsafe-inline'", ...CDN_SOURCES],
  imgSrc: ["'self'", 'data:', 'https:', 'blob:', ...IMAGE_SOURCES],
  mediaSrc: ["'self'", 'blob:', 'data:', 'https:'],
  fontSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'ws:', 'wss:', 'https:', ...API_SOURCES, ...WECHAT_SOURCES, ...CDN_SOURCES],
  frameSrc: ["'self'", 'https://bsm.aizhs.top', ...WECHAT_SOURCES],
  workerSrc: ["'self'", 'blob:', 'https://cdnjs.cloudflare.com', 'https://unpkg.com'],
  childSrc: ["'self'", 'blob:'],
}

/** 开发环境专用：增加 dev host、unsafe-eval、localhost 代理 */
export const DEV_CSP: CspConfig = {
  ...COMMON_CSP,
  scriptSrc: [...COMMON_CSP.scriptSrc, "'unsafe-eval'"],
  imgSrc: [...COMMON_CSP.imgSrc, ...DEV_HOST_SOURCES, 'http:'],
  mediaSrc: [...COMMON_CSP.mediaSrc, ...DEV_HOST_SOURCES, 'http:'],
  fontSrc: [...COMMON_CSP.fontSrc, 'http:'],
  connectSrc: [...COMMON_CSP.connectSrc, ...DEV_HOST_SOURCES],
  frameSrc: [...COMMON_CSP.frameSrc, ...DEV_HOST_SOURCES],
}

/**
 * 将 CspConfig 序列化为 CSP 字符串
 * 同时保留 report-uri（兼容旧浏览器）和 report-to（现代标准）
 *
 * 注意：meta 标签不支持 report-uri / report-to 指令（浏览器忽略并警告），
 * 走 deliverViaHeader=false 时仅输出可被 meta 识别的指令。
 */
export function serializeCsp(csp: CspConfig, _reportOnly = false, deliverViaHeader = true): string {
  const parts = [
    `default-src 'self'`,
    `script-src ${csp.scriptSrc.join(' ')}`,
    `style-src ${csp.styleSrc.join(' ')}`,
    `img-src ${csp.imgSrc.join(' ')}`,
    `media-src ${csp.mediaSrc.join(' ')}`,
    `font-src ${csp.fontSrc.join(' ')}`,
    `connect-src ${csp.connectSrc.join(' ')}`,
    `frame-src ${csp.frameSrc.join(' ')}`,
    `worker-src ${csp.workerSrc.join(' ')}`,
    `child-src ${csp.childSrc.join(' ')}`,
  ]
  // meta 标签忽略 report-uri / report-to，加了会触发浏览器警告
  if (deliverViaHeader) {
    parts.push(`report-to csp-reporting`)
    parts.push(`report-uri /api/csp-report`)
  }
  return parts.join('; ')
}

/** Reporting API 的 Report-To header 值 */
export const REPORT_TO_HEADER = JSON.stringify({
  group: 'csp-reporting',
  max_age: 86400,
  endpoints: [{ url: '/api/csp-report' }],
})

export const DEV_CSP_STRING = serializeCsp(DEV_CSP)
export const PROD_CSP_STRING = serializeCsp(COMMON_CSP)
/** Report-Only 版本：仅上报违规不阻止，方便收紧策略 */
export const REPORT_ONLY_CSP_STRING = serializeCsp(COMMON_CSP, true)
/** CSP 违规上报地址（Sentry 收 CSP 报告的端点） */
export const CSP_REPORT_URL = '/api/csp-report'
/** 上报到 Sentry 的项目 DSN（项目专用，请替换为真实值） */
// 兼容 Vite 与 Node 直接执行（tsx 跑 sync-csp.ts 时 import.meta.env 可能不存在）
const viteEnv = (import.meta as { env?: Record<string, string> }).env
export const SENTRY_DSN = viteEnv?.VITE_SENTRY_DSN || ''
