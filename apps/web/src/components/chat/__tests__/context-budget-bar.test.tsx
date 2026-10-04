// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‍‌‌‌‌‍‌‌‌‌‌‌‍‌‌‌‌‍‌‍‌‌‌‌‌‍‌‌‍‍‌‌‌‌‌‌‌‌‍‌‌‌‌‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‌‌‍‍‌‌‌‍‌‌‌‌‍‌‌‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‍‍‍⁠

// G-376(= G-404 重复登记副本)组件层落点判据:瞬时假值不得覆盖上一个可信值。
//
// 票面把落点写在这张卡的 tokens 守卫上(只判 `!== undefined`),但**判据的真实归属
// 是写入面**:budget-state.setBudgetEvent 是 budget 帧的唯一写点,它过
// `resolveContextUsedSample` 投影,非例外阶段的 used=0 整帧 held(不进 store、不通知)。
// 因此本组件经 useSyncExternalStore 读到的快照**结构上不可能含瞬时 0** ——
// "在读面再加一道防瞬时"等于端内另写第二份判据(context-used-sample.ts:16-17 明禁)。
//
// 所以本文件不测"组件自己防瞬时",而测**端到端不变量**:帧从唯一写点进去,
// 这张卡渲染出来的占用任何时刻都不得闪 0%(除权威例外)。断言打在渲染出的真语包文本上。
//
// 三格成对(缺一不可):
//   正例   —— 真实非零 → 瞬时 0 ⇒ 仍显示上一个可信值(不是 0%);
//   反例①  —— 权威的"确实没有"(例外阶段登记后的 0)⇒ 必须显示 0%,不得被误挡;
//   反例②  —— 不传事件 / 字段缺失 ⇒ 与本票改动前逐字一致。

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const here = dirname(fileURLToPath(import.meta.url))
// __tests__ → chat → components → src → web → apps → 仓库根(6 层)
const repoRoot = resolve(here, '../../../../../../')
const readPack = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(repoRoot, 'packages/i18n/messages', name), 'utf8')) as Record<
    string,
    unknown
  >
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
/** 与 @ihui/i18n mergeMessages 同语义:web 端覆盖 shared */
const mergePack = (
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const b = out[k]
    out[k] = isRecord(b) && isRecord(v) ? mergePack(b, v) : v
  }
  return out
}
const PACK = mergePack(readPack('shared/zh-CN.json'), readPack('web/zh-CN.json'))
const lookup = (ns: string, key: string): unknown =>
  [...ns.split('.'), ...key.split('.')].reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object' && !Array.isArray(node)
        ? (node as Record<string, unknown>)[part]
        : undefined,
    PACK,
  )

// mock 必须是模块级稳定引用:工厂内一次性定义,渲染间不换新函数
vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string, values?: Record<string, unknown>): string => {
      const raw = lookup(ns, key)
      if (typeof raw !== 'string' || raw === '') return `MISSING:${ns}.${key}`
      // 真语包带 {used} 占位:照票面组件口径做插值,断言才落在用户真看到的文本上
      return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
        values && name in values ? String(values[name]) : whole,
      )
    },
  useLocale: () => 'zh-CN',
}))

import { ContextBudgetBar } from '../context-budget-bar'
import {
  clearBudgetEvent,
  noteBudgetTrustedZeroPhase,
  setBudgetEvent,
} from '@/hooks/use-chat/budget-state'
import type { BudgetEvent } from '@ihui/api-client'

afterEach(() => {
  cleanup()
  clearBudgetEvent()
})

/** 帧上的用量:60000/100000 ⇒ formatTokenCount 走 K 分支 ⇒ "60K / 100K" */
const trusted: BudgetEvent = {
  level: 'warning',
  percent: 60,
  usedTokens: 60000,
  limitTokens: 100000,
}
/** 普通工具调用期间的那枚瞬时 0(percent 也报 0 —— 整帧都是坏采样) */
const transientZero: BudgetEvent = {
  level: 'warning',
  percent: 0,
  usedTokens: 0,
  limitTokens: 100000,
}
/** 权威的"确实没有":例外阶段登记后紧随的那一枚 0 */
const authoritativeZero: BudgetEvent = {
  level: 'warning',
  percent: 0,
  usedTokens: 0,
  limitTokens: 100000,
}
/** 字段缺失帧:不带走量(usedTokens/limitTokens 皆 undefined) */
const noUsageFrame: BudgetEvent = { level: 'critical', percent: 98 }

/** 整条卡的可见文本(精确比对,不用子串 —— "60K" 含子串 "0K",子串断言会自己骗自己) */
const badge = (container: HTMLElement): string =>
  container.querySelector('[data-testid="context-budget-bar"]')?.textContent ?? ''

/** tokens 段那一条 span 的文本 —— "已用 X / Y"。该段缺席时返回 null(反例②要判的就是它缺席) */
const tokensLine = (container: HTMLElement): string | null => {
  for (const span of container.querySelectorAll('[data-testid="context-budget-bar"] span')) {
    const text = span.textContent ?? ''
    if (text.startsWith('已用')) return text
  }
  return null
}

// formatTokenCount 的真实取值(见 packages/shared/src/utils/format.ts:46):
//   60000 → "60K"(≥1000 走 K 分支);0 → "0"(不到 1000,原样 String)
const TRUSTED_TEXT = '今日 AI 额度已用 60K / 100K60%'
const ZERO_TEXT = '今日 AI 额度已用 0 / 100K0%'

describe('G-376 正例:真实非零 → 瞬时 0 ⇒ 仍显示上一个可信值', () => {
  it('瞬时 0 帧进唯一写点后,卡上不得出现 0%(重渲机会也不得闪)', () => {
    setBudgetEvent(trusted)
    const first = render(<ContextBudgetBar />)
    expect(badge(first.container)).toBe(TRUSTED_TEXT)
    first.unmount()

    // 帧真的进来了(写入面确实收到了 used=0),但被 held ⇒ store 快照不动
    setBudgetEvent(transientZero)

    // 换一个重渲机会:即使组件因别的原因重渲染,读到的快照仍是上一个可信采样
    const second = render(<ContextBudgetBar />)
    // 逐字相等 ⇒ 0% 闪断结构上不可能出现(整段文本里没有任何一处被 0 顶掉)
    expect(badge(second.container)).toBe(TRUSTED_TEXT)
    expect(tokensLine(second.container)).toBe('已用 60K / 100K')
  })
})

describe('G-376 反例①:权威的"确实没有"必须显示 0%(不得被防瞬时逻辑误挡)', () => {
  it('例外阶段登记后的那一枚 0 ⇒ 卡上确实是 0%(真话必须留下)', () => {
    setBudgetEvent(trusted)
    const first = render(<ContextBudgetBar />)
    expect(badge(first.container)).toBe(TRUSTED_TEXT)
    first.unmount()

    // /compact、/compress、流内 auto-compaction 的成功分支都会写这个一次性登记
    noteBudgetTrustedZeroPhase('compact')
    setBudgetEvent(authoritativeZero)

    const second = render(<ContextBudgetBar />)
    expect(badge(second.container)).toBe(ZERO_TEXT)
    // 防瞬时逻辑若写成"永远忽略 0",上一行必红(旧值 60K 会被继续挂着)
    expect(tokensLine(second.container)).toBe('已用 0 / 100K')
  })

  it('无前序可信采样时,第一枚 0 就是当下唯一事实 ⇒ 显示 0%(不得凭空造别的数)', () => {
    setBudgetEvent(authoritativeZero)
    const { container } = render(<ContextBudgetBar />)
    expect(badge(container)).toBe(ZERO_TEXT)
    expect(tokensLine(container)).toBe('已用 0 / 100K')
  })
})

describe('G-376 反例②:不传事件 / 字段缺失 ⇒ 与改动前逐字一致', () => {
  it('从未收到帧 ⇒ 整条不渲染(不占位)', () => {
    const { container } = render(<ContextBudgetBar />)
    expect(container.querySelector('[data-testid="context-budget-bar"]')).toBeNull()
  })

  it('字段缺失帧 ⇒ 不渲染 tokens 段,但百分比与档位照旧(与本票改动前逐字一致)', () => {
    setBudgetEvent(noUsageFrame)
    const { container } = render(<ContextBudgetBar />)
    const text = badge(container)
    expect(container.querySelector('[data-testid="context-budget-bar"]')).not.toBeNull()
    expect(text).toContain('98%')
    expect(text).not.toContain('MISSING:')
    // tokens 段的两个占位值都缺席 ⇒ 该段不渲染(改前的 `!== undefined` 守卫语义)
    expect(text).not.toContain('/ 100K')
    expect(text).not.toContain('0K /')
  })

  it('clearBudgetEvent 之后 ⇒ 回到"整条不渲染"', () => {
    setBudgetEvent(trusted)
    expect(
      render(<ContextBudgetBar />).container.querySelector('[data-testid="context-budget-bar"]'),
    ).not.toBeNull()
    cleanup()
    clearBudgetEvent()
    const after = render(<ContextBudgetBar />)
    expect(after.container.querySelector('[data-testid="context-budget-bar"]')).toBeNull()
  })
})
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‍‌‌‌‌‍‌‌‌‌‌‌‍‌‌‌‌‍‌‍‌‌‌‌‌‍‌‌‍‍‌‌‌‌‌‌‌‌‍‌‌‌‌‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‍‌‌‍‍‌‌‌‍‌‌‌‌‍‌‌‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‍‍‍⁠
