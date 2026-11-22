// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 聊天 auto 模式的号池决策腿(2026-11-22 立)。
 *
 * 立因:「自动」此前只从平台直连池选(ai-service _resolve_auto_model,池源 default_models.json),
 * 用户名下号池与运营池公开模型完全不可达 —— 用户必须手动点名号池模型。机主要求整合:
 * 号池模型进 auto 候选,只跟当前登录用户的号池 + admin 开放在运营池的号池,用户之间隔离。
 *
 * 架构取舍(为什么决策在 api、不在 ai-service):
 * - 号池执行层的选号/隔离/计费已经全部正确(forwardToAccountPool 的选号 WHERE =
 *   运营池 ∪ 本人号 ∪ shared_to_ops,relay-account-forwarder.ts),且用户 token 走的
 *   /ws/relay/chat 通道天然带 userId。缺的只是"auto 要不要选号池模型"这一步决策。
 * - 决策需要当前登录用户身份(api 从 JWT 直接拿到)与号池目录(本服务负责拼装、
 *   fail-closed 现拉上游验证),ai-service 都拿不到(它的回打通道用机器 API key,
 *   req.userId 是 key 属主不是聊天用户 —— 经那条路路由个人号池必然隔离错位)。
 * - 所以:决策在本服务,执行走既有双通道。解析为号池模型 ⇒ 前端本轮改走
 *   /ws/relay/chat(既有工具回路/错误卡/计费台账全部复用);解析为平台 ⇒ 前端照旧
 *   上行 'auto',ai-service 按原有逻辑自行解析(零回归)。
 *
 * 决策规则(单一出处,本文件):
 * 1. 候选合法化:候选 id 要么命中运营池公开登记行(is_relay_public ∧ enabled),
 *    要么其平台前缀在「本人名下可调度账号的平台集」内。两者都不满足 ⇒ 剔除
 *    (执行层还会按选号 WHERE 再兜一道,这里剔除只是少给用户不可能成功的选项)。
 * 2. 任务复杂度:经内部端点问 ai-service(判据单源 assess_complexity,api 不复制关键词表)。
 *    签不出票/超时/非 2xx ⇒ fail-open 回平台腿 —— 判不了的事情不替用户做主。
 * 3. 选型:
 *    - 复杂任务(complex/expert):候选里挑 modelTier='latest' 的,本人号池优先;
 *      没有最新档 ⇒ 平台腿(复杂任务宁可平台 premium,不用号池普通档凑合)。
 *    - 普通任务:本人号池第一个(自家号 0 平台积分成本)⇒ 运营池公开第一个。
 *      代次判定失败时普通任务仍可挑(号池成本优势成立,代次只是排序锦上添花)。
 * 4. 输出:{channel:'pool', model} 或 {channel:'platform'}。所有异常/判不了都归
 *    platform —— 失效方向恒为现状,绝不因解析失败挡发送。
 */

import { and, eq } from 'drizzle-orm'

import { dbRead } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { aiModelConfig, aiModelConfigModels, aiRelayAccountPool } from '@ihui/database'
import { providerFromModelPrefix } from './relay-account-forwarder.js'
import { accountSchedulableCondition } from './relay-account-pool-scheduler.js'
import { buildInternalCallHeaders } from '../utils/internal-call-headers.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import {
  classifyPoolModels,
  poolModelClassKey,
  type PoolModelRef,
} from './model-catalog-classify-client.js'

/** 复杂度档位(ai-service assess_complexity 的 value,这里只做归类不改判据) */
type Complexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert'

export interface AutoResolveInput {
  /** 当前登录用户 id(决策的身份主体,JWT 派生,不信客户端自报;与 owner_user_id 同 varchar 形态) */
  userId: string
  /** 本轮 prompt 尾部(截断后;长文信号由 promptChars 传全长字符数) */
  promptTail: string
  /** 本轮 prompt 全文字符数(复杂度的 token 折算基数) */
  promptChars: number
  /** 本轮是否带工具 */
  hasTools: boolean
  /** 前端选择器实际拉到的号池模型 id(候选来源;仅作候选,不做权限) */
  poolCandidates: string[]
}

export interface AutoResolveResult {
  /** pool = 走 /ws/relay/chat(前端带 model 发);platform = 照旧上行 'auto' */
  channel: 'pool' | 'platform'
  /** channel='pool' 时的号池模型 id;platform 恒 null(平台侧由 ai-service 现场解析) */
  model: string | null
  /** 命中来源(审计用):own=本人号池 / ops=运营池公开 */
  source: 'own' | 'ops' | null
  /** 本轮复杂度(判不出为 null;只进日志,不进对端契约) */
  complexity: Complexity | null
}

/** 候选 id 上限:前端号池目录的合理规模在几十~几百,超出按截断处理(防爆表)。 */
const MAX_CANDIDATES = 500

/** 本人名下可调度账号覆盖的平台集(隔离判据:只认 owner_user_id=本人)。 */
async function ownSchedulablePlatforms(userId: string): Promise<Set<string>> {
  const rows = await dbRead
    .selectDistinct({ providerCode: aiRelayAccountPool.providerCode })
    .from(aiRelayAccountPool)
    .where(and(eq(aiRelayAccountPool.ownerUserId, userId), accountSchedulableCondition()))
  return new Set(rows.map((r) => r.providerCode))
}

/** 运营池公开登记行(id 原样 → providerCode;与 /api/relay/models/public 同 WHERE)。 */
async function opsPublicRows(): Promise<Map<string, string>> {
  const rows = await dbRead
    .select({
      modelId: aiModelConfigModels.modelId,
      providerCode: aiModelConfig.providerCode,
    })
    .from(aiModelConfigModels)
    .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
    .where(
      and(
        eq(aiModelConfigModels.isRelayPublic, true),
        eq(aiModelConfigModels.enabled, true),
        eq(aiModelConfig.enabled, true),
      ),
    )
  return new Map(rows.map((r) => [r.modelId, r.providerCode]))
}

/** 合法化一个候选:返回命中来源,不合法返回 null(单测钉住隔离口径)。 */
export function classifyCandidate(
  id: string,
  own: Set<string>,
  ops: Map<string, string>,
): 'own' | 'ops' | null {
  const opsProvider = ops.get(id)
  if (opsProvider) return 'ops'
  const prefixProvider = providerFromModelPrefix(id)
  if (prefixProvider && own.has(prefixProvider)) return 'own'
  return null
}

/** 决策主入口。永不抛错:任何失败都归 platform(现状),调用方无需 try/catch。 */
export async function resolveAutoChatRoute(input: AutoResolveInput): Promise<AutoResolveResult> {
  const platformResult: AutoResolveResult = {
    channel: 'platform',
    model: null,
    source: null,
    complexity: null,
  }
  try {
    // 候选合法化:候选只是用户意志的表达(来自他自己拉到的目录),权限由
    // 平台集/登记行过滤 + 执行层选号 WHERE 双道保证;越权候选在这里就被剔掉。
    const candidates = input.poolCandidates
      .filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 200)
      .slice(0, MAX_CANDIDATES)
    if (candidates.length === 0) return platformResult

    const [own, ops] = await Promise.all([ownSchedulablePlatforms(input.userId), opsPublicRows()])
    const legal = candidates
      .map((id) => ({ id, source: classifyCandidate(id, own, ops) }))
      .filter((c): c is { id: string; source: 'own' | 'ops' } => c.source !== null)
    if (legal.length === 0) return platformResult

    // 复杂度:判据单源在 ai-service(assess_complexity);判不了 ⇒ 平台腿,不替用户做主。
    const complexity = await assessComplexityViaInternal(input)
    if (!complexity) return platformResult

    if (complexity === 'complex' || complexity === 'expert') {
      // 复杂任务:号池必须有最新档才配得上;判定失败(modelTier 判不了)也回平台 ——
      // "不知道号池模型多新"与"知道它旧"在决策上等价。
      const tiers = await classifyTiers(legal)
      const decision = pickAutoPoolModel(legal, complexity, tiers)
      if (decision.channel !== 'pool') return platformResult
      return { channel: 'pool', model: decision.model, source: decision.source, complexity }
    }

    // 普通任务:本人号池(0 平台积分成本)> 运营池公开(扣积分)> 平台直连默认链。
    // 代次判定失败不拦普通任务:成本优势独立于代次,选第一个仍是既定规则。
    const decision = pickAutoPoolModel(legal, complexity, new Map())
    if (decision.channel !== 'pool') return platformResult
    return { channel: 'pool', model: decision.model, source: decision.source, complexity }
  } catch (err) {
    logger.warn(
      `[chat-auto-resolve] 决策失败,回平台腿(${err instanceof Error ? err.message : String(err)})`,
    )
    return platformResult
  }
}

/** 按来源优先级(own → ops)取第一个满足条件的候选,保持输入顺序(确定性)。 */
function pickFirstBySource(
  ownFirst: { id: string; source: 'own' | 'ops' }[],
  opsFirst: { id: string; source: 'own' | 'ops' }[],
  pred: (c: { id: string; source: 'own' | 'ops' }) => boolean,
): { id: string; source: 'own' | 'ops' } | null {
  for (const c of ownFirst) if (pred(c)) return c
  for (const c of opsFirst) if (pred(c)) return c
  return null
}

/**
 * 决策规则(纯函数,单测钉住;2026-11-22 立):
 * - 复杂任务(complex/expert):号池必须有 modelTier='latest' 才接(本人号池优先),
 *   没有或代次判不了 ⇒ platform(复杂任务宁可平台 premium,不用号池普通档凑合;
 *   "不知道多新"与"知道它旧"在决策上等价)。
 * - 普通任务:本人号池第一个(自家号 0 平台积分成本)⇒ 运营池公开第一个;
 *   代次判定失败不拦(成本优势独立于代次,选第一个仍是既定规则)。
 * 输入的 legal 已过合法化(own 平台集 ∪ 运营池公开行),本函数不再验权。
 */
export function pickAutoPoolModel(
  legal: { id: string; source: 'own' | 'ops' }[],
  complexity: Complexity,
  tiers: Map<string, string>,
): { channel: 'pool' | 'platform'; model: string | null; source: 'own' | 'ops' | null } {
  const ownFirst = legal.filter((c) => c.source === 'own')
  const opsFirst = legal.filter((c) => c.source === 'ops')
  if (complexity === 'complex' || complexity === 'expert') {
    const latest = pickFirstBySource(ownFirst, opsFirst, (c) => tiers.get(c.id) === 'latest')
    if (!latest) return { channel: 'platform', model: null, source: null }
    return { channel: 'pool', model: latest.id, source: latest.source }
  }
  const picked = pickFirstBySource(ownFirst, opsFirst, () => true)
  if (!picked) return { channel: 'platform', model: null, source: null }
  return { channel: 'pool', model: picked.id, source: picked.source }
}

function keyOf(id: string): string {
  const slash = id.indexOf('/')
  return poolModelClassKey(slash > 0 ? id.slice(0, slash) : '', id)
}

/** 批量问代次(model-catalog 内部端点,缓存由 client 维护);失败返回空 Map。
 *  返回 Map 键 = 候选 id(候选列表内唯一,poolModelIds 本身是集合)。 */
async function classifyTiers(
  legal: { id: string; source: 'own' | 'ops' }[],
): Promise<Map<string, string>> {
  const refs: PoolModelRef[] = legal.map((c) => {
    const slash = c.id.indexOf('/')
    return { id: c.id, provider: slash > 0 ? c.id.slice(0, slash) : '' }
  })
  const classified = await classifyPoolModels(refs)
  if (!classified) return new Map()
  const tiers = new Map<string, string>()
  for (const c of legal) {
    const tier = classified.get(keyOf(c.id))
    if (tier) tiers.set(c.id, tier.modelTier)
  }
  return tiers
}

/** 经内部票问 ai-service 复杂度;任何失败返回 null(fail-open 到平台腿)。 */
async function assessComplexityViaInternal(input: AutoResolveInput): Promise<Complexity | null> {
  try {
    const headers = await buildInternalCallHeaders({
      scope: 'model-catalog',
      extra: { 'Content-Type': 'application/json' },
    })
    if (!headers) return null
    const res = await aiServiceFetch(null, '/internal/model-catalog/auto-complexity', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt_tail: (input.promptTail || '').slice(-20_000),
        prompt_chars: Math.max(0, Math.floor(input.promptChars || 0)),
        has_tools: input.hasTools === true,
      }),
      timeoutMs: 5_000,
    })
    if (!res.ok) {
      logger.warn(`[chat-auto-resolve] 复杂度判定失败 HTTP ${res.status}(回平台腿)`)
      return null
    }
    const body = (await res.json()) as { complexity?: unknown }
    const value = body.complexity
    if (
      value === 'trivial' ||
      value === 'simple' ||
      value === 'moderate' ||
      value === 'complex' ||
      value === 'expert'
    ) {
      return value
    }
    logger.warn('[chat-auto-resolve] 复杂度响应值不认识(回平台腿)', { value: String(value) })
    return null
  } catch (err) {
    logger.warn(
      `[chat-auto-resolve] 复杂度判定异常(${err instanceof Error ? err.message : String(err)}),回平台腿`,
    )
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
