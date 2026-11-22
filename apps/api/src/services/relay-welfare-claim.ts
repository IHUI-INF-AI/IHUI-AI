// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 权益活动领取的**判据层**(2026-11-18 立)。
 *
 * 立因:qoder2api 系网关把「每日签到 + Pro 福利真实领取」做成一格 —— 列出活动、
 * 只对 `CLAIMABLE` 的 Credits 活动发起领取、Pro 升级包走 `eligibility → claim` 两步、
 * 官方幂等已领返回 `replayed`。本仓此前只有**签到**(转发 ai-service),没有「权益活动
 * 该不该领、按什么顺序领、领完怎么记账」的判据 —— 于是「该领的漏领」「重复领被拒」
 * 「上游端点没实证就先拨出去」三种问题都没有地方拦。
 *
 * 本模块只做判据(零 IO):给定活动快照 + 端点是否实证 + 本地已领台账,算出**该做什么**。
 * 执行仍在 ai-service 侧;本层负责三件事:
 *   ① **未实证拒发起** —— 端点没在本机取证过,整批 refuse,一枚都不拨(§0.3);
 *   ② **顺序与形态** —— credits 单步 claim;pro_upgrade 先 eligibility 再 claim;
 *   ③ **幂等记账** —— `replayed` 视为已领成功,不重复发起;本地台账命中则跳过。
 *
 * 纪律:状态/类型认不出一律 `unknown` 并跳过(不猜),跳过必须带原因(便于运营对账)。
 */

export const WELFARE_KINDS = ['credits', 'pro_upgrade', 'other'] as const
export type WelfareKind = (typeof WELFARE_KINDS)[number]

export const WELFARE_STATES = ['claimable', 'claimed', 'closed', 'not_eligible', 'unknown'] as const
export type WelfareState = (typeof WELFARE_STATES)[number]

export interface WelfareCampaignSnapshot {
  id: string
  title?: string
  /** 宽松输入:上游写什么的都有,本层归一 */
  kind?: string | null
  /** 宽松输入:大小写/空白/中文都可能 */
  state?: string | null
}

export interface WelfarePlanInput {
  campaigns: WelfareCampaignSnapshot[]
  /** 上游领取端点是否已在本机实证(未实证 ⇒ 整批拒发起) */
  providerVerified: boolean
  /** 本地已领台账(活动 id),用于跳过重复领取 */
  alreadyClaimedIds?: readonly string[]
}

export type WelfareStep = 'claim' | 'eligibility_then_claim'

export type WelfareAction =
  | { campaignId: string; action: 'claim'; step: WelfareStep; why: string }
  | { campaignId: string; action: 'skip'; why: string }

export interface WelfarePlan {
  /** 端点未实证 ⇒ true,此时 actions 为空(一枚都不拨) */
  refused: boolean
  refusal?: { code: 'endpoint-unverified' | 'no-campaigns'; reason: string }
  actions: WelfareAction[]
  summary: { claim: number; skip: number }
}

const KIND_ALIASES: Readonly<Record<string, WelfareKind>> = {
  credits: 'credits',
  credit: 'credits',
  积分: 'credits',
  pro_upgrade: 'pro_upgrade',
  pro: 'pro_upgrade',
  upgrade: 'pro_upgrade',
  'pro-upgrade': 'pro_upgrade',
  'pro 升级': 'pro_upgrade',
  other: 'other',
}

const STATE_ALIASES: Readonly<Record<string, WelfareState>> = {
  claimable: 'claimable',
  可领取: 'claimable',
  可领: 'claimable',
  claimed: 'claimed',
  received: 'claimed',
  已领取: 'claimed',
  已领: 'claimed',
  closed: 'closed',
  ended: 'closed',
  已结束: 'closed',
  not_eligible: 'not_eligible',
  ineligible: 'not_eligible',
  不符合: 'not_eligible',
}

/** 归一活动类型;认不出 ⇒ 'other'(不是错,只是不按专属流程走) */
export function normalizeWelfareKind(raw: unknown): WelfareKind {
  if (typeof raw !== 'string') return 'other'
  return KIND_ALIASES[raw.trim().toLowerCase()] ?? 'other'
}

/** 归一活动状态;认不出 ⇒ 'unknown'(必须跳过,不猜成可领) */
export function normalizeWelfareState(raw: unknown): WelfareState {
  if (typeof raw !== 'string') return 'unknown'
  return STATE_ALIASES[raw.trim().toLowerCase()] ?? 'unknown'
}

/**
 * 算出本轮该领哪些。纯函数,同输入恒等。
 */
export function planWelfareClaim(input: WelfarePlanInput): WelfarePlan {
  const campaigns = Array.isArray(input?.campaigns) ? input.campaigns : []

  const refusedBase: WelfarePlan = { refused: false, actions: [], summary: { claim: 0, skip: 0 } }

  if (!input?.providerVerified) {
    return {
      ...refusedBase,
      refused: true,
      refusal: {
        code: 'endpoint-unverified',
        reason:
          '上游权益领取端点未在本机取证:按 §0.3 一律不发起(拨出去的每个请求都会在上游留下调用痕迹,' +
          '端点猜错还会被当成异常流量)。要开这一格先补端点取证,或由机主用 env 显式声明已实证。',
      },
    }
  }

  if (campaigns.length === 0) {
    return {
      ...refusedBase,
      refused: true,
      refusal: { code: 'no-campaigns', reason: '活动快照为空:上游没回活动,或本账号当前没有可参与活动' },
    }
  }

  const claimed = new Set(Array.isArray(input.alreadyClaimedIds) ? input.alreadyClaimedIds : [])
  const actions: WelfareAction[] = []

  for (const c of campaigns) {
    const id = typeof c?.id === 'string' ? c.id.trim() : ''
    if (!id) {
      actions.push({ campaignId: '', action: 'skip', why: '活动缺 id:无法发起也无法对账,跳过' })
      continue
    }
    if (claimed.has(id)) {
      actions.push({ campaignId: id, action: 'skip', why: '本地台账记为已领:重复发起只会拿到 replayed' })
      continue
    }

    const state = normalizeWelfareState(c?.state)
    if (state === 'claimed') {
      actions.push({ campaignId: id, action: 'skip', why: '上游标记已领:无需再次发起' })
      continue
    }
    if (state === 'closed') {
      actions.push({ campaignId: id, action: 'skip', why: '活动已结束:发起会 4xx' })
      continue
    }
    if (state === 'not_eligible') {
      actions.push({ campaignId: id, action: 'skip', why: '账号不符合领取条件:发起无意义' })
      continue
    }
    if (state === 'unknown') {
      actions.push({
        campaignId: id,
        action: 'skip',
        why: `状态认不出「${String(c?.state ?? '')}」:不猜成可领,先人工核对上游字段`,
      })
      continue
    }

    // state === 'claimable'
    const kind = normalizeWelfareKind(c?.kind)
    if (kind === 'pro_upgrade') {
      actions.push({
        campaignId: id,
        action: 'claim',
        step: 'eligibility_then_claim',
        why: 'Pro 升级包是两步:先资格校验,通过后再领取;跳步会被上游拒',
      })
    } else {
      actions.push({
        campaignId: id,
        action: 'claim',
        step: 'claim',
        why: kind === 'credits' ? '积分活动单步领取' : '未归类活动按单步领取',
      })
    }
  }

  const claim = actions.filter((a) => a.action === 'claim').length
  return {
    refused: false,
    actions,
    summary: { claim, skip: actions.length - claim },
  }
}

export type ClaimOutcome = 'claimed' | 'replayed' | 'failed'

/**
 * 归一领取结果。官方幂等在"已领过"时返回 `replayed` —— 那**不是失败**,
 * 若把它记成失败,下一轮会再次发起,永远在重试。
 */
export function normalizeClaimOutcome(raw: { replayed?: unknown; ok?: unknown; claimed?: unknown }): ClaimOutcome {
  if (raw?.replayed === true) return 'replayed'
  if (raw?.claimed === true || raw?.ok === true) return 'claimed'
  return 'failed'
}

export const __test__ = { KIND_ALIASES, STATE_ALIASES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
