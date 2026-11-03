// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账 G-1113920 的常驻锁(第二把):横幅的**可见形态**必须跟着档位走,
// 而"未判定"在屏幕上不得长成"已确认离线"。
//
// 为什么单独一把:判据分档(connectivity-grading.test.ts 证的那半)只说明状态机给什么值;
// 票面现场是**渲染层**的失真 —— 一个布尔 `isOnline` 被渲染成唯一的红色文案。所以这一把直接
// 渲染真的 `<OfflineBanner>`(不替身),按四档喂,断言文案与"红色只属于 offline"。
// i18n 走注入(`vi.mock('../src/i18n')`),假 t 返回键名本身 ⇒ 断言读的是"取到哪一格",
// 不会出现"文案写死在组件里也能过"的假绿。
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { OfflineBanner } from '../src/components/OfflineBanner'
import { rnTokens } from '@ihui/design-tokens'

// 假 t 直接把键回显:组件若写死中文(本票的旧形态),断言就会拿到中文而不是键名。
vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN',
    setLocale: async () => {},
    t: (key: string) => `KEY:${key}`,
  }),
}))

describe('G-1113920 横幅四档的可见形态', () => {
  it('offline ⇒ 渲染 network.offline 文案', () => {
    const { container } = render(<OfflineBanner banner="offline" reason="device-offline-signal" />)
    expect(container.textContent).toContain('KEY:network.offline')
    expect(container.textContent).not.toContain('KEY:network.slow')
  })

  it('slow ⇒ 渲染 network.slow,且不得同时出现断网文案(慢网 ≠ 断网)', () => {
    const { container } = render(<OfflineBanner banner="slow" reason="slow-response" />)
    expect(container.textContent).toContain('KEY:network.slow')
    expect(container.textContent).not.toContain('network.offline')
  })

  it('unconfirmed + probe-target-unreachable ⇒ 说"连不上服务器"而不是"用户没网"', () => {
    const { container } = render(
      <OfflineBanner banner="unconfirmed" reason="probe-target-unreachable" />,
    )
    expect(container.textContent).toContain('KEY:network.serverUnreachable')
    expect(container.textContent).not.toContain('network.offline')
  })

  it('unconfirmed + probe-unavailable ⇒ 走"探测本身跑不动"那一格(与上一格不同文案)', () => {
    const { container } = render(<OfflineBanner banner="unconfirmed" reason="probe-unavailable" />)
    expect(container.textContent).toContain('KEY:network.probeUnavailable')
    expect(container.textContent).not.toContain('network.offline')
  })

  it('none ⇒ 整条不渲染;缺省(props 不给)也必须是不渲染,不得默认亮红', () => {
    const { container: a } = render(<OfflineBanner banner="none" />)
    const { container: b } = render(<OfflineBanner />)
    expect(a.textContent).toBe('')
    expect(b.textContent).toBe('')
  })

  it('红色只属于 offline:三档用色分别是 error / warning / 次级文字色', () => {
    const red = render(
      <OfflineBanner banner="offline" reason="all-targets-unreachable" />,
    ).container
    const amber = render(<OfflineBanner banner="slow" reason="slow-response" />).container
    expect(red.textContent).not.toEqual('')
    // 逐档取色断言(不是"看起来不一样"):文字色直接落在 Text 的 style 上。
    // 定位必须按"叶子文本恰为该档键名",不得按 DOM 深度猜 —— 按深度会命中 pill 容器
    // (它没有 inline color),于是断言拿到 null,红的是尺子而不是组件。
    const textColor = (c: HTMLElement, key: string): string => {
      const leaf = [...c.querySelectorAll<HTMLElement>('*')].find(
        (n) => n.children.length === 0 && n.textContent === `KEY:${key}`,
      )
      if (!leaf) throw new Error(`找不到 ${key} 的文字节点:DOM 形态已变,请同步这把锁而不是放宽它`)
      return leaf.style.color
    }
    // jsdom 会把 '#FF3333' 归一成 'rgb(255, 51, 51)',所以两侧必须过同一个归一化再比 ——
    // 直接比字面量会红在书写形态上,而不是红在配色错了。归一化用浏览器自己的实现,
    // 并强制"归一结果非空且三档两两不同色",否则空串对空串会假绿。
    const canon = (v: string): string => {
      const el = document.createElement('div')
      el.style.color = v
      const out = el.style.color
      if (!out) throw new Error(`颜色无法被解析,归一化后为空: ${JSON.stringify(v)}`)
      return out
    }
    const neutral = render(
      <OfflineBanner banner="unconfirmed" reason="probe-target-unreachable" />,
    ).container
    const offline = canon(textColor(red, 'network.offline'))
    const slow = canon(textColor(amber, 'network.slow'))
    const unconf = canon(textColor(neutral, 'network.serverUnreachable'))
    expect(offline).toBe(canon(rnTokens.error.text))
    expect(slow).toBe(canon(rnTokens.warning.amberText))
    expect(unconf).toBe(canon(rnTokens.text.secondary))
    // 反空/反塌缩:三档若被归一成同一个颜色,上面三条会一起假绿
    expect(new Set([offline, slow, unconf]).size).toBe(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
