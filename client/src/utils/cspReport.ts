// CSP 违规上报：将浏览器 securitypolicyviolation 事件 POST 到后端
// 后端可转发到 Sentry（sentry.io/api/<project>/security/?sentry_key=...）
// 也可转发到自建收集服务
import { CSP_REPORT_URL, SENTRY_DSN } from '../../config/csp'

interface CspViolation {
  'blocked-uri': string
  'document-uri': string
  'effective-directive': string
  'original-policy': string
  'referrer': string
  'violated-directive': string
  'source-file': string
  'line-number': number
  'column-number': number
  'status-code': number
  'disposition': string
}

/**
 * 上报单个 CSP 违规到 Sentry / 自建端点
 */
function reportToSentry(violation: CspViolation): void {
  if (!SENTRY_DSN) return
  const url = new URL(SENTRY_DSN)
  const projectId = url.pathname.split('/').pop()
  const reportUrl = `${url.protocol}//${url.host}/api/${projectId}/security/?sentry_key=${url.username}`
  navigator.sendBeacon(reportUrl, JSON.stringify({
    exception: { values: [{ type: 'CSPViolation', value: violation['violated-directive'] }] },
    tags: { blocked_uri: violation['blocked-uri'] }
  }))
}

/**
 * 上报到自建端点
 */
function reportToLocal(violation: CspViolation): void {
  if (!CSP_REPORT_URL) return
  navigator.sendBeacon(CSP_REPORT_URL, JSON.stringify({
    'csp-report': violation,
    'app': 'officialsite',
    'time': new Date().toISOString(),
  }))
}

/**
 * 初始化 CSP 违规监听（应在 App.vue onMounted 调用）
 */
export function initCspReport(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('securitypolicyviolation', (e) => {
    const violation: CspViolation = {
      'blocked-uri': e.blockedURI,
      'document-uri': e.documentURI,
      'effective-directive': e.effectiveDirective,
      'original-policy': e.originalPolicy,
      'referrer': e.referrer,
      'violated-directive': e.violatedDirective,
      'source-file': e.sourceFile,
      'line-number': e.lineNumber || 0,
      'column-number': e.columnNumber || 0,
      'status-code': e.statusCode,
      'disposition': e.disposition,
    }
    // 双路上报
    reportToSentry(violation)
    reportToLocal(violation)
  })
}
