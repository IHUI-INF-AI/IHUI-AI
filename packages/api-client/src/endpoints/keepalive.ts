// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号保活中心 API 端点(2026-10-26 新增)。
 *
 * 对应后端 `app/routers/keepalive.py`(前缀 /api/keepalive)。
 * 与 publish.ts 里那组 `/publish/cookie-refresh/*` 的关系:那组只覆盖发布线 Cookie,
 * 本组是**三条线(cookie / 密钥到期 / 签到凭证)的统一状态面** —— 账号页只读本组,
 * 不必再分别问两个来源。
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 健康度四档。后端 policy.health_of 是唯一判据,前端只做展示,不重算。 */
export type KeepaliveHealth = 'healthy' | 'warning' | 'critical' | 'unknown'

export type KeepaliveSource = 'publish_cookie' | 'publish_token' | 'checkin'

export interface KeepalivePolicy {
  retry_max: number
  retry_base_seconds: number
  retry_cap_seconds: number
  alert_after_failures: number
  alert_repeat_hours: number
  expire_warn_days: number
}

export interface KeepaliveConfig {
  enabled: boolean
  /** 为什么启用/未启用。未启用时必须能说出缺哪个键 —— 不许静默。 */
  enabled_reason: string
  interval_hours: number
  alert_webhook_configured: boolean
  event_retention_days: number
  policy: KeepalivePolicy
}

export interface KeepaliveRoundSummary {
  started_at: string | null
  finished_at: string | null
  total: number
  ok: number
  failed: number
  skipped: number
  unsupported: number
  warned: number
  alerted: number
  // unsupported 与 failed 是两档:前者是"这账号本来就不需要保活"(如 api_key 类),
  // 后端已把它们从 failed 里摘出来 —— 前端别再把两者相加当故障数。
  by_source: Record<
    string,
    { total: number; ok: number; failed: number; skipped: number; unsupported: number }
  >
}

export interface KeepaliveStatus {
  config: KeepaliveConfig
  self_check: string
  running: boolean
  /** 调度任务是否真的活着(不是"配置里写了启用")。 */
  scheduler_alive: boolean
  probes: string[]
  last_round: KeepaliveRoundSummary | null
  next_run_eta_hours: number | null
}

export interface KeepaliveAccountState {
  ref: string
  source: KeepaliveSource
  account_id: number
  platform: string
  display: string
  health: KeepaliveHealth
  consecutive_failures: number
  last_ok_at: string | null
  last_fail_at: string | null
  next_retry_at: string | null
  expires_at: string | null
  expiring_soon: boolean
  last_error: string | null
  last_error_kind: string | null
  alerted_at: string | null
  updated_at: string | null
}

export interface KeepaliveRateBucket {
  ok: number
  failed: number
  total: number
  rate: number | null
}

export interface KeepaliveOverview {
  generated_at: string
  total: number
  counts: Record<KeepaliveHealth, number>
  by_source: Record<string, Record<KeepaliveHealth, number>>
  needs_attention: KeepaliveAccountState[]
  expiring_soon: KeepaliveAccountState[]
  success_rate_7d: Record<string, KeepaliveRateBucket>
  config: KeepaliveConfig
}

export interface KeepaliveEvent {
  id: number
  ref: string
  source: KeepaliveSource
  ok: boolean
  kind: string
  message: string
  duration_ms: number
  attempt: number
  created_at: string | null
  unsupported: boolean
}

export interface KeepaliveTriggerResult {
  triggered: boolean
  ref: string | null
}

export async function getKeepaliveStatus(): Promise<ApiResult<KeepaliveStatus>> {
  return fetchApi('/api/keepalive/status')
}

export async function getKeepaliveOverview(): Promise<ApiResult<KeepaliveOverview>> {
  return fetchApi('/api/keepalive/overview')
}

export async function listKeepaliveAccounts(params?: {
  source?: KeepaliveSource
  health?: KeepaliveHealth
}): Promise<ApiResult<{ total: number; items: KeepaliveAccountState[] }>> {
  const query = new URLSearchParams()
  if (params?.source) query.set('source', params.source)
  if (params?.health) query.set('health', params.health)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return fetchApi(`/api/keepalive/accounts${suffix}`)
}

export async function listKeepaliveEvents(params?: {
  ref?: string
  limit?: number
  onlyFailures?: boolean
}): Promise<ApiResult<{ total: number; items: KeepaliveEvent[] }>> {
  const query = new URLSearchParams()
  if (params?.ref) query.set('ref', params.ref)
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.onlyFailures) query.set('only_failures', 'true')
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return fetchApi(`/api/keepalive/events${suffix}`)
}

export async function runKeepalive(params?: {
  ref?: string
  force?: boolean
}): Promise<ApiResult<KeepaliveTriggerResult>> {
  const query = new URLSearchParams()
  if (params?.ref) query.set('ref', params.ref)
  if (params?.force !== undefined) query.set('force', String(params.force))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return fetchApi(`/api/keepalive/run${suffix}`, { method: 'POST' })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
