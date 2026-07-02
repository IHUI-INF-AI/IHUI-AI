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
