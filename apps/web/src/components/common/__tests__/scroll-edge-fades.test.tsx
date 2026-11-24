// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ScrollEdgeFades(滚动视口边缘淡出,多端一致规格)挂载级 DOM 对账。
 *
 * 覆盖两条历史病根:
 * ① 显隐判据本身(顶=scrollTop>1;底=scrollTop+clientHeight<scrollHeight-1,1px 容差);
 * ② 2026-11-10 根治的「内容增删不触发重算」——旧实现只挂 RO(容器),
 *    侧栏展开分组 / 聊天加载历史(scrollHeight 变、容器尺寸不变、无 scroll 事件)
 *    遮罩不更新。现补 MutationObserver(childList+subtree),本测试第 4 条直接钉住它。
 *
 * happy-dom 无真实布局:scrollHeight/clientHeight/scrollTop 用 defineProperty 打桩;
 * rAF 打桩为同步执行(schedule 的 raf 闩在同步回调下必须返回 0,否则闩死)。
 * 断言用裸 DOM 匹配器(本仓未装 @testing-library/jest-dom)。
 */

import * as React from 'react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScrollEdgeFades from '../ScrollEdgeFades'

interface FakeMetrics {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}

function Harness({ metrics }: { metrics: FakeMetrics }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    for (const key of ['scrollTop', 'clientHeight', 'scrollHeight'] as const) {
      Object.defineProperty(el, key, { configurable: true, get: () => metrics[key] })
    }
  })
  return (
    <div className="relative">
      <div ref={ref} data-testid="scroller">
        <div data-testid="content-a">A</div>
      </div>
      <ScrollEdgeFades scrollRef={ref} />
    </div>
  )
}

/** 取两条淡出层(渲染顺序:top 在前、bottom 在后,与组件 JSX 一致) */
function fades(container: HTMLElement) {
  const nodes = Array.from(container.querySelectorAll('div[aria-hidden="true"]'))
  expect(nodes.length).toBe(2)
  return { top: nodes[0] as HTMLElement, bottom: nodes[1] as HTMLElement }
}

const opacity = (el: HTMLElement) => el.style.opacity

describe('ScrollEdgeFades', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('静止顶端:顶部隐藏、底部按溢出显示', () => {
    const metrics = { scrollTop: 0, clientHeight: 100, scrollHeight: 300 }
    const { container } = render(<Harness metrics={metrics} />)
    const { top, bottom } = fades(container)
    expect(opacity(top)).toBe('0')
    expect(opacity(bottom)).toBe('1')
  })

  it('滚动中:上下都有溢出 ⇒ 双遮罩显现', () => {
    const metrics = { scrollTop: 0, clientHeight: 100, scrollHeight: 300 }
    const { container, getByTestId } = render(<Harness metrics={metrics} />)
    metrics.scrollTop = 150
    fireEvent.scroll(getByTestId('scroller'))
    const { top, bottom } = fades(container)
    expect(opacity(top)).toBe('1')
    expect(opacity(bottom)).toBe('1')
  })

  it('触底(1px 容差内):底部遮罩收起,顶部保留', () => {
    const metrics = { scrollTop: 0, clientHeight: 100, scrollHeight: 300 }
    const { container, getByTestId } = render(<Harness metrics={metrics} />)
    metrics.scrollTop = 200 // 200+100 = scrollHeight,无下方溢出
    fireEvent.scroll(getByTestId('scroller'))
    const { top, bottom } = fades(container)
    expect(opacity(top)).toBe('1')
    expect(opacity(bottom)).toBe('0')
  })

  it('无 scroll 事件的内容增长(DOM 增删)也重算溢出 —— 钉住 MutationObserver 补链路', async () => {
    // 初始恰好无溢出:遮罩全隐藏
    const metrics = { scrollTop: 0, clientHeight: 100, scrollHeight: 100 }
    const { container, getByTestId } = render(<Harness metrics={metrics} />)
    expect(opacity(fades(container).bottom)).toBe('0')

    // 模拟「加载历史 / 展开分组」:children 增加 + scrollHeight 变,但不派发 scroll
    metrics.scrollHeight = 400
    await act(async () => {
      const child = document.createElement('div')
      child.textContent = 'B'
      getByTestId('scroller').appendChild(child)
      await Promise.resolve() // 冲刷 MO 微任务
    })
    expect(opacity(fades(container).bottom)).toBe('1')
  })

  it('遮罩几何与穿透:24px、贴边、pointer-events-none、纯渐变(无实底平台)', () => {
    const metrics = { scrollTop: 0, clientHeight: 100, scrollHeight: 300 }
    const { container } = render(<Harness metrics={metrics} />)
    const { top, bottom } = fades(container)
    for (const el of [top, bottom]) {
      expect(el.style.height).toBe('24px')
      // pointer-events 由 Tailwind class 提供(非内联样式,happy-dom 不做样式计算)
      expect(el.className).toContain('pointer-events-none')
    }
    expect(top.className).toContain('top-0')
    expect(bottom.className).toContain('bottom-0')
    // 渐变串断言走源码级:happy-dom CSSOM 不识别 color-mix() 会整条丢弃 backgroundImage,
    // DOM 上读不到(真浏览器实测渐变正常,见 2026-11-10 浏览器验证)。
    // 规格钉:纯渐变 = 0% 实底 → 100% 透明,且透明端必须用 color-mix 同色 0%(防灰带),
    // 不得出现中间实底停靠点(旧 56px 平台方案回潮即红)。
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../ScrollEdgeFades.tsx'),
      'utf8',
    )
    const gradients = src.match(/linear-gradient\([^)]*\)[^']*?\)/g) ?? []
    expect(gradients.length).toBeGreaterThanOrEqual(2)
    for (const g of gradients) {
      expect(g).toContain('0%, transparent) 100%')
      expect(g).toContain('color-mix(in srgb')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
