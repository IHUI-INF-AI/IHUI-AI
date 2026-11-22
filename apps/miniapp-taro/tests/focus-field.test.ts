// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 小程序端聚焦描边的判据锁。测的是纯函数 `computeFocusStyle` / `hasRestingBorder`,
// 不测渲染 —— 渲染 Taro 组件要 mock `@tarojs/components` 一整层,那种测试断在第一处
// 无关依赖上,证不了"取哪一档"这件事本身。
import { describe, expect, it } from 'vitest'

import {
  FOCUS_INK_BORDER,
  computeFocusStyle,
  hasRestingBorder,
  mergeFocusStyle,
} from '../src/components/focus-field-style'

describe('聚焦描边取档', () => {
  it('聚焦色只认 `var(--color-primary)`(墨档,亮纯黑/暗纯白)—— 与 web/RN 同档', () => {
    expect(computeFocusStyle(true, 'flex-1 px-3 text-sm')?.borderColor).toBe('var(--color-primary)')
    expect(FOCUS_INK_BORDER).toBe('var(--color-primary)')
  })

  // 阳性对照:本仓真实出过的错是把聚焦档取成强调蓝(brandAccent)或灰(ring)。
  // 若有人改回去,上面那条必红;这条把"不是蓝、不是灰"再钉一次,免得只断言等于常量时
  // 有人把常量一起改掉(那等于把断言改成复读实现)。
  it('不得取成 brand-accent 蓝档或 ring 灰档(这两种都出现过)', () => {
    const c = computeFocusStyle(true, 'x')?.borderColor as string
    expect(c).not.toContain('brand-accent')
    expect(c).not.toContain('ring')
  })

  it('自身没有描边的输入框:常态先占 1px 透明位 ⇒ 聚焦不产生布局跳动', () => {
    const rest = computeFocusStyle(false, 'w-full rounded-sm bg-muted')
    expect(rest).toMatchObject({ borderWidth: '1px', borderColor: 'transparent' })
    const focus = computeFocusStyle(true, 'w-full rounded-sm bg-muted')
    expect(focus?.borderWidth).toBe('1px')
    expect(focus?.borderColor).toBe(FOCUS_INK_BORDER)
  })

  it('调用方已自己画描边:常态**不得**被涂成透明(那会让可见边框消失)', () => {
    expect(computeFocusStyle(false, 'border border-input rounded-sm')).toBeUndefined()
    expect(computeFocusStyle(false, 'focus:border-primary')).toBeUndefined()
    expect(computeFocusStyle(false, 'border-primary/20')).toBeUndefined()
  })

  it('调用方已画描边时,聚焦只补颜色、不补宽度', () => {
    const f = computeFocusStyle(true, 'border border-input')
    expect(f?.borderColor).toBe(FOCUS_INK_BORDER)
    expect(f?.borderWidth).toBeUndefined()
  })

  it('失焦必须回到常态(聚焦态不得粘住)', () => {
    expect(computeFocusStyle(false, 'x')).not.toMatchObject({ borderColor: FOCUS_INK_BORDER })
  })
})

describe('与调用方 style 的合并次序', () => {
  it('调用方给对象:本组件只补缺,同一条属性仍由调用方赢', () => {
    const m = computeFocusStyle(true, 'x')
    const merged = mergeFocusStyle(m, { borderColor: 'pink' }) as Record<string, string>
    expect(merged.borderColor).toBe('pink')
    expect(merged.borderWidth).toBe('1px')
  })
  it('调用方给 CSS 文本串:必须拼接而不是展开(Taro 的 style 允许字符串,展开会 TS2698)', () => {
    const merged = mergeFocusStyle(
      { borderWidth: '1px', borderColor: 'transparent' },
      'color:red',
    ) as string
    expect(typeof merged).toBe('string')
    expect(merged).toMatch(/border-width:1px/)
    expect((merged as string).endsWith('color:red')).toBe(true)
  })
  it('本组件无话可说时不得凭空产出 style(常态已画描边的输入框应逐字不变)', () => {
    expect(mergeFocusStyle(undefined, 'border border-input')).toBe('border border-input')
    expect(mergeFocusStyle(undefined, undefined)).toBeUndefined()
  })
})

describe('hasRestingBorder 的边界', () => {
  it('圆角与分割线类不算描边', () => {
    expect(hasRestingBorder('rounded-sm bg-muted')).toBe(false)
    expect(hasRestingBorder('divide-border')).toBe(false)
  })
  it('变体/染色/任意值形态都算描边', () => {
    for (const c of [
      'border',
      'border-2',
      'border-input',
      'border-primary/20',
      'dark:border-x',
      '!border-y',
      'border-[2rpx]',
    ]) {
      expect(hasRestingBorder(c)).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
