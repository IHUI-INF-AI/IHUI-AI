// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/relay/monitor/* 渠道公开健康监控页(对标 Sub2API channelMonitorV2,2026-09-16 立)。
 *
 * 公开(无鉴权),用于用户侧状态页展示各上游渠道的可用性 / 延迟 / 最近检查时间。
 *
 * 端点清单:
 * 1. GET /api/relay/monitor/status    — 全部渠道当前快照
 *    返回 { channels: [{ providerCode, displayName, status, latencyMs:{avg,p95}|null,
 *                       modelCount, lastCheckedAt }], generatedAt }
 * 2. GET /api/relay/monitor/history?providerCode=  — 某渠道延迟历史(60 点)
 *    返回 { points: [{ t, latencyMs, ok }] }
 *    —— 当前健康检查仅落地 ai_relay_key_pool 的 health_status(单点快照),
 *       未留存时间序列历史,故返回 { points: [], note: 'history-not-retained' }。
 *
 * 数据源(全部来自已落库、可对外公开聚合的字段,绝不暴露上游 Key / 账号 / 完整 URL):
 * - 渠道健康:ai_relay_key_pool.health_status / health_checked_at(由 relay-health-check-worker
 *   每 5 分钟巡检并持久化;熔断状态机在 Redis/内存,属临时态,不用于公开展示)
 * - 延迟:llm_call_logs(provider_code + latency_ms + status='success',近 60 分钟聚合 avg/p95)
 * - 模型数:ai_model_config_models(is_relay_public + enabled)按 provider_code 聚合
 * - 显示名:ai_model_config.name(同 provider 取首条启用配置),缺失时回落 provider 友好名/原始 code
 *
 * 脱敏:仅暴露 providerCode / 显示名 / 状态 / 延迟区间 / 模型数 / 最近检查时间;
 *      不查 api_key_enc、base_url、key_prefix、balance、remark 等敏感字段。
 */
import type { FastifyPluginAsync } from 'fastify'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { aiRelayKeyPool, aiModelConfig, aiModelConfigModels, llmCallLogs } from '@ihui/database'
import { success } from '../utils/response.js'

/** 公开渠道状态枚举(与前端 channelStatus 文案一一对应)。 */
type ChannelStatus = 'operational' | 'degraded' | 'down' | 'maintenance'

/** provider code → 用户友好显示名(公开状态页用)。 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  azure: 'Azure OpenAI',
  anthropic: 'Anthropic',
  claude: 'Claude',
  google: 'Google',
  gemini: 'Google Gemini',
  stepfun: '阶跃星辰 StepFun',
  deepseek: 'DeepSeek',
  qwen: '阿里通义千问',
  dashscope: '阿里通义千问',
  moonshot: '月之暗面 Moonshot',
  kimi: '月之暗面 Kimi',
  zhipu: '智谱 AI',
  glm: '智谱 GLM',
  minimax: 'MiniMax',
  baichuan: '百川智能',
  doubao: '字节豆包',
  hunyuan: '腾讯混元',
  yi: '零一万物',
  mistral: 'Mistral AI',
  meta: 'Meta Llama',
  llama: 'Meta Llama',
  xai: 'xAI Grok',
  grok: 'xAI Grok',
  ollama: 'Ollama(本地)',
  openrouter: 'OpenRouter',
  siliconflow: 'SiliconFlow',
  together: 'Together AI',
  fireworks: 'Fireworks AI',
  voyage: 'Voyage AI',
  cohere: 'Cohere',
}

/** 最近延迟统计窗口(分钟)。 */
const LATENCY_WINDOW_MINUTES = 60

/** 服务端轻量缓存(30s TTL),避免前端 60s 轮询 + 多用户并发直击 DB。 */
const CACHE_TTL_MS = 30_000
interface StatusCacheEntry {
  at: number
  payload: unknown
}
let statusCache: StatusCacheEntry | null = null

/** 数字容错:DB numeric/聚合结果可能为 null/字符串。 */
function toNum(v: unknown): number | null {
  if (v === null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

interface ChannelRow {
  providerCode: string
  name: string | null
  healthStatus: string | null
  isEnabled: boolean
  healthCheckedAt: Date | null
}

/** 由某 provider 的 key 池健康聚合出整体状态(熔断态不计入,仅用持久化 health_status)。 */
function aggregateStatus(keys: ChannelRow[]): ChannelStatus {
  const enabled = keys.filter((k) => k.isEnabled)
  if (enabled.length === 0) return 'maintenance'

  let healthy = 0
  let degraded = 0
  let down = 0
  for (const k of enabled) {
    const s = k.healthStatus ?? 'unknown'
    if (s === 'healthy') healthy++
    else if (s === 'degraded') degraded++
    else if (s === 'down') down++
  }

  const hasHealthy = healthy > 0
  const hasDegraded = degraded > 0
  const hasDown = down > 0

  if (hasHealthy && !hasDown && !hasDegraded) return 'operational'
  // 全部 unknown(尚未巡检/无结论):按"暂不可服务"处理,公开标为维护中
  if (!hasHealthy && !hasDown && !hasDegraded) return 'maintenance'
  // 无健康 key 但存在 down:渠道不可用
  if (hasDown && !hasHealthy) return 'down'
  // 其余(有健康但伴随降级/熔断,或仅 degraded):部分可用 → 降级
  return 'degraded'
}

/** 取某 provider 的公开显示名。 */
function resolveDisplayName(providerCode: string, configName: string | null): string {
  if (PROVIDER_DISPLAY_NAMES[providerCode]) return PROVIDER_DISPLAY_NAMES[providerCode]
  if (configName && configName.trim() !== '') return configName.trim()
  // 原始 code 美化:openai → Openai
  return providerCode.charAt(0).toUpperCase() + providerCode.slice(1)
}

interface PublicChannel {
  providerCode: string
  displayName: string
  status: ChannelStatus
  latencyMs: { avg: number | null; p95: number | null } | null
  modelCount: number
  lastCheckedAt: string | null
}

async function buildStatusPayload(): Promise<{
  channels: PublicChannel[]
  generatedAt: string
}> {
  // 1. 取全部 key 池(仅聚合所需字段,绝不取 apiKeyEnc/baseUrl 等敏感列)
  const keyRows = await dbRead
    .select({
      providerCode: aiRelayKeyPool.providerCode,
      name: aiRelayKeyPool.name,
      healthStatus: aiRelayKeyPool.healthStatus,
      isEnabled: aiRelayKeyPool.isEnabled,
      healthCheckedAt: aiRelayKeyPool.healthCheckedAt,
    })
    .from(aiRelayKeyPool)

  // 按 provider 分组
  const byProvider = new Map<string, ChannelRow[]>()
  for (const r of keyRows) {
    const list = byProvider.get(r.providerCode) ?? []
    list.push(r)
    byProvider.set(r.providerCode, list)
  }

  const providerCodes = [...byProvider.keys()]
  if (providerCodes.length === 0) {
    return { channels: [], generatedAt: new Date().toISOString() }
  }

  // 2. 延迟 avg/p95(近 60 分钟成功调用)
  const latencyRows = await dbRead
    .select({
      providerCode: llmCallLogs.providerCode,
      avg: sql<number>`avg(${llmCallLogs.latencyMs})`,
      p95: sql<number>`percentile_cont(0.95) within group (order by ${llmCallLogs.latencyMs})`,
    })
    .from(llmCallLogs)
    .where(
      and(
        inArray(llmCallLogs.providerCode, providerCodes),
        eq(llmCallLogs.status, 'success'),
        sql`${llmCallLogs.createdAt} >= now() - interval '${sql.raw(String(LATENCY_WINDOW_MINUTES))} minutes'`,
      ),
    )
    .groupBy(llmCallLogs.providerCode)
  const latencyMap = new Map<string, { avg: number | null; p95: number | null }>()
  for (const r of latencyRows) {
    if (!r.providerCode) continue
    latencyMap.set(r.providerCode, { avg: toNum(r.avg), p95: toNum(r.p95) })
  }

  // 3. 模型数(relay 公开上架,按 provider 聚合)
  const modelRows = await dbRead
    .select({
      providerCode: aiModelConfig.providerCode,
      count: sql<number>`count(*)::int`,
    })
    .from(aiModelConfigModels)
    .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
    .where(
      and(
        inArray(aiModelConfig.providerCode, providerCodes),
        eq(aiModelConfigModels.isRelayPublic, true),
        eq(aiModelConfigModels.enabled, true),
        eq(aiModelConfig.enabled, true),
      ),
    )
    .groupBy(aiModelConfig.providerCode)
  const modelCountMap = new Map<string, number>()
  for (const r of modelRows) {
    if (!r.providerCode) continue
    modelCountMap.set(r.providerCode, toNum(r.count) ?? 0)
  }

  // 4. 显示名(同 provider 取首条启用配置的 name)
  const configRows = await dbRead
    .select({
      providerCode: aiModelConfig.providerCode,
      name: aiModelConfig.name,
    })
    .from(aiModelConfig)
    .where(and(inArray(aiModelConfig.providerCode, providerCodes), eq(aiModelConfig.enabled, true)))
  const configNameMap = new Map<string, string>()
  for (const r of configRows) {
    if (!configNameMap.has(r.providerCode) && r.name) configNameMap.set(r.providerCode, r.name)
  }

  // 5. 组装渠道列表
  const channels: PublicChannel[] = []
  for (const [providerCode, keys] of byProvider.entries()) {
    const status = aggregateStatus(keys)
    // 最近检查时间:该 provider 全部 key 的 health_checked_at 最大值
    let lastCheckedAt: string | null = null
    for (const k of keys) {
      if (k.healthCheckedAt) {
        const iso = k.healthCheckedAt.toISOString()
        if (lastCheckedAt === null || iso > lastCheckedAt) lastCheckedAt = iso
      }
    }
    channels.push({
      providerCode,
      displayName: resolveDisplayName(providerCode, configNameMap.get(providerCode) ?? null),
      status,
      latencyMs: latencyMap.get(providerCode) ?? null,
      modelCount: modelCountMap.get(providerCode) ?? 0,
      lastCheckedAt,
    })
  }

  // 排序:故障优先(down > degraded > maintenance > operational),同档按 providerCode 升序
  const severity: Record<ChannelStatus, number> = {
    down: 0,
    degraded: 1,
    maintenance: 2,
    operational: 3,
  }
  channels.sort(
    (a, b) =>
      severity[a.status] - severity[b.status] || a.providerCode.localeCompare(b.providerCode),
  )

  return { channels, generatedAt: new Date().toISOString() }
}

const relayMonitorPublicRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /relay/monitor/status — 全部渠道当前快照(公开,无鉴权)。
   * 30s 服务端缓存,降低高频轮询对 DB 的压力。
   */
  server.get('/relay/monitor/status', async (_request, reply) => {
    try {
      const now = Date.now()
      if (statusCache && now - statusCache.at < CACHE_TTL_MS) {
        return reply.send(success(statusCache.payload))
      }
      const payload = await buildStatusPayload()
      statusCache = { at: now, payload }
      return reply.send(success(payload))
    } catch (e) {
      _request.log.error(e, 'relay-monitor status failed')
      // 失败降级为空清单,前端展示空状态,不暴露内部错误
      return reply.send(success({ channels: [], generatedAt: new Date().toISOString() }))
    }
  })

  /**
   * GET /relay/monitor/history?providerCode= — 某渠道延迟历史(60 点)。
   * 当前未留存时间序列历史(健康检查仅落地单点 health_status),返回空点 + 说明。
   */
  server.get('/relay/monitor/history', async (request, reply) => {
    try {
      const providerCode = (request.query as { providerCode?: unknown }).providerCode
      const code =
        typeof providerCode === 'string' && providerCode.trim() !== '' ? providerCode.trim() : null
      // 预留扩展:未来接入时间序列历史表时,按 code 查询最近 60 点 { t, latencyMs, ok }
      return reply.send(
        success({
          providerCode: code,
          points: [],
          note: 'history-not-retained',
        }),
      )
    } catch (e) {
      request.log.error(e, 'relay-monitor history failed')
      return reply.send(success({ providerCode: null, points: [], note: 'history-not-retained' }))
    }
  })
}

export default relayMonitorPublicRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
