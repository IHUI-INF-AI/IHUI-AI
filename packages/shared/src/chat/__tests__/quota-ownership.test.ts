// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// D67 额度归属分型 —— 判定层用例(G-90)。
//
// 五条主线:
//   ① 四型逐类:每型独立标题键 / 动作族 / escalate 标志,穷尽 switch 零 default
//      由 tsc 守住(漏一型 assertNeverKind 处编译失败),这里再用
//      Record<QuotaOwnershipKind, true> 钉一次编译期穷尽;
//   ② 三动作族:动作全部落在 QUOTA_OWNERSHIP_ACTIONS 白名单内,personalDaily
//      自助可解给全三动作,escalate 两型不给切档(团队模型由管理员配置);
//   ③ 低峰折扣倒计时边界:恰好开始 / 恰好结束 / 跨午夜 / 负数时长 / 非法区间
//      (start>end → none 不抛异常)/ NaN 不抛异常;
//   ④ 「不充值可用心智」正反例(本票灵魂):仅当次被拒才显示;
//      免费档可用 + personalDaily = 诱导风险 ⇒ 判定层剔除付费动作;
//   ⑤ 与 D71 error-catalog 协同:fromErrorCode 只映射已收录码,映射不到返回
//      null 不硬塞。

import { describe, expect, it } from 'vitest'

import { isKnownErrorCode } from '../error-catalog'
import {
  QUOTA_OWNERSHIP_ACTIONS,
  QUOTA_OWNERSHIP_KINDS,
  ZH_DURATION_UNITS,
  discountCountdown,
  formatDurationHuman,
  fromErrorCode,
  isInducementRisk,
  isQuotaOwnershipKind,
  quotaOwnershipActionKey,
  quotaOwnershipTitleKey,
  quotaOwnershipView,
  shouldShowOwnershipCard,
  type QuotaOwnershipKind,
} from '../quota-ownership'

/** 编译期穷尽钉:新增归属型而漏改判定 ⇒ 这里 tsc 直接报错 */
const EXHAUSTIVE_KINDS: Record<QuotaOwnershipKind, true> = {
  personalDaily: true,
  freeModelDaily: true,
  teamAdmin: true,
  billingGroupCredits: true,
}

describe('D67 四型归属 / 逐型判据', () => {
  it('常量表恰好四型,编译期穷尽钉齐全', () => {
    expect(QUOTA_OWNERSHIP_KINDS).toHaveLength(4)
    expect(Object.keys(EXHAUSTIVE_KINDS).sort()).toEqual([...QUOTA_OWNERSHIP_KINDS].sort())
  })

  it('personalDaily:自助可解,escalate=false,免费档不可用时给全三动作', () => {
    const view = quotaOwnershipView('personalDaily', { freeTierAvailable: false })
    expect(view.titleKey).toBe('title.personalDaily')
    expect(view.escalate).toBe(false)
    expect(view.actionKeys).toEqual(['viewUsage', 'switchFreeModel', 'upgradeOrAdmin'])
  })

  it('freeModelDaily:切档可解,不给付费动作', () => {
    const view = quotaOwnershipView('freeModelDaily', { freeTierAvailable: false })
    expect(view.titleKey).toBe('title.freeModelDaily')
    expect(view.escalate).toBe(false)
    expect(view.actionKeys).toEqual(['viewUsage', 'switchFreeModel'])
  })

  it('teamAdmin:escalate=true,不给切档(团队模型由管理员配置)', () => {
    const view = quotaOwnershipView('teamAdmin', { freeTierAvailable: false })
    expect(view.titleKey).toBe('title.teamAdmin')
    expect(view.escalate).toBe(true)
    expect(view.actionKeys).toEqual(['viewUsage', 'upgradeOrAdmin'])
    expect(view.actionKeys).not.toContain('switchFreeModel')
  })

  it('billingGroupCredits:escalate=true(需计费组管理员),不给切档', () => {
    const view = quotaOwnershipView('billingGroupCredits', { freeTierAvailable: false })
    expect(view.titleKey).toBe('title.billingGroupCredits')
    expect(view.escalate).toBe(true)
    expect(view.actionKeys).toEqual(['viewUsage', 'upgradeOrAdmin'])
    expect(view.actionKeys).not.toContain('switchFreeModel')
  })

  it('四型标题键互不相同(分型必须可区分,挤成一句"额度已用尽"就是本票要修的病)', () => {
    const titles = QUOTA_OWNERSHIP_KINDS.map((k) => quotaOwnershipView(k, { freeTierAvailable: false }).titleKey)
    expect(new Set(titles).size).toBe(4)
  })

  it('键名生成器:title.<kind> / action.<action>', () => {
    expect(quotaOwnershipTitleKey('teamAdmin')).toBe('title.teamAdmin')
    expect(quotaOwnershipActionKey('viewUsage')).toBe('action.viewUsage')
  })

  it('isQuotaOwnershipKind:合法值收窄,非法串拒绝', () => {
    expect(isQuotaOwnershipKind('teamAdmin')).toBe(true)
    expect(isQuotaOwnershipKind('TEAMADMIN')).toBe(false)
    expect(isQuotaOwnershipKind('personal')).toBe(false)
  })
})

describe('D67 三动作族 / 白名单纪律', () => {
  it('四型的动作全部落在三动作白名单内,无空族、无重复', () => {
    for (const kind of QUOTA_OWNERSHIP_KINDS) {
      const view = quotaOwnershipView(kind, { freeTierAvailable: false })
      expect(view.actionKeys.length, kind).toBeGreaterThan(0)
      expect(new Set(view.actionKeys).size, kind).toBe(view.actionKeys.length)
      for (const action of view.actionKeys) {
        expect(QUOTA_OWNERSHIP_ACTIONS, `${kind}/${action}`).toContain(action)
      }
    }
  })
})

describe('D67 低峰折扣倒计时 / 边界用例', () => {
  const START = 1_789_000_000_000
  const END = START + 2 * 60 * 60 * 1000 // 两小时窗口

  it('恰好开始(now === start)→ active', () => {
    const v = discountCountdown(START, START, END)
    expect(v.phase).toBe('active')
    expect(v.labelKey).toBe('discount.active')
    expect(v.remainingMs).toBe(END - START)
  })

  it('窗口内 → active,剩余 = 距收窗', () => {
    const v = discountCountdown(START + 30 * 60 * 1000, START, END)
    expect(v.phase).toBe('active')
    expect(v.remainingMs).toBe(END - (START + 30 * 60 * 1000))
  })

  it('恰好结束(now === end)→ none(左闭右开,收窗即关闭)', () => {
    const v = discountCountdown(END, START, END)
    expect(v.phase).toBe('none')
    expect(v.labelKey).toBeNull()
    expect(v.remainingMs).toBeUndefined()
  })

  it('窗口开始前 → upcoming,remainingMs = 距开窗', () => {
    const v = discountCountdown(START - 60 * 1000, START, END)
    expect(v.phase).toBe('upcoming')
    expect(v.labelKey).toBe('discount.upcoming')
    expect(v.remainingMs).toBe(60 * 1000)
  })

  it('窗口结束后 → none', () => {
    expect(discountCountdown(END + 1, START, END).phase).toBe('none')
  })

  it('跨午夜窗口(23:00 → 次日 01:00)→ 窗口内判 active', () => {
    const start = Date.UTC(2026, 8, 24, 23, 0, 0)
    const end = Date.UTC(2026, 8, 25, 1, 0, 0)
    const mid = Date.UTC(2026, 8, 25, 0, 30, 0)
    expect(discountCountdown(mid, start, end).phase).toBe('active')
    expect(discountCountdown(start, start, end).phase).toBe('active')
    expect(discountCountdown(end, start, end).phase).toBe('none')
  })

  it('非法区间(start > end)→ none 且不抛异常', () => {
    expect(() => discountCountdown(START, END, START)).not.toThrow()
    const v = discountCountdown(START, END, START)
    expect(v.phase).toBe('none')
    expect(v.labelKey).toBeNull()
  })

  it('NaN / Infinity 入参 → none 且不抛异常(坏配置不炸对话流)', () => {
    expect(() => discountCountdown(NaN, START, END)).not.toThrow()
    expect(discountCountdown(NaN, START, END).phase).toBe('none')
    expect(discountCountdown(START, NaN, END).phase).toBe('none')
    expect(discountCountdown(START, START, Infinity).phase).toBe('none')
  })

  it('formatDurationHuman:900 万 ms → 2小时30分(台账原文示例)', () => {
    expect(formatDurationHuman(9_000_000)).toBe('2小时30分')
    expect(formatDurationHuman(7_200_000)).toBe('2小时')
    expect(formatDurationHuman(1_800_000)).toBe('30分')
    expect(formatDurationHuman(59_999)).toBe('0分')
  })

  it('formatDurationHuman:负数 / NaN → 0分 不抛异常(负时长不渲染负文案)', () => {
    expect(() => formatDurationHuman(-5_000)).not.toThrow()
    expect(formatDurationHuman(-5_000)).toBe('0分')
    expect(formatDurationHuman(NaN)).toBe('0分')
    expect(formatDurationHuman(0)).toBe('0分')
  })

  it('formatDurationHuman:单位词可替换(en/ja/ko 由词包 duration.* 组装)', () => {
    expect(formatDurationHuman(9_000_000, { hour: 'h', minute: 'm' })).toBe('2h30m')
    expect(formatDurationHuman(9_000_000, { hour: '時間', minute: '分' })).toBe('2時間30分')
    expect(formatDurationHuman(9_000_000, { hour: '시간', minute: '분' })).toBe('2시간30분')
    expect(ZH_DURATION_UNITS).toEqual({ hour: '小时', minute: '分' })
  })

  it('upcoming 文案链:remainingMs 直接喂 formatDurationHuman 得人类可读时长', () => {
    const v = discountCountdown(START - 9_000_000, START, END)
    expect(v.phase).toBe('upcoming')
    expect(formatDurationHuman(v.remainingMs ?? -1)).toBe('2小时30分')
  })
})

describe('D67 不充值可用心智 / 边界判据正反例', () => {
  it('正例:当次请求因额度被拒 → 显示', () => {
    expect(shouldShowOwnershipCard({ rejectedByQuota: true, kind: 'personalDaily' })).toBe(true)
  })

  it('反例:预防性展示(余额尚够时的提醒)→ 一律不显示', () => {
    expect(shouldShowOwnershipCard({ rejectedByQuota: false, kind: 'personalDaily' })).toBe(false)
    expect(shouldShowOwnershipCard({ rejectedByQuota: false, kind: 'teamAdmin' })).toBe(false)
  })

  it('反例:被拒但归属未知(kind=null)→ 不显示硬塞卡', () => {
    expect(shouldShowOwnershipCard({ rejectedByQuota: true, kind: null })).toBe(false)
  })

  it('诱导风险正例:免费档仍可用 + personalDaily → true', () => {
    expect(isInducementRisk({ kind: 'personalDaily', freeTierAvailable: true })).toBe(true)
  })

  it('诱导风险反例:免费档真不可用 / 非自助充值型归属 → false', () => {
    expect(isInducementRisk({ kind: 'personalDaily', freeTierAvailable: false })).toBe(false)
    expect(isInducementRisk({ kind: 'freeModelDaily', freeTierAvailable: true })).toBe(false)
    expect(isInducementRisk({ kind: 'teamAdmin', freeTierAvailable: true })).toBe(false)
    expect(isInducementRisk({ kind: 'billingGroupCredits', freeTierAvailable: true })).toBe(false)
  })

  it('边界落地:免费档可用时 personalDaily 剔除付费动作(判定层落地,非渲染层自觉)', () => {
    const gated = quotaOwnershipView('personalDaily', { freeTierAvailable: true })
    expect(gated.actionKeys).toEqual(['viewUsage', 'switchFreeModel'])
    expect(gated.actionKeys).not.toContain('upgradeOrAdmin')
  })

  it('边界不误伤:escalate 两型的"联系管理员"动作不受免费档可用影响', () => {
    for (const kind of ['teamAdmin', 'billingGroupCredits'] as const) {
      const view = quotaOwnershipView(kind, { freeTierAvailable: true })
      expect(view.actionKeys, kind).toContain('upgradeOrAdmin')
      expect(view.escalate, kind).toBe(true)
    }
  })
})

describe('D67 与 D71 error-catalog 协同 / fromErrorCode 窄映射', () => {
  it('BUDGET_EXHAUSTED / TRIAL_QUOTA_EXCEEDED → personalDaily', () => {
    expect(fromErrorCode('BUDGET_EXHAUSTED')).toBe('personalDaily')
    expect(fromErrorCode('TRIAL_QUOTA_EXCEEDED')).toBe('personalDaily')
  })

  it('PROVIDER_QUOTA_EXHAUSTED → freeModelDaily(厂商通道限额,非账户问题)', () => {
    expect(fromErrorCode('PROVIDER_QUOTA_EXHAUSTED')).toBe('freeModelDaily')
  })

  it('非归属码(限流/并发)虽在 error-catalog 表内,也不硬塞归属', () => {
    expect(isKnownErrorCode('RATE_LIMITED')).toBe(true)
    expect(fromErrorCode('RATE_LIMITED')).toBeNull()
    expect(isKnownErrorCode('CONCURRENCY_LIMIT_EXCEEDED')).toBe(true)
    expect(fromErrorCode('CONCURRENCY_LIMIT_EXCEEDED')).toBeNull()
  })

  it('未收录码 / 空值 → null(与 error-catalog "宁可不渲染"同一纪律)', () => {
    expect(fromErrorCode('NOT_A_REAL_QUOTA_CODE')).toBeNull()
    expect(fromErrorCode('')).toBeNull()
    expect(fromErrorCode(null)).toBeNull()
    expect(fromErrorCode(undefined)).toBeNull()
  })
})
// [tail-watermark-placeholder]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
