// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 活动级虚拟化 · 组件接线锁(2026-10-29 立)。
 *
 * 纯判据的数值锁在 `activity-virtual-window.test.ts`;本件只咬"判据有没有真装车":
 *  ① 几何可用 ⇒ 容器带 `data-activity-virtualized`、每行带 `data-activity-index`,
 *     且挂载行数**少于**总行数(真的按几何收窄了,不是全量);
 *  ② 几何量不到 ⇒ 全量挂载、不带虚拟化锚点(三态纪律的降级档);
 *  ③ 条目数 ≤ 阈值 ⇒ 全量挂载(短列表全量更跟手);
 *  ④ `ShowMoreList` 展开后接上虚拟化层,展开前仍是数量截断(两层分工,不互替)。
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { ActivityVirtualList } from '../activity-virtual-list'
import { ShowMoreList } from '../show-more-list'
import { ACTIVITY_ROW_HEIGHT } from '../activity-virtual-window'

afterEach(() => cleanup())

function items(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `item-${i}`)
}

function renderList(count: number, viewportHeight?: number) {
  return render(
    <ActivityVirtualList
      items={items(count)}
      itemKeys={items(count)}
      viewportHeight={viewportHeight}
      renderItem={(item) => <div>{item}</div>}
    />,
  )
}

describe('ActivityVirtualList · 几何虚拟化真的生效', () => {
  it('条目远超阈值 + 视口可用 ⇒ 带虚拟化锚点,且挂载行数少于总行数', () => {
    const { container } = renderList(400, 400)
    const root = container.querySelector<HTMLElement>('[data-testid="activity-virtual-list"]')
    expect(root).not.toBeNull()
    expect(root!.getAttribute('data-activity-virtualized')).toBe('true')
    const mounted = Number(root!.getAttribute('data-activity-mounted'))
    expect(mounted).toBeGreaterThan(0)
    expect(mounted).toBeLessThan(400)
    // 每行都有机器可读锚点(e2e 用)
    const rows = root!.querySelectorAll('[data-activity-index]')
    expect(rows.length).toBe(mounted)
    expect(rows[0]?.getAttribute('data-activity-index')).toBe('0')
  })

  it('阳性对照 · 几何量不到(视口 0)⇒ 全量挂载,不带虚拟化锚点', () => {
    const { container } = renderList(400, 0)
    const root = container.querySelector<HTMLElement>('[data-testid="activity-virtual-list"]')
    expect(root).not.toBeNull()
    expect(root!.getAttribute('data-activity-virtualized')).toBeNull()
    // 这一档**留着滚动容器**(否则 clientHeight 永远量不到、虚拟化永远起不来),
    // 用 mount-mode 与"条目数不够"那一档区分开
    expect(root!.getAttribute('data-activity-mount-mode')).toBe('full')
    expect(root!.querySelectorAll('[data-activity-index]')).toHaveLength(400)
  })

  it('阳性对照 · 条目数 ≤ 阈值 ⇒ 全量挂载(不虚拟化,也不挂自管滚动容器)', () => {
    const { container } = renderList(10, 400)
    const root = container.querySelector<HTMLElement>('[data-testid="activity-virtual-list"]')
    expect(root!.getAttribute('data-activity-virtualized')).toBeNull()
    // 短列表交给外层消息列表滚,本层不抢滚动权
    expect(root!.getAttribute('data-activity-mount-mode')).toBeNull()
    expect(root!.querySelectorAll('[data-activity-index]')).toHaveLength(10)
  })
})

describe('ActivityVirtualList · 揭示去重(用户上滚不得被拽回)', () => {
  it('显式揭示滚到居中是"一次"动作:用户随后上滚,视口停在用户位置', () => {
    const { container } = render(
      <ActivityVirtualList
        items={items(400)}
        itemKeys={items(400)}
        revealItemIndex={50}
        viewportHeight={400}
        renderItem={(item) => <div>{item}</div>}
      />,
    )
    const root = container.querySelector<HTMLElement>('[data-testid="activity-virtual-list"]')!
    // 揭示落点 = 第 50 行居中
    expect(root.scrollTop).toBe(50 * ACTIVITY_ROW_HEIGHT - (400 - ACTIVITY_ROW_HEIGHT) / 2)
    // 用户上滚(改变 scrollTop 才会让 plan 重算并把效应再跑一遍)
    root.scrollTop = 200
    fireEvent.scroll(root)
    // 若判据没有去重闩锁,这一帧的 offsets 重算会把视口再拽回揭示目标
    expect(root.scrollTop).toBe(200)
  })
})

describe('ShowMoreList · 数量截断与几何虚拟化分工', () => {
  function renderMore(itemCount: number) {
    return render(
      <ShowMoreList
        items={items(itemCount)}
        itemKeys={items(itemCount)}
        initialCount={6}
        virtualizeThreshold={20}
        testId="demo-list"
        renderItem={(item, index) => <div data-row={index}>{item}</div>}
      />,
    )
  }

  it('展开前:只挂前 6 项 + 「更多」按钮(数量截断仍在)', () => {
    const { container } = renderMore(60)
    expect(container.querySelectorAll('[data-row]')).toHaveLength(6)
    expect(container.querySelector('[data-testid="demo-list-more"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="demo-list-virtual"]')).toBeNull()
  })

  it('展开后:超过阈值的条目走几何虚拟化容器(不是一次性挂 60 行)', () => {
    const { container } = renderMore(60)
    fireEvent.click(container.querySelector('[data-testid="demo-list-more"]')!)
    const virtual = container.querySelector<HTMLElement>('[data-testid="demo-list-virtual"]')
    expect(virtual).not.toBeNull()
    // happy-dom 无布局引擎 ⇒ 量不到视口 ⇒ 全量挂载档(降级纪律:不猜区间)。
    // 这里断言的是"接上了虚拟化层",几何收窄本身由纯判据用例锁死。
    expect(virtual!.querySelectorAll('[data-activity-index]')).toHaveLength(60)
  })

  it('展开后条目数 ≤ 阈值:仍走全量 slice,不引入虚拟化层', () => {
    const { container } = render(
      <ShowMoreList
        items={items(8)}
        initialCount={6}
        virtualizeThreshold={20}
        testId="small-list"
        renderItem={(item: string, index: number): ReactNode => <div data-row={index}>{item}</div>}
      />,
    )
    const more = container.querySelector('[data-testid="small-list-more"]')
    if (more) fireEvent.click(more)
    expect(container.querySelector('[data-testid="small-list-virtual"]')).toBeNull()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(8)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
