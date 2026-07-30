/**
 * 中转站 Key 池健康巡检服务。
 *
 * 职责：
 * 1. checkAllKeys(): 巡检所有 is_enabled=true 的 key，更新 health_status
 * 2. checkSingleKey(keyId): 巡检单个 key（供 admin API 手动触发）
 * 3. 巡检方式：用 key 调上游 /v1/models 端点（轻量，不消耗 token）
 *    - 根据 provider_code 从 ai_model_config 表查 base_url
 *    - 200 = healthy, 401/403 = down（key 失效）, 429 = degraded（限流）, 超时/网络错误 = degraded
 * 4. 自动禁用：连续 3 次巡检 health_status='down' → is_enabled=false（熔断）
 */
import { eq, and } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { aiRelayKeyPool, aiModelConfig } from '@ihui/database'
import { decryptJSON, type EncryptedPayload } from '../utils/crypto.js'

const HEALTH_CHECK_TIMEOUT_MS = 10_000
const CONSECUTIVE_FAILURES_THRESHOLD = 3
const CF_KEY = 'consecutiveFailures'

export type HealthStatus = 'healthy' | 'degraded' | 'down'

export interface HealthCheckResult {
  keyId: string
  status: HealthStatus
  latencyMs: number
  errorMessage?: string
}

export interface HealthCheckSummary {
  total: number
  healthy: number
  degraded: number
  down: number
  disabled: number
}

interface KeyRowForCheck {
  id: string
  providerCode: string
  apiKeyEnc: string
  extraMetadata: unknown
}

/** 安全解析 extra_metadata 为可读结构（保留未知字段以避免 clobber）。 */
function readExtraMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {}
  }
  return raw as Record<string, unknown>
}

/** 从 extra_metadata 读取连续失败次数。 */
function readConsecutiveFailures(meta: Record<string, unknown>): number {
  const v = meta[CF_KEY]
  return typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0
}

/** 解密 api_key_enc（存储格式：JSON.stringify(encryptJSON(plainKey))）。 */
function decryptApiKey(apiKeyEnc: string): string {
  const payload = JSON.parse(apiKeyEnc) as EncryptedPayload
  const plain = decryptJSON(payload)
  return typeof plain === 'string' ? plain : String(plain)
}

/** 按 providerCode 查 ai_model_config.base_url（取启用且第一条）。 */
async function findBaseUrlByProvider(providerCode: string): Promise<string | null> {
  const [row] = await dbRead
    .select({ baseUrl: aiModelConfig.baseUrl })
    .from(aiModelConfig)
    .where(and(eq(aiModelConfig.providerCode, providerCode), eq(aiModelConfig.enabled, true)))
    .limit(1)
  return row?.baseUrl ?? null
}

/** 规范化 base_url（去尾部斜杠），拼接 /v1/models。 */
function buildModelsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/v1/models`
}

/** 用 AbortController 实现 fetch 超时。返回状态与可选错误信息。 */
async function pingModelsEndpoint(
  url: string,
  apiKey: string,
): Promise<{ status: HealthStatus; errorMessage?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    if (res.status === 200) return { status: 'healthy' }
    if (res.status === 401 || res.status === 403) {
      return { status: 'down', errorMessage: `HTTP ${res.status}: key 失效或无权访问` }
    }
    if (res.status === 429) {
      return { status: 'degraded', errorMessage: 'HTTP 429: 限流' }
    }
    return { status: 'degraded', errorMessage: `HTTP ${res.status}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { status: 'degraded', errorMessage: msg }
  } finally {
    clearTimeout(timer)
  }
}

/** 执行一次巡检（解密 + 查 base_url + ping），不写 DB。 */
async function runHealthCheck(row: KeyRowForCheck): Promise<HealthCheckResult> {
  const startedAt = Date.now()

  let apiKey: string
  try {
    apiKey = decryptApiKey(row.apiKeyEnc)
  } catch (err) {
    return {
      keyId: row.id,
      status: 'down',
      latencyMs: Date.now() - startedAt,
      errorMessage: `解密失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const baseUrl = await findBaseUrlByProvider(row.providerCode)
  if (!baseUrl) {
    return {
      keyId: row.id,
      status: 'degraded',
      latencyMs: Date.now() - startedAt,
      errorMessage: `未找到 provider=${row.providerCode} 的 base_url`,
    }
  }

  const ping = await pingModelsEndpoint(buildModelsUrl(baseUrl), apiKey)
  return {
    keyId: row.id,
    status: ping.status,
    latencyMs: Date.now() - startedAt,
    errorMessage: ping.errorMessage,
  }
}

/**
 * 持久化巡检结果到 DB。
 * - 更新 health_status / health_checked_at / last_error_message
 * - 更新 extra_metadata.consecutiveFailures（down +1, healthy 重置 0, degraded 不变）
 * - 连续 3 次 down → is_enabled=false（熔断）
 * 返回是否触发了自动禁用。
 */
async function persistResult(row: KeyRowForCheck, result: HealthCheckResult): Promise<boolean> {
  const meta = readExtraMetadata(row.extraMetadata)
  const prevFailures = readConsecutiveFailures(meta)

  let newFailures: number
  if (result.status === 'down') {
    newFailures = prevFailures + 1
  } else if (result.status === 'healthy') {
    newFailures = 0
  } else {
    newFailures = prevFailures
  }

  const shouldDisable = result.status === 'down' && newFailures >= CONSECUTIVE_FAILURES_THRESHOLD

  await db
    .update(aiRelayKeyPool)
    .set({
      healthStatus: result.status,
      healthCheckedAt: new Date(),
      lastErrorMessage: result.errorMessage ?? null,
      extraMetadata: { ...meta, [CF_KEY]: newFailures },
      ...(shouldDisable ? { isEnabled: false } : {}),
      updatedAt: new Date(),
    })
    .where(eq(aiRelayKeyPool.id, row.id))

  return shouldDisable
}

/** 巡检单个 key：解密 key → 查 base_url → ping /v1/models → 更新 DB。 */
export async function checkSingleKey(keyId: string): Promise<HealthCheckResult> {
  const [row] = await dbRead
    .select({
      id: aiRelayKeyPool.id,
      providerCode: aiRelayKeyPool.providerCode,
      apiKeyEnc: aiRelayKeyPool.apiKeyEnc,
      extraMetadata: aiRelayKeyPool.extraMetadata,
    })
    .from(aiRelayKeyPool)
    .where(eq(aiRelayKeyPool.id, keyId))
    .limit(1)

  if (!row) {
    return { keyId, status: 'down', latencyMs: 0, errorMessage: 'Key 不存在' }
  }

  const result = await runHealthCheck(row)
  await persistResult(row, result)
  return result
}

/** 巡检所有 is_enabled=true 的 key。返回各状态计数（串行避免上游并发冲击）。 */
export async function checkAllKeys(): Promise<HealthCheckSummary> {
  const keys = await dbRead
    .select({
      id: aiRelayKeyPool.id,
      providerCode: aiRelayKeyPool.providerCode,
      apiKeyEnc: aiRelayKeyPool.apiKeyEnc,
      extraMetadata: aiRelayKeyPool.extraMetadata,
    })
    .from(aiRelayKeyPool)
    .where(eq(aiRelayKeyPool.isEnabled, true))

  const summary: HealthCheckSummary = {
    total: keys.length,
    healthy: 0,
    degraded: 0,
    down: 0,
    disabled: 0,
  }

  for (const row of keys) {
    try {
      const result = await runHealthCheck(row)
      const disabled = await persistResult(row, result)
      summary[result.status]++
      if (disabled) summary.disabled++
    } catch (err) {
      // 意外错误（DB 异常等），计为 degraded 但不中断巡检
      summary.degraded++
      void err
    }
  }

  return summary
}
