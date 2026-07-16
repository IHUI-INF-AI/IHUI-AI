import { logger } from '../utils/logger.js'
import { rollbackCanary as dbRollbackCanary } from './canary-service.js'

/**
 * 金丝雀自动回滚服务：定时监控金丝雀版本错误率，超阈值时自动回滚。
 *
 * 配置（env）：
 * - CANARY_ERROR_RATE_THRESHOLD  错误率阈值 0-1（默认 0.05，即 5%）
 * - CANARY_CHECK_INTERVAL_MS     检查间隔毫秒（默认 60000，即 1 分钟）
 * - PROMETHEUS_URL               Prometheus 查询地址（默认 http://localhost:9090）
 * - CANARY_CONFIG_NAME           DB 中 canary_configs 表的配置名（用于调用 canary-service 回滚）
 */

const ERROR_RATE_THRESHOLD = Number(process.env.CANARY_ERROR_RATE_THRESHOLD ?? 0.05)
const CHECK_INTERVAL_MS = Number(process.env.CANARY_CHECK_INTERVAL_MS ?? 60000)

let checkInterval: NodeJS.Timeout | null = null

export interface CanaryHealthStatus {
  errorRate: number
  threshold: number
  healthy: boolean
  rolledBack: boolean
}

/**
 * 检查金丝雀版本健康状态。从 Prometheus 读取错误率，超阈值时自动回滚。
 */
export async function checkCanaryHealth(): Promise<CanaryHealthStatus> {
  const errorRate = await fetchCanaryErrorRate()
  const healthy = errorRate < ERROR_RATE_THRESHOLD

  if (!healthy) {
    logger.warn('[auto-rollback] canary error rate exceeded threshold', {
      errorRate,
      threshold: ERROR_RATE_THRESHOLD,
    })
    await rollbackCanary(
      `auto-rollback: error rate ${errorRate} exceeded threshold ${ERROR_RATE_THRESHOLD}`,
    )
    return { errorRate, threshold: ERROR_RATE_THRESHOLD, healthy: false, rolledBack: true }
  }

  return { errorRate, threshold: ERROR_RATE_THRESHOLD, healthy: true, rolledBack: false }
}

/**
 * 回滚金丝雀：将 canary 流量百分比设为 0，并记录回滚事件。
 * 若 CANARY_CONFIG_NAME 已配置，同步调用 canary-service 的 DB 级回滚。
 */
export async function rollbackCanary(reason: string): Promise<void> {
  logger.error('[auto-rollback] rolling back canary', { reason })

  process.env.CANARY_PERCENTAGE = '0'
  process.env.CANARY_ENABLED = 'false'

  const configName = process.env.CANARY_CONFIG_NAME
  if (configName) {
    try {
      await dbRollbackCanary(configName, reason)
      logger.info('[auto-rollback] DB canary config rolled back', { configName })
    } catch (err) {
      logger.error('[auto-rollback] DB rollback failed', {
        configName,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (checkInterval) {
    stopAutoRollbackMonitor()
  }
}

/**
 * 从 Prometheus 查询金丝雀版本错误率。
 * 查询指标：canary 请求中 5xx 状态码占比。
 * 若 Prometheus 不可达，返回 0（假设健康，避免误回滚）。
 */
async function fetchCanaryErrorRate(): Promise<number> {
  const prometheusUrl = process.env.PROMETHEUS_URL ?? 'http://localhost:9090'
  const query = encodeURIComponent(
    'sum(rate(http_requests_by_status{status=~"5..",served_by="canary"}[1m])) / ' +
      'sum(rate(http_requests_by_status{served_by="canary"}[1m]))',
  )

  try {
    const res = await fetch(`${prometheusUrl}/api/v1/query?query=${query}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      logger.warn('[auto-rollback] prometheus query failed', { status: res.status })
      return 0
    }

    const data = (await res.json()) as {
      status: string
      data?: { result?: Array<{ value?: [number, string] }> }
    }
    if (data.status !== 'success' || !data.data?.result?.length) return 0

    const value = data.data.result[0]?.value?.[1]
    return value ? Number(value) : 0
  } catch (err) {
    logger.warn('[auto-rollback] failed to fetch error rate from prometheus', {
      error: err instanceof Error ? err.message : String(err),
    })
    return 0
  }
}

/**
 * 启动自动回滚定时监控。仅当 CANARY_ENABLED=true 时启动。
 */
export function startAutoRollbackMonitor(): void {
  if (checkInterval) return
  if (process.env.CANARY_ENABLED !== 'true') return

  checkInterval = setInterval(async () => {
    try {
      await checkCanaryHealth()
    } catch (err) {
      logger.error('[auto-rollback] health check failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, CHECK_INTERVAL_MS)

  logger.info('[auto-rollback] monitor started', {
    threshold: ERROR_RATE_THRESHOLD,
    intervalMs: CHECK_INTERVAL_MS,
  })
}

/**
 * 停止自动回滚定时监控。
 */
export function stopAutoRollbackMonitor(): void {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
    logger.info('[auto-rollback] monitor stopped')
  }
}
