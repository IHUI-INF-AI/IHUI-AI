/**
 * AI 能力发现服务。
 *
 * 自动发现系统中可用的 AI 能力（provider + model + 功能组合）：
 * - 扫描已注册的 ai_capabilities 表
 * - 探测 provider 端点（健康检查 ping）
 * - 按需分类汇总（text/image/audio/video/multimodal）
 * - 暴露给前端"能力列表"页面
 */

import { eq, and } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { aiCapabilities, type AiCapability } from '@ihui/database'

export interface DiscoveredCapability {
  id: string
  name: string
  displayName: string
  category: string
  provider: string
  version: string
  status: string
  enabled: boolean
  reachable: boolean
  lastCheckedAt: Date | null
}

export interface ProviderHealth {
  provider: string
  reachable: boolean
  latencyMs: number | null
  checkedAt: Date
}

const providerEndpoints: Map<string, string> = new Map([
  ['openai', 'https://api.openai.com/v1/models'],
  ['anthropic', 'https://api.anthropic.com/v1/messages'],
  ['google', 'https://generativelanguage.googleapis.com/v1/models'],
  ['azure', ''], // 由配置注入
  ['local', 'http://localhost:11434/api/tags'],
])

/** 注册自定义 provider 端点。 */
export function registerProviderEndpoint(provider: string, endpoint: string): void {
  providerEndpoints.set(provider, endpoint)
}

/** 探测单个 provider 健康状态。 */
export async function pingProvider(provider: string): Promise<ProviderHealth> {
  const endpoint = providerEndpoints.get(provider)
  if (!endpoint) {
    return { provider, reachable: false, latencyMs: null, checkedAt: new Date() }
  }
  const start = Date.now()
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return {
      provider,
      reachable: res.ok,
      latencyMs: Date.now() - start,
      checkedAt: new Date(),
    }
  } catch {
    return { provider, reachable: false, latencyMs: null, checkedAt: new Date() }
  }
}

/** 探测所有已注册 provider。 */
export async function pingAllProviders(): Promise<ProviderHealth[]> {
  const providers = Array.from(providerEndpoints.keys())
  return Promise.all(providers.map(pingProvider))
}

/** 列出所有已发现的能力。 */
export async function listDiscovered(filter?: {
  category?: string
  provider?: string
  status?: string
  enabledOnly?: boolean
}): Promise<DiscoveredCapability[]> {
  const conds = []
  if (filter?.category) conds.push(eq(aiCapabilities.category, filter.category))
  if (filter?.provider) conds.push(eq(aiCapabilities.provider, filter.provider))
  if (filter?.status) conds.push(eq(aiCapabilities.status, filter.status))
  if (filter?.enabledOnly) conds.push(eq(aiCapabilities.enabled, true))
  const where = conds.length ? and(...conds) : undefined

  const rows = await db.select().from(aiCapabilities).where(where)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.displayName,
    category: r.category,
    provider: r.provider,
    version: r.version,
    status: r.status,
    enabled: r.enabled,
    reachable: r.status === 'production',
    lastCheckedAt: r.updatedAt,
  }))
}

/** 按 provider 分组统计。 */
export async function groupByProvider(): Promise<
  Array<{ provider: string; count: number; enabledCount: number }>
> {
  const rows = await db.select().from(aiCapabilities)
  const map = new Map<string, { provider: string; count: number; enabledCount: number }>()
  for (const r of rows) {
    const entry = map.get(r.provider) ?? { provider: r.provider, count: 0, enabledCount: 0 }
    entry.count++
    if (r.enabled) entry.enabledCount++
    map.set(r.provider, entry)
  }
  return Array.from(map.values())
}

/** 按 category 分组统计。 */
export async function groupByCategory(): Promise<
  Array<{ category: string; count: number; enabledCount: number }>
> {
  const rows = await db.select().from(aiCapabilities)
  const map = new Map<string, { category: string; count: number; enabledCount: number }>()
  for (const r of rows) {
    const entry = map.get(r.category) ?? { category: r.category, count: 0, enabledCount: 0 }
    entry.count++
    if (r.enabled) entry.enabledCount++
    map.set(r.category, entry)
  }
  return Array.from(map.values())
}

/** 刷新能力健康状态：对所有 production 能力做 ping 探测，并更新 avgLatencyMs。 */
export async function refreshHealth(): Promise<{
  checked: number
  reachable: number
  unreachable: number
}> {
  const production = await db
    .select()
    .from(aiCapabilities)
    .where(eq(aiCapabilities.status, 'production'))
  let reachable = 0
  let unreachable = 0
  for (const cap of production) {
    const health = await pingProvider(cap.provider)
    if (health.reachable) {
      reachable++
      await db
        .update(aiCapabilities)
        .set({ avgLatencyMs: health.latencyMs ?? null, updatedAt: new Date() })
        .where(eq(aiCapabilities.id, cap.id))
    } else {
      unreachable++
    }
  }
  return { checked: production.length, reachable, unreachable }
}

/** 根据名称查找能力。 */
export async function findByName(name: string): Promise<AiCapability | undefined> {
  const [row] = await db.select().from(aiCapabilities).where(eq(aiCapabilities.name, name))
  return row
}
