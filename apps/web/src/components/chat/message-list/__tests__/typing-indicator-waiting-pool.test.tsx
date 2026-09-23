// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D79 web 接线取证(第 62 轮):对话流等待态必须**真的**把象限/阶段/seed 传下去。
// 刻意用可辨识的合成池文案而非真实词包 —— 这层要证的是"渲染位是否接通";
// 词包可达性由 packages/shared/tests/chat/waiting-pool.test.ts 与端内合并视图用例各自钉。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WAITING_PHASES } from '@ihui/shared/chat'

const FIXED = '等待响应…'
/**
 * 池文案带前缀、固定串不带 ⇒ 由此区分"接线"与"回退"。
 * 注意:渲染位把 `waiting.` 前缀剥掉后再交给 `useTranslations('waiting')`,
 * 所以这里按 **ns** 判定是不是池取词(按 key 前缀判会永远不命中 ⇒ 静默落英文兜底表)。
 */
vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string): string => {
      if (key === 'waitingResponse') return FIXED
      if (ns === 'waiting') return `[池:waiting.${key}]`
      return key
    },
  useLocale: () => 'zh-CN',
}))

import { TypingIndicator } from '../message-item-parts'

const text = (): string => screen.getByTestId('typing-indicator').textContent ?? ''

afterEach(() => {
  cleanup()
})

describe('TypingIndicator 等待池接线(D79)', () => {
  it('不传象限/阶段 → 回退固定串(存量调用方零影响)', () => {
    render(<TypingIndicator reasoning={undefined} toolCalls={undefined} />)
    expect(text()).toContain(FIXED)
  })

  it('传 agent + 各阶段 + seed → 进池(拿到池文案且不再是固定串)', () => {
    for (const phase of WAITING_PHASES) {
      render(<TypingIndicator waitQuadrant="agent" waitPhase={phase} waitSeed={7} />)
      expect(text()).toContain('[池:')
      expect(text()).not.toContain(FIXED)
      cleanup()
    }
  })

  it('同 seed 稳定、异 seed 会变(一次等待内不跳字,跨期才轮换)', () => {
    const read = (seed: number): string => {
      render(<TypingIndicator waitQuadrant="agent" waitPhase="first" waitSeed={seed} />)
      const t = text()
      cleanup()
      return t
    }
    expect(read(11)).toBe(read(11))
    const seen = new Set<string>()
    for (let i = 0; i < 12; i++) seen.add(read(i * 37))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('象限/阶段缺一个就不进池(契约是"两个都给"才启用,防半接状态静默失效)', () => {
    render(<TypingIndicator waitQuadrant="agent" waitPhase={undefined} waitSeed={3} />)
    expect(text()).toContain(FIXED)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
