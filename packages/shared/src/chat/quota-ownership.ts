// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// D67 额度归属分型与低峰折扣倒计时(G-90,与 D56 合并,2026-09-24 立)
//
// **自证结论(改本文件前先读)**:额度相关已有三块 ——
//   · D39 `QuotaActionFamily`(apps/web/src/components/chat/message-list/,动作族
//     渲染件,已带 freeTierAvailable 付费诱导屏蔽,与 D56 合并时对接);
//   · D56 session-usage-badge(会话内余额/积分**展示**,预防性,不判归属);
//   · D71 `error-catalog.ts`(errorCode → 标题/动作 104 条,BUDGET_EXHAUSTED /
//     PROVIDER_QUOTA_EXHAUSTED / TRIAL_QUOTA_EXCEEDED 已在表内)。
// 缺的正是本票这一层:**额度被拒的那次请求按「归属」分型** —— 同是"额度不足",
// 个人今日额度(自助可解)/ 免费模型今日额度(切档可解)/ 团队额度(需管理员)/
// 计费组 Credits 上限(需计费组管理员)四种归属,标题与动作完全不同,
// 现状在错误卡里全挤成一个"额度已用尽"。
//
// **与 D71 error-catalog 的协同(不另立第二套错误分类)**:错误码的标题/动作/
// 分类语义继续由 error-catalog 唯一负责;本模块只做「已收录码 → 归属四类」的
// **窄映射**(fromErrorCode)——先查 error-catalog 确认码有效,再查归属映射,
// 映射不到返回 null 不硬塞(未收录码/非归属码一律 null,与 error-catalog 的
// "宁可不渲染,也不臆造"同一纪律)。
//
// **「不充值可用心智」边界(本票灵魂,判据机器化)**:
//   · shouldShowOwnershipCard:仅当**当次请求因额度被拒**(rejectedByQuota)
//     才显示归属卡。预防性展示(余额尚够时的提醒)不进此卡 —— 诱导的温床
//     是"还没拒绝就先推销"。
//   · isInducementRisk:免费档仍可用(freeTierAvailable)时,只有 personalDaily
//     的自然出路是充值/升级 ⇒ 判为诱导风险,quotaOwnershipView 会把付费动作
//     (upgradeOrAdmin)从动作族剔除,由卡片改渲染降级建议;teamAdmin /
//     billingGroupCredits 的动作是**找管理员**(不是向用户收钱),freeModelDaily
//     的自然出路是切免费模型/等重置 ⇒ 均不判诱导。
//
// 范式同 D71 turn-status / D72 worktree-lifecycle:常量 + 纯函数 +
// 穷尽 switch 零 default + assertNever;端内不得再建第二套归属判定。

import { resolveErrorCatalog } from './error-catalog'

/** 额度归属四型(取值即 i18n 键片段;`ai.pane.quotaOwnership.title.<key>`) */
export const QUOTA_OWNERSHIP_KINDS = [
  'personalDaily',
  'freeModelDaily',
  'teamAdmin',
  'billingGroupCredits',
] as const
export type QuotaOwnershipKind = (typeof QUOTA_OWNERSHIP_KINDS)[number]

/**
 * 三动作族(台账 G-90 三动作,与 D39 QuotaActionFamily 动作对齐):
 *   · viewUsage       查看用量明细   → /models/usage(nav-data.ts:156)
 *   · switchFreeModel 切换免费模型   → D39 切档(onSwitchTier 会话内模型选择器)
 *   · upgradeOrAdmin  升级或联系管理员 → 自助可解走升级(/vip),escalate=true 时
 *                     渲染层应落到"联系管理员"而不是向用户收钱
 */
export const QUOTA_OWNERSHIP_ACTIONS = ['viewUsage', 'switchFreeModel', 'upgradeOrAdmin'] as const
export type QuotaOwnershipAction = (typeof QUOTA_OWNERSHIP_ACTIONS)[number]

/** 词包命名空间(web 侧 `useTranslations('ai.pane.quotaOwnership')`) */
export const QUOTA_OWNERSHIP_NAMESPACE = 'ai.pane.quotaOwnership' as const

/** 折扣三相位;none 表示窗口外/非法区间,不渲染折扣行 */
export const DISCOUNT_PHASES = ['active', 'upcoming', 'none'] as const
export type DiscountPhase = (typeof DISCOUNT_PHASES)[number]

export interface QuotaOwnershipContext {
  /** 免费档仍可用(true ⇒ 剔除付费动作,边界判据见文件头) */
  readonly freeTierAvailable: boolean
}

export interface QuotaOwnershipView {
  readonly kind: QuotaOwnershipKind
  /** `ai.pane.quotaOwnership` 内的标题键 */
  readonly titleKey: string
  /** `ai.pane.quotaOwnership.action` 内的动作键(有序,按推荐处置顺序) */
  readonly actionKeys: readonly QuotaOwnershipAction[]
  /** true = 非用户自助可解(需找管理员/计费组管理员) */
  readonly escalate: boolean
}

const KIND_SET: ReadonlySet<string> = new Set<string>(QUOTA_OWNERSHIP_KINDS)

export function isQuotaOwnershipKind(value: string): value is QuotaOwnershipKind {
  return KIND_SET.has(value)
}

/** 四型 → 标题键(`ai.pane.quotaOwnership.title.<key>`) */
export function quotaOwnershipTitleKey(kind: QuotaOwnershipKind): string {
  return `title.${kind}`
}

/** 动作 → i18n 键(`ai.pane.quotaOwnership.action.<key>`) */
export function quotaOwnershipActionKey(action: QuotaOwnershipAction): string {
  return `action.${action}`
}

/**
 * 四型 → 视图判据的**唯一**派发点。
 *
 * switch 穷尽四型、**无 default**:漏改任一型 ⇒ `kind` 无法收窄为 `never`,
 * assertNeverKind 处编译失败(新增归属必须同步补判据,否则构建拦截)。
 */
export function quotaOwnershipView(kind: QuotaOwnershipKind, ctx: QuotaOwnershipContext): QuotaOwnershipView {
  switch (kind) {
    case 'personalDaily':
      // 个人今日额度:自助可解(明天重置/切免费模型/升级)。免费档仍可用时
      // 剔除付费动作 —— 「不充值可用心智」边界在判定层落地,不由渲染层自觉。
      return {
        kind,
        titleKey: quotaOwnershipTitleKey(kind),
        actionKeys: ctx.freeTierAvailable
          ? ['viewUsage', 'switchFreeModel']
          : ['viewUsage', 'switchFreeModel', 'upgradeOrAdmin'],
        escalate: false,
      }
    case 'freeModelDaily':
      // 免费模型今日额度:非账户问题(免费通道自身限额),等重置或切档,
      // 不给付费动作 —— 免费用户的降级建议是"换一个免费模型",不是充值。
      return {
        kind,
        titleKey: quotaOwnershipTitleKey(kind),
        actionKeys: ['viewUsage', 'switchFreeModel'],
        escalate: false,
      }
    case 'teamAdmin':
      // 团队额度:球在团队管理员那边,用户自助充值解不了 ⇒ escalate=true,
      // 不给切档(团队可用模型由管理员配置,替用户做主会误导)。
      return {
        kind,
        titleKey: quotaOwnershipTitleKey(kind),
        actionKeys: ['viewUsage', 'upgradeOrAdmin'],
        escalate: true,
      }
    case 'billingGroupCredits':
      // 计费组 Credits 上限:球在计费组管理员那边 ⇒ escalate=true,
      // upgradeOrAdmin 对用户渲染为"联系管理员"(渲染层按 escalate 分叉)。
      return {
        kind,
        titleKey: quotaOwnershipTitleKey(kind),
        actionKeys: ['viewUsage', 'upgradeOrAdmin'],
        escalate: true,
      }
  }
  return assertNeverKind(kind)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverKind(kind: never): never {
  throw new Error(`unhandled quota ownership kind: ${String(kind)}`)
}

// ---------------------------------------------------------------------------
// 低峰折扣倒计时(纯函数;now/window 全部 epoch ms,由调用方取时钟)
// ---------------------------------------------------------------------------

export interface DiscountCountdownView {
  readonly phase: DiscountPhase
  /** `ai.pane.quotaOwnership.discount` 内的文案键;none 相位无文案(null) */
  readonly labelKey: 'discount.active' | 'discount.upcoming' | null
  /** upcoming = 距开窗;active = 距收窗;none = 无 */
  readonly remainingMs?: number
}

/**
 * 折扣窗口 → 相位。窗口取**左闭右开** [windowStart, windowEnd):
 *   · now === windowStart 恰好开始  → active
 *   · now === windowEnd   恰好结束  → none(收窗即关闭,不渲染)
 *   · start > end 非法区间 / NaN / Infinity → none,**不抛异常**
 *     (渲染层拿到的窗口来自配置/后端,坏数据不该炸掉对话流)。
 */
export function discountCountdown(now: number, windowStart: number, windowEnd: number): DiscountCountdownView {
  if (!Number.isFinite(now) || !Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) {
    return { phase: 'none', labelKey: null }
  }
  if (windowStart > windowEnd) {
    return { phase: 'none', labelKey: null }
  }
  if (now < windowStart) {
    return { phase: 'upcoming', labelKey: 'discount.upcoming', remainingMs: windowStart - now }
  }
  if (now < windowEnd) {
    return { phase: 'active', labelKey: 'discount.active', remainingMs: windowEnd - now }
  }
  return { phase: 'none', labelKey: null }
}

/** 时长单位词(供 formatDurationHuman 组装;词包 duration.hour / duration.minute) */
export interface DurationUnitLabels {
  readonly hour: string
  readonly minute: string
}

/** 中文缺省单位:「2小时30分」 */
export const ZH_DURATION_UNITS: DurationUnitLabels = { hour: '小时', minute: '分' }

/**
 * 人类可读时长:分钟粒度向下取整。
 *   · 9_000_000ms → 「2小时30分」;7_200_000ms → 「2小时」;1_800_000ms → 「30分」
 *   · 非有限 / 非正数 → 「0分」(负数剩余时长是调用方时钟回拨,不该渲染出负文案)
 */
export function formatDurationHuman(ms: number, units: DurationUnitLabels = ZH_DURATION_UNITS): string {
  if (!Number.isFinite(ms) || ms <= 0) return `0${units.minute}`
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}${units.hour}${minutes}${units.minute}`
  if (hours > 0) return `${hours}${units.hour}`
  return `${minutes}${units.minute}`
}

// ---------------------------------------------------------------------------
// 「不充值可用心智」边界(机器判据)
// ---------------------------------------------------------------------------

export interface OwnershipCardGateContext {
  /** 当次请求是否因额度被拒(拒绝 ⇒ 可展示;预防性提醒 ⇒ 不可展示) */
  readonly rejectedByQuota: boolean
  readonly kind: QuotaOwnershipKind | null
}

/**
 * 归属卡显示门槛:仅**当次请求因额度被拒**才显示。
 * 类型谓词收窄 kind(null ⇒ 卡片没有可渲染的归属,直接不渲染)。
 */
export function shouldShowOwnershipCard(
  ctx: OwnershipCardGateContext,
): ctx is OwnershipCardGateContext & { readonly kind: QuotaOwnershipKind } {
  return ctx.rejectedByQuota && ctx.kind !== null
}

export interface InducementRiskContext {
  readonly kind: QuotaOwnershipKind
  readonly freeTierAvailable: boolean
}

/**
 * 诱导风险判据:**免费档仍可用** 且归属是**个人今日额度**(自然出路是充值/升级)
 * ⇒ true,渲染层必须给降级建议而不是充值引导。
 * 正例:personalDaily + freeTierAvailable=true → true
 * 反例:personalDaily + freeTierAvailable=false(真没得用了,给付费出路不叫诱导);
 *       freeModelDaily + true(出路是切免费模型);teamAdmin/billingGroupCredits + true
 *       (出路是找管理员,不是向用户收钱)→ 均 false。
 */
export function isInducementRisk(ctx: InducementRiskContext): boolean {
  return ctx.freeTierAvailable && ctx.kind === 'personalDaily'
}

// ---------------------------------------------------------------------------
// 与 D71 error-catalog 的协同:已收录码 → 归属四类的窄映射
// ---------------------------------------------------------------------------

/**
 * 窄映射表(白名单,**不是** error-catalog 的复刻):
 *   · BUDGET_EXHAUSTED        → personalDaily(个人预算/今日额度用尽)
 *   · TRIAL_QUOTA_EXCEEDED    → personalDaily(试用额度归个人)
 *   · PROVIDER_QUOTA_EXHAUSTED → freeModelDaily(厂商通道额度用尽,
 *     不是用户账户问题 —— 与词包既有 quotaExhaustedNotice 口径一致)
 * RATE_LIMITED 限流、CONCURRENCY_LIMIT_EXCEEDED 并发上限等**不是额度归属**问题,
 * 刻意不入表(硬塞会让用户去找管理员/充值,方向全错)。
 */
const ERROR_CODE_TO_KIND: Readonly<Partial<Record<string, QuotaOwnershipKind>>> = Object.freeze({
  BUDGET_EXHAUSTED: 'personalDaily',
  TRIAL_QUOTA_EXCEEDED: 'personalDaily',
  PROVIDER_QUOTA_EXHAUSTED: 'freeModelDaily',
})

/**
 * errorCode → 归属四类。两道闸:
 *   ① 码必须在 D71 error-catalog 表内(防陈旧映射 —— 归属分类跟着错误码真相源走);
 *   ② 码必须在本映射表内。
 * 任一不过 → null(不硬塞,渲染层对 null 不渲染归属卡)。
 */
export function fromErrorCode(errorCode: string | undefined | null): QuotaOwnershipKind | null {
  if (!errorCode) return null
  if (resolveErrorCatalog(errorCode) === null) return null
  return ERROR_CODE_TO_KIND[errorCode] ?? null
}

// ⁠[tail-watermark-placeholder]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
