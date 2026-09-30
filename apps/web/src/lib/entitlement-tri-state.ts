// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * usage/entitlement 刷新写入的三态保留判定(G-650)。
 * 与 entitlement-refresh-store.ts 配套:store.refresh() 成功回包写快照前,
 * 先过本文件的三态判定(经 CreateRefreshStoreOptions.merge 注入),不许散在 UI 里。
 *
 * 三态规则:
 *  (a) unknown(字段缺席 undefined / plan='unknown' 哨兵)⇒ 沿用上一轮值 ——
 *      上游抖动不闪断,no_plan 等展示保持稳定;
 *  (b) 显式空(明确 null / [] / 0,字段在回包里带权威形状)⇒ 本轮权威,
 *      清掉旧值(含白名单);显式非空值同样本轮权威;
 *  (c) 身份键(账号/user id)变更 ⇒ 全部旧值作废,禁止沿用 —— unknown 字段
 *      回到空态,上一账号的连接/白名单/套餐一律不复活。
 *
 * 判定必须显式:classifyEntitlementRefresh 输出逐字段判定表(可单测),
 * mergeUsageEntitlementRefresh 按判定表落状态;两者均为纯函数,无模块级状态。
 */

/** 上游 usage/entitlement 回包形状:字段缺席(undefined)= unknown;
 *  显式 null/[]/0 = 本轮权威空值;'unknown' 哨兵 = unknown(非权威)。 */
export interface UsageEntitlementSnapshot {
  /** 身份键(账号/user id):undefined/null = 身份未知(不触发作废,沿用) */
  identityKey?: string | null
  /** undefined = unknown;'unknown' 哨兵 = unknown;null = 显式无套餐(no_plan);字符串 = 本轮权威 */
  plan?: string | null
  /** undefined = unknown;null/[] = 显式空白名单(清掉);非空数组 = 本轮权威 */
  whitelist?: readonly string[] | null
  /** undefined = unknown;null = 显式无连接(清掉);字符串 = 本轮权威 */
  connectionId?: string | null
  /** undefined = unknown;null/0 = 显式清零;有限数字 = 本轮权威 */
  usedTokens?: number | null
}

/** 三态判定落定后的本地态:全字段权威定义(plan=null 即 no_plan 展示) */
export interface ResolvedUsageEntitlementState extends UsageEntitlementSnapshot {
  identityKey: string
  plan: string | null
  whitelist: string[]
  connectionId: string | null
  usedTokens: number
}

/** 单字段二态:unknown=沿用上一轮;explicit=本轮权威(含显式空) */
export type EntitlementFieldVerdict = 'unknown' | 'explicit'

export interface EntitlementFieldVerdicts {
  identityKey: EntitlementFieldVerdict
  plan: EntitlementFieldVerdict
  whitelist: EntitlementFieldVerdict
  connectionId: EntitlementFieldVerdict
  usedTokens: EntitlementFieldVerdict
}

/**
 * 三态总判定:
 *  - { kind:'identity-change' }:(c) 身份键变更,旧值全部作废;
 *  - { kind:'per-field', fields }:(a) unknown 沿用 / (b) 显式权威,逐字段给判定表。
 */
export type EntitlementRefreshVerdict =
  | { kind: 'identity-change' }
  | { kind: 'per-field'; fields: EntitlementFieldVerdicts }

const UNKNOWN_PLAN_SENTINEL = 'unknown'

function isExplicitIdentityKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

/** plan 的 unknown 识别:undefined 或 'unknown' 哨兵(忽略大小写/首尾空白)都算 unknown */
function isPlanUnknown(plan: string | null | undefined): boolean {
  if (plan === undefined) return true
  if (typeof plan === 'string') return plan.trim().toLowerCase() === UNKNOWN_PLAN_SENTINEL
  return false
}

function isExplicitWhitelist(value: readonly string[] | null | undefined): boolean {
  return value !== undefined
}

function isExplicitConnectionId(value: string | null | undefined): boolean {
  return value !== undefined
}

function isExplicitUsedTokens(value: number | null | undefined): boolean {
  if (value === undefined) return false
  if (value === null) return true
  return Number.isFinite(value)
}

/**
 * 三态判定表(显式、可单测):对上一轮态 + 本轮回包给出总判定。
 * 身份键优先:上游带回明确的、与上一轮不同的 identityKey ⇒ identity-change,
 * 其余字段判定无意义(全部旧值作废)。
 */
export function classifyEntitlementRefresh(
  previous: UsageEntitlementSnapshot | null,
  incoming: UsageEntitlementSnapshot,
): EntitlementRefreshVerdict {
  const identityExplicit = isExplicitIdentityKey(incoming.identityKey)
  const previousIdentity = previous?.identityKey
  // (c) 身份键变更:上一轮身份明确存在、本轮上游带回明确的不同身份 ⇒ 全部旧值作废。
  //     上游身份缺席(undefined/null)不算变更 —— 无法确认变化时沿用,不误杀。
  if (
    identityExplicit &&
    typeof previousIdentity === 'string' &&
    previousIdentity.length > 0 &&
    incoming.identityKey !== previousIdentity
  ) {
    return { kind: 'identity-change' }
  }
  return {
    kind: 'per-field',
    fields: {
      identityKey: identityExplicit ? 'explicit' : 'unknown',
      plan: isPlanUnknown(incoming.plan) ? 'unknown' : 'explicit',
      whitelist: isExplicitWhitelist(incoming.whitelist) ? 'explicit' : 'unknown',
      connectionId: isExplicitConnectionId(incoming.connectionId) ? 'explicit' : 'unknown',
      usedTokens: isExplicitUsedTokens(incoming.usedTokens) ? 'explicit' : 'unknown',
    },
  }
}

/**
 * 三态判定 → 本地态落定(G-650 核心写入函数):
 *  (a) 字段 unknown ⇒ 沿用 previous 同名字段(抖动不闪断,no_plan 保持);
 *  (b) 字段 explicit ⇒ 采信本轮回包,显式空(null/[]/0/null plan)清掉旧值;
 *  (c) identity-change ⇒ 从空态重建,unknown 字段落空态,禁止复活旧账号的值。
 */
export function mergeUsageEntitlementRefresh(
  previous: UsageEntitlementSnapshot | null,
  incoming: UsageEntitlementSnapshot,
): ResolvedUsageEntitlementState {
  const verdict = classifyEntitlementRefresh(previous, incoming)
  if (verdict.kind === 'identity-change') {
    // (c) 身份变更:全部旧值作废,只采信本轮显式给出的值
    const identityKey = incoming.identityKey as string
    return {
      identityKey,
      plan:
        typeof incoming.plan === 'string' &&
        incoming.plan.length > 0 &&
        !isPlanUnknown(incoming.plan)
          ? incoming.plan
          : null,
      whitelist: Array.isArray(incoming.whitelist) ? [...incoming.whitelist] : [],
      connectionId:
        typeof incoming.connectionId === 'string' && incoming.connectionId.length > 0
          ? incoming.connectionId
          : null,
      usedTokens:
        typeof incoming.usedTokens === 'number' && Number.isFinite(incoming.usedTokens)
          ? incoming.usedTokens
          : 0,
    }
  }
  const fields = verdict.fields
  // 上一轮态规范化为全定义基线:上一轮若有缺席字段(理论上有,上一轮落定态应为
  // 全定义;此处兜底),沿用时落空态默认值,保证 Resolved 不变量不被 unknown 打穿
  const prev = previous ?? undefined
  const base: ResolvedUsageEntitlementState = {
    identityKey: typeof prev?.identityKey === 'string' ? prev.identityKey : '',
    plan: isPlanUnknown(prev?.plan) ? null : (prev?.plan ?? null),
    whitelist: Array.isArray(prev?.whitelist) ? [...(prev?.whitelist as readonly string[])] : [],
    connectionId: prev?.connectionId ?? null,
    usedTokens: typeof prev?.usedTokens === 'number' ? prev.usedTokens : 0,
  }
  return {
    identityKey:
      fields.identityKey === 'explicit' ? (incoming.identityKey as string) : base.identityKey,
    plan:
      fields.plan === 'explicit'
        ? typeof incoming.plan === 'string' && incoming.plan.length > 0
          ? incoming.plan
          : null
        : base.plan,
    whitelist:
      fields.whitelist === 'explicit'
        ? Array.isArray(incoming.whitelist)
          ? [...incoming.whitelist]
          : []
        : base.whitelist,
    connectionId:
      fields.connectionId === 'explicit'
        ? typeof incoming.connectionId === 'string' && incoming.connectionId.length > 0
          ? incoming.connectionId
          : null
        : base.connectionId,
    usedTokens:
      fields.usedTokens === 'explicit'
        ? typeof incoming.usedTokens === 'number' && Number.isFinite(incoming.usedTokens)
          ? incoming.usedTokens
          : 0
        : base.usedTokens,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
