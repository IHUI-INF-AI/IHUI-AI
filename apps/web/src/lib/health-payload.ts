// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-35：后端 `GET /api/health` 与 web 端读取契约的**前端归一化**。
 *
 * 两端真实形状（取证于 2026-11-02）：
 * - 后端 `apps/api/src/routes/health.ts` 的 `/health` 返回**裸单对象**
 *   `{ status, service, timestamp, uptime, redis }`（注册面 `apps/api/src/routes/index.ts` 的 `prefix: '/api'`）；
 * - web `apps/web/app/(main)/admin/backend-health/page.tsx` 原先按 `ServiceStatus[]` 读，
 *   `services.filter(...)` 落到普通对象上必抛 `TypeError: services.filter is not a function`，整页崩。
 *
 * 裁决：后端一个字不改，前端在数据入口做唯一一次归一化。
 * 单对象包成一项、数组逐项校验；未知/缺字段一律落 `'unknown'`，
 * **绝不默认 healthy** —— 没被判过的字段不能当绿。
 */

/** 归一化后的三态：正常 / 异常 / 无法判定（缺字段或类型不符）。 */
export type ServiceHealthState = 'healthy' | 'unhealthy' | 'unknown'

export interface ServiceStatus {
  name: string
  status: ServiceHealthState
  /**
   * 后端 `/api/health` 不含延迟字段，取不到时为 `null`。
   * 不伪造 `0`：0ms 会被 UI 当成"最快"，而事实是没测过。
   */
  latency: number | null
  message?: string
}

/**
 * 入口允许的两种形状：单对象（当前后端真实返回）或数组（页面历史声明/未来契约）。
 * 调用方不得在此之后自行按数组取值，必须先过 `normalizeHealthPayload`。
 */
export type HealthPayload = ServiceStatus | ServiceStatus[]

/** 后端显式正常词表：ok 是 `/health` 的实况，ready/alive/up 覆盖同族探针。 */
const HEALTHY_STATES = new Set(['healthy', 'ok', 'ready', 'alive', 'up'])

/** 后端显式异常词表：degraded 来自 `/health/ready`，down 来自 redis 状态。 */
const UNHEALTHY_STATES = new Set(['unhealthy', 'error', 'degraded', 'down', 'fail', 'failed'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toHealthState(value: unknown): ServiceHealthState {
  if (typeof value !== 'string') return 'unknown'
  const normalized = value.trim().toLowerCase()
  if (HEALTHY_STATES.has(normalized)) return 'healthy'
  if (UNHEALTHY_STATES.has(normalized)) return 'unhealthy'
  return 'unknown'
}

function toName(item: Record<string, unknown>): string {
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  if (name) return name
  // 裸对象没有 name：后端实际字段是 service（如 '@ihui/api'）。
  const service = typeof item.service === 'string' ? item.service.trim() : ''
  return service || 'unknown'
}

function toLatency(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

function toMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const message = value.trim()
  return message || undefined
}

function normalizeItem(value: unknown): ServiceStatus {
  if (!isRecord(value)) {
    // 数组里混入 null/字符串等非对象项：显式落 unknown，不静默丢弃。
    return { name: 'unknown', status: 'unknown', latency: null }
  }
  const item: ServiceStatus = {
    name: toName(value),
    status: toHealthState(value.status),
    latency: toLatency(value.latency),
  }
  const message = toMessage(value.message)
  if (message !== undefined) item.message = message
  return item
}

/** 把后端响应统一成内部数组；无法识别的顶层形状返回空数组（页面落"暂无数据"）。 */
export function normalizeHealthPayload(raw: unknown): ServiceStatus[] {
  if (Array.isArray(raw)) return raw.map(normalizeItem)
  if (isRecord(raw)) return [normalizeItem(raw)]
  return []
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
