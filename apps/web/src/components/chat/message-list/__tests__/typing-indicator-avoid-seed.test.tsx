// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// avoidSeed 接线取证(web 渲染位):共享池的"相邻不撞同一条"约束只有调用点真的把
// 上一帧 seed 传下去才生效 —— 池本身是纯函数,不接线就永远没机会顺移。
//
// 判定手法:mock 词表把池文案渲染成 `[池:waiting.<象限>.<阶段>.<下标>]`,于是
// "撞到同一条 / 顺移一位"都能被下标精确钉住,不必依赖真实词包内容。
// 期望下标一律用 shared 的同一个纯函数反查(不手抄),否则断言退化成常量比对。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveWaitingText, waitingPoolSize, type WaitingPhase } from '@ihui/shared/chat'

vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string): string => {
      if (key === 'waitingResponse') return '[固定串]'
      if (ns === 'waiting') return `[池:waiting.${key}]`
      return key
    },
  useLocale: () => 'zh-CN',
}))

import { TypingIndicator } from '../message-item-parts'

const QUADRANT = 'agent' as const
const PHASE: WaitingPhase = 'first'
const POOL_SIZE = waitingPoolSize('zh-CN', QUADRANT, PHASE)

/** 本地下标 → 该下标的池文案(与渲染位同一取词路径:t 剥 waiting. 前缀) */
function poolTextAt(index: number): string {
  return resolveWaitingText({
    quadrant: QUADRANT,
    phase: PHASE,
    seed: index,
    t: (key) => (key.startsWith('waiting.') ? `[池:${key}]` : undefined),
  })
}

function rendered(): string {
  return screen.getByTestId('typing-indicator').textContent ?? ''
}

function renderedIndex(): number {
  const matched = /\[池:waiting\.agent\.first\.(\d+)\]/.exec(rendered())
  expect(matched, `未取到池文案,text=${rendered()}`).not.toBeNull()
  return Number(matched![1])
}

/** 纯函数按 seed 算出的下标(即"不传 avoidSeed 时应当命中的那条") */
function plainIndex(seed: number | string): number {
  const raw = resolveWaitingText({
    quadrant: QUADRANT,
    phase: PHASE,
    seed,
    t: (key) => `«${key}»`,
  })
  const matched = /«waiting\.agent\.first\.(\d+)»$/.exec(raw)
  expect(matched, `反查失败,raw=${raw}`).not.toBeNull()
  return Number(matched![1])
}

function typeIndicator(seed: number) {
  return <TypingIndicator waitQuadrant={QUADRANT} waitPhase={PHASE} waitSeed={seed} />
}

afterEach(() => {
  cleanup()
})

describe('TypingIndicator avoidSeed 接线', () => {
  it('自检:池长 5 且 seed=1 的下标非 4(否则顺移会绕回,咬不住断言)', () => {
    expect(POOL_SIZE).toBe(5)
    expect(plainIndex(1) % POOL_SIZE).not.toBe(4)
  })

  it('首帧与接线前逐字节一致(SSR/客户端第一帧手里没有 prev)', () => {
    render(typeIndicator(1))
    expect(rendered()).toBe(poolTextAt(plainIndex(1)))
  })

  it('连续两帧同 seed ⇒ 第二帧顺移一位(撞同一条必换文案)', () => {
    const { rerender } = render(typeIndicator(1))
    const first = rendered()
    const firstIndex = renderedIndex()
    rerender(typeIndicator(1))
    const second = rendered()
    expect(second).not.toBe(first)
    expect(second).toBe(poolTextAt((firstIndex + 1) % POOL_SIZE))
  })

  it('第三帧仍同 seed ⇒ 停在顺移后的那条,不逐帧抖动', () => {
    const { rerender } = render(typeIndicator(1))
    rerender(typeIndicator(1))
    const second = rendered()
    rerender(typeIndicator(1))
    expect(rendered()).toBe(second)
  })

  it('换 seed 且两条 seed 的下标本就不同 ⇒ 不顺移(约束只在撞车时介入)', () => {
    const { rerender } = render(typeIndicator(1))
    rerender(typeIndicator(1))
    expect(plainIndex(1)).not.toBe(plainIndex(2))
    rerender(typeIndicator(2))
    expect(rendered()).toBe(poolTextAt(plainIndex(2)))
  })

  it('换 seed 但新 seed 落回上一帧 seed 的那条 ⇒ 照样顺移(钉住"传 seed 而非传下标")', () => {
    const { rerender } = render(typeIndicator(1))
    const first = rendered()
    // 6 % 5 === 1 % 5 ⇒ 若接线把"上帧显示下标"当 avoidSeed,这里会误判成不同条而不顺移
    expect(plainIndex(6)).toBe(plainIndex(1))
    rerender(typeIndicator(6))
    expect(rendered()).not.toBe(first)
    expect(rendered()).toBe(poolTextAt((plainIndex(6) + 1) % POOL_SIZE))
  })

  it('上一帧渲染的是 reasoning 预览 ⇒ 不记账,进池首帧等于旧行为', () => {
    const { rerender } = render(
      <TypingIndicator
        reasoning="先想一句"
        waitQuadrant={QUADRANT}
        waitPhase={PHASE}
        waitSeed={1}
      />,
    )
    expect(rendered()).toBe('thinking') // mock 下 thinking 键即预览帧,不含池标记
    rerender(typeIndicator(1))
    expect(rendered()).toBe(poolTextAt(plainIndex(1)))
  })

  it('不传象限/阶段 ⇒ 恒走固定串(接线不得把存量调用方拽进池)', () => {
    const { rerender } = render(<TypingIndicator />)
    rerender(<TypingIndicator />)
    expect(rendered()).toBe('[固定串]')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
