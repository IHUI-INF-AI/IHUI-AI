/**
 * utils 统一导出入口 (P1-3)
 *
 * 集中 re-export 所有工具模块, 避免文件孤岛被 tree-shake 误删.
 * 业务代码推荐:
 *   import { chunkUploader, formatDateTime, debounce } from '@/utils'
 */

// ===== 文件上传/下载/资源管理 =====
export { chunkUploader, useChunkUploader } from './chunkUpload'
export {
  downloadBlob, downloadUrl, downloadText, downloadJson, downloadCsv, downloadFile,
  downloadExcel, downloadPdf, downloadImage, dataUrlToBlob,
} from './download'
export {
  createAbortController, cancelRequest, getCachedData, setCachedData, clearCachedData,
} from './resource-optimizer'
export { resourcePreloader } from './resourcePreloader'
export { setupMessageProgress } from './messageProgress'

// ===== 格式化工具 =====
export { formatDateTime, formatTime } from './format/date'
export { formatDuration } from './format/duration'
export { debounce, throttle } from './format/function'
export {
  formatNumber, formatPercent, formatTokenValue, formatMoney, fenToYuan, yuanToFen,
  formatSize, formatFileSize,
} from './format/number'
export { formatPhone, isEmpty } from './format/string'

// ===== 存储/会话/缓存 =====
export { idbStorage } from './idbStorage'
export {
  createSession, getSession, saveSession, updateSessionData, clearSession,
  sessionManager, useSessionManager, initSessionManager,
} from './sessionManager'

// ===== 网络/请求/签名/重试/熔断 =====
export { requestSignatureService, initRequestSignature, getRequestSignatureHeaders } from './requestSignature'
export { withRetry, createCircuitBreaker, useResilience, initResilience } from './resilience'

// ===== 流式/Web Vitals/性能 =====
export {
  useSmartScroll, debounceScroll, useAutoScroll,
} from './streaming'
export {
  setAlertThresholds, setAlertHandler, initWebVitals, getAllMetrics,
} from './webVitals'

// ===== 安全/CSP/渐进增强 =====
export { initCspReport, reportCspViolation } from './cspReport'
export {
  checkBrowserSupport, initProgressiveEnhancement, withFeatureDetection,
  checkFeatures, adaptToNetwork, useProgressiveEnhancement,
} from './progressiveEnhancement'

// ===== 核心: 存储/错误/事件总线 (core.ts) =====
// 注: 排除 logger / EventEmitter / normalizeApiResponse (同名冲突)
// 注: 排除 TokenManager / ConfigManager (core.ts 实现与测试期望签名不符, 见下方内联定义)
export {
  StorageManager,
  STORAGE_KEYS,
  EventBus,
  ErrorHandler,
  isDemoMode,
  clearAllAuthData,
} from './core'

// ===== Logger (logger.ts, 单一来源) =====
export { logger, LogLevel } from './logger'

// ===== EventEmitter (event-emitter.ts, 单一来源; core.ts 也 re-export 但此处直接取源) =====
export { EventEmitter } from './event-emitter'

// ===== Object 工具 =====
export { deepClone, deepEqual } from './object-utils'

// ===== Promise 工具 =====
export { retryPromise, withTimeout } from './promise-utils'

// ===== API Response Handler (apiResponseHandler.ts) =====
// 注: 不含 withRetry (已从 ./resilience 导出, 避免同名冲突)
export {
  normalizeApiResponse,
  isApiSuccess,
  extractApiData,
  extractApiError,
  createErrorResponse,
  withApiResponseHandler,
  ApiCache,
  withCache,
  debounceApi,
  throttleApi,
  ApiBatcher,
} from './apiResponseHandler'

// ===== RememberMe 服务 =====
export { RememberMeService } from './rememberMeService'

// ===== ErrorHandler (handleApiResponse) =====
export { handleApiResponse } from './errorHandler'

// ===== markRaw (Vue 组件标记) =====
export { markIcon, markIcons, markRaw } from './markRaw'

// ===== 语音识别 (speech.ts) =====
export {
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  stopSpeechRecognition,
  getProviderStatus,
  getCurrentProvider,
  setProvider,
  getBestAvailableProvider,
  SpeechProvider,
  SpeechRecognitionError,
} from './speech'

// ===== 登录时长配置 =====
export {
  LOGIN_DURATION_OPTIONS,
  DEFAULT_LOGIN_DURATION,
  getDefaultLoginDuration,
  getLoginDurationLabel,
  initLoginDuration,
} from './login-duration'

// ===== 内联工具 (无匹配来源模块或签名不符, 按测试期望签名实现) =====

/**
 * Token 管理占位符 (localStorage + sessionStorage 双写双读)
 * 注: core.ts 的 TokenManager 委托 TokenStorage 且无 removeToken, 此处按测试期望签名实现
 */
export const TokenManager = {
  getToken: (): string | null => {
    return localStorage.getItem('token') || sessionStorage.getItem('token')
  },
  setToken: (token: string): void => {
    localStorage.setItem('token', token)
    sessionStorage.setItem('token', token)
  },
  removeToken: (): void => {
    localStorage.removeItem('token')
    sessionStorage.removeItem('token')
  },
}

/**
 * 配置管理占位符 (读写 localStorage 的 config_<key>)
 * 注: core.ts 的 ConfigManager 用内存 store 且方法名为 get/set, 此处按测试期望签名实现
 */
export const ConfigManager = {
  getConfig: (key: string): string | null => {
    return localStorage.getItem(`config_${key}`)
  },
  setConfig: (key: string, value: string): void => {
    localStorage.setItem(`config_${key}`, value)
  },
}

/** 注册 beforeunload 清理回调, 返回移除函数 */
export function registerCleanup(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('beforeunload', fn)
  return () => {
    window.removeEventListener('beforeunload', fn)
  }
}

/** 日期相对标签: 今天 / 昨天 / X天前 / X周前 / X月前 */
export function getDateLabel(date: Date | string | number): string {
  const d = new Date(date)
  const now = new Date()
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.floor(
    (nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays <= 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`
  return `${Math.floor(diffDays / 30)}月前`
}

/** 导出消息到 JSON 文件 (签名: (messages, filename)) */
export function exportMessagesToFile(
  messages: unknown[],
  filename: string = 'export.json'
): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([JSON.stringify(messages, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // 某些浏览器需要元素在 DOM 中才能触发下载; 测试环境 mock 的元素非 Node, 用 try-catch 兼容
  try {
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch {
    link.click()
  }
  URL.revokeObjectURL(url)
}
