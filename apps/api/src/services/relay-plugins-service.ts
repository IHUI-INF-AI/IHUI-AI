// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { relayPlugins, type RelayPlugin } from '@ihui/database'

/**
 * 中转站插件服务(2026-09-17 立,补强 59,对标竞品 /plugins)。
 *
 * 设计:声明式插件,零任意代码执行——每个 plugin_type 对应一个服务层内置
 * 解释器,配置为纯 JSON(以下 zod schema 强约束),从结构上杜绝竞品代码级
 * 插件机制的供应链/沙箱逃逸风险。
 *
 * 内置类型:
 * - request_block:按模型模式/IP 列表拦截请求(v1-public processChatCompletion
 *   入口、计费与审计前评估,命中 403;403 语义为插件拦截,不进 failover);
 * - upstream_header_inject:转发上游时注入自定义请求头(relay-upstream-forwarder,
 *   authorization/content-type 受保护不可覆盖,防鉴权劫持)。
 *
 * 热路径保护:getEnabledPlugins 带 30s TTL 进程内缓存(插件为低频变更配置,
 * 30s 收敛窗口可接受);管理端写操作全部失效缓存。
 */

// ---------------------------------------------------------------------------
// 插件类型与配置 schema(新增类型先在此注册,再实现解释器)
// ---------------------------------------------------------------------------

export const PLUGIN_TYPES = ['request_block', 'upstream_header_inject'] as const
export type PluginType = (typeof PLUGIN_TYPES)[number]

const headerMapSchema = z
  .record(
    z.string().regex(/^[A-Za-z0-9-]{1,64}$/, 'header 名仅允许字母/数字/连字符'),
    z.string().max(500),
  )
  .refine((h) => Object.keys(h).length >= 1 && Object.keys(h).length <= 20, 'header 数量须为 1-20')

export const requestBlockConfigSchema = z
  .object({
    /** 模型拦截模式(子串匹配,如 'gpt-4'、'stepfun/';≤20 条) */
    modelPatterns: z.array(z.string().min(1).max(200)).max(20).optional(),
    /** 拦截的客户端 IP 列表(≤100 条) */
    ipList: z.array(z.string().min(1).max(64)).max(100).optional(),
    /** 拦截提示文案(返回给客户端) */
    blockMessage: z.string().min(1).max(200).optional(),
  })
  .refine(
    (c) => (c.modelPatterns?.length ?? 0) + (c.ipList?.length ?? 0) > 0,
    'modelPatterns 与 ipList 至少配置一项',
  )

export const upstreamHeaderInjectConfigSchema = z.object({ headers: headerMapSchema })

/** 禁止插件覆盖的受保护上游头(防鉴权劫持/协议破坏) */
const PROTECTED_UPSTREAM_HEADERS = new Set(['authorization', 'content-type', 'accept'])

export function validatePluginConfig(
  pluginType: string,
  config: unknown,
): { ok: true } | { ok: false; error: string } {
  switch (pluginType as PluginType) {
    case 'request_block': {
      const r = requestBlockConfigSchema.safeParse(config)
      return r.success
        ? { ok: true }
        : { ok: false, error: r.error.issues[0]?.message ?? '配置不合法' }
    }
    case 'upstream_header_inject': {
      const r = upstreamHeaderInjectConfigSchema.safeParse(config)
      if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? '配置不合法' }
      const bad = Object.keys(r.data.headers).find((k) =>
        PROTECTED_UPSTREAM_HEADERS.has(k.toLowerCase()),
      )
      return bad ? { ok: false, error: `header ${bad} 为受保护头,禁止注入覆盖` } : { ok: true }
    }
    default:
      return { ok: false, error: `未知插件类型: ${pluginType}` }
  }
}

// ---------------------------------------------------------------------------
// CRUD + 状态管理
// ---------------------------------------------------------------------------

export interface InstallPluginInput {
  pluginKey: string
  name: string
  description?: string
  pluginType: PluginType
  config: unknown
  priority?: number
}

type Result<T> = { success: true; data: T } | { success: false; reason: string }

export async function installPlugin(
  input: InstallPluginInput,
  createdBy: string,
): Promise<Result<RelayPlugin>> {
  const keyRegex = /^[a-z0-9_-]{1,64}$/
  if (!keyRegex.test(input.pluginKey)) {
    return { success: false, reason: 'pluginKey 仅允许小写字母/数字/下划线/连字符,1-64 位' }
  }
  const cfg = validatePluginConfig(input.pluginType, input.config)
  if (!cfg.ok) return { success: false, reason: cfg.error }
  const existing = await db
    .select()
    .from(relayPlugins)
    .where(eq(relayPlugins.pluginKey, input.pluginKey))
    .limit(1)
  if (existing[0]) {
    // 覆盖语义:更新元数据/配置,保留运行状态(管理员已验证的启停不被重置)
    const rows = await db
      .update(relayPlugins)
      .set({
        name: input.name,
        description: input.description ?? null,
        pluginType: input.pluginType,
        config: input.config as Record<string, unknown>,
        priority: input.priority ?? existing[0].priority,
        updatedAt: new Date(),
      })
      .where(eq(relayPlugins.id, existing[0].id))
      .returning()
    invalidateCache()
    return { success: true, data: rows[0]! }
  }
  const rows = await db
    .insert(relayPlugins)
    .values({
      pluginKey: input.pluginKey,
      name: input.name,
      description: input.description ?? null,
      pluginType: input.pluginType,
      config: input.config as Record<string, unknown>,
      priority: input.priority ?? 100,
      createdBy,
    })
    .returning()
  invalidateCache()
  return { success: true, data: rows[0]! }
}

export async function setPluginStatus(
  id: string,
  status: 'enabled' | 'disabled',
): Promise<Result<RelayPlugin>> {
  const rows = await db
    .update(relayPlugins)
    .set({ status, updatedAt: new Date() })
    .where(eq(relayPlugins.id, id))
    .returning()
  if (!rows[0]) return { success: false, reason: '插件不存在' }
  invalidateCache()
  return { success: true, data: rows[0] }
}
export async function setPluginConfig(id: string, config: unknown): Promise<Result<RelayPlugin>> {
  const rowsFind = await db.select().from(relayPlugins).where(eq(relayPlugins.id, id)).limit(1)
  const plugin = rowsFind[0]
  if (!plugin) return { success: false, reason: '插件不存在' }
  const cfg = validatePluginConfig(plugin.pluginType, config)
  if (!cfg.ok) return { success: false, reason: cfg.error }
  const rows = await db
    .update(relayPlugins)
    .set({ config: config as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(relayPlugins.id, id))
    .returning()
  if (!rows[0]) return { success: false, reason: '插件不存在' }
  invalidateCache()
  return { success: true, data: rows[0] }
}

export async function deletePlugin(id: string): Promise<Result<RelayPlugin>> {
  const rows = await db.delete(relayPlugins).where(eq(relayPlugins.id, id)).returning()
  if (!rows[0]) return { success: false, reason: '插件不存在' }
  invalidateCache()
  return { success: true, data: rows[0] }
}

export async function listPlugins(status?: string): Promise<RelayPlugin[]> {
  const where = status ? eq(relayPlugins.status, status) : undefined
  return db
    .select()
    .from(relayPlugins)
    .where(where)
    .orderBy(asc(relayPlugins.priority), asc(relayPlugins.createdAt))
}

export async function getPlugin(id: string): Promise<RelayPlugin | undefined> {
  const rows = await db.select().from(relayPlugins).where(eq(relayPlugins.id, id)).limit(1)
  return rows[0]
}

// ---------------------------------------------------------------------------
// 热路径:启用插件读取(30s TTL 缓存)+ 解释器
// ---------------------------------------------------------------------------

let cache: { plugins: RelayPlugin[]; expiresAt: number } | null = null
const CACHE_TTL_MS = 30_000

function invalidateCache(): void {
  cache = null
}

export async function getEnabledPlugins(): Promise<RelayPlugin[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.plugins
  const plugins = await db
    .select()
    .from(relayPlugins)
    .where(eq(relayPlugins.status, 'enabled'))
    .orderBy(asc(relayPlugins.priority))
  cache = { plugins, expiresAt: Date.now() + CACHE_TTL_MS }
  return plugins
}

export interface RequestBlockContext {
  model: string
  clientIp?: string
}

/** request_block 解释器:命中返回拦截文案,未命中返回 null。 */
function evaluateRequestBlock(
  plugins: RelayPlugin[],
  ctx: RequestBlockContext,
): string | null {
  for (const p of plugins) {
    if (p.pluginType !== 'request_block') continue
    const cfg = requestBlockConfigSchema.safeParse(p.config)
    if (!cfg.success) continue // 配置异常的插件跳过,不阻断主链路
    const c = cfg.data
    if (c.modelPatterns?.some((pat) => ctx.model.includes(pat))) {
      return c.blockMessage ?? '请求被平台策略拦截'
    }
    if (c.ipList?.length && ctx.clientIp && c.ipList.includes(ctx.clientIp)) {
      return c.blockMessage ?? '请求被平台策略拦截'
    }
  }
  return null
}

/** v1-public 入口便捷评估(含缓存读取,缓存异常降级为不拦截)。 */
export async function evaluateRequestBlockPlugins(
  ctx: RequestBlockContext,
): Promise<string | null> {
  try {
    const plugins = await getEnabledPlugins()
    return evaluateRequestBlock(plugins, ctx)
  } catch {
    return null // 插件体系任何异常不得影响主转发链路
  }
}

/** upstream_header_inject 解释器:合并注入头(受保护头跳过)。 */
export function applyUpstreamHeaderPlugins(
  plugins: RelayPlugin[],
  headers: Record<string, string>,
): Record<string, string> {
  const merged = { ...headers }
  for (const p of plugins) {
    if (p.pluginType !== 'upstream_header_inject') continue
    const cfg = upstreamHeaderInjectConfigSchema.safeParse(p.config)
    if (!cfg.success) continue
    for (const [k, v] of Object.entries(cfg.data.headers)) {
      if (PROTECTED_UPSTREAM_HEADERS.has(k.toLowerCase())) continue
      merged[k] = v
    }
  }
  return merged
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
