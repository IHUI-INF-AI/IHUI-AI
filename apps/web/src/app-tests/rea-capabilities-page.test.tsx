// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * REA 逆向能力目录 · PageClient 渲染 + 过滤锁(2026-11-15)。
 *
 * 静态目录无后端,过滤全在客户端。三条判据:
 *  ① 全量渲染锁:默认无过滤,卡片数 == REA_CAPABILITIES 长度,每张卡带
 *     data-testid="rea-capability-card"。
 *  ② 关键词过滤锁:搜"快照"只剩 snapshot 类;搜不存在的词出空态提示。
 *  ③ 分类下拉过滤锁:选 terminal 只剩 terminal 卡,计数徽章随之更新。
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('@/components/common', () => ({
  BackButton: () => <button type="button">返回</button>,
}))

// 真实 Badge 内部包 Radix Tooltip(需 TooltipProvider,由全局 layout 提供);
// 本测试只验 PageClient 的渲染/过滤逻辑,不验 Badge 本身,故 mock 成纯展示 span。
vi.mock('@/components/data', () => ({
  Badge: ({
    children,
    title,
    className,
  }: {
    children: React.ReactNode
    title?: string
    className?: string
  }) => (
    <span data-testid="mock-badge" title={title} className={className}>
      {children}
    </span>
  ),
}))

import PageClient from '../../app/(main)/rea-capabilities/PageClient'
import { REA_CAPABILITIES } from '@/data/rea-capabilities'

const cards = () => screen.getAllByTestId('rea-capability-card')

afterEach(() => {
  cleanup()
})

describe('REA 逆向能力目录 · PageClient', () => {
  it('①默认渲染全部能力卡片', () => {
    render(<PageClient />)
    expect(cards().length).toBe(REA_CAPABILITIES.length)
  })

  it('①每张卡片展示名称 + 来源徽章 + 落位路径', () => {
    render(<PageClient />)
    for (const c of REA_CAPABILITIES) {
      expect(screen.getByText(c.name), `缺 ${c.name}`).toBeTruthy()
      expect(screen.getAllByText(c.target).length, `缺落位 ${c.target}`).toBeGreaterThan(0)
    }
  })

  it('②关键词"快照"过滤到只剩 snapshot 类', () => {
    render(<PageClient />)
    const box = screen.getByPlaceholderText(/搜索名称/)
    fireEvent.change(box, { target: { value: '快照' } })
    const shown = cards()
    expect(shown.length).toBeGreaterThan(0)
    for (const card of shown) {
      expect(card.getAttribute('data-category')).toBe('snapshot')
    }
  })

  it('②无匹配关键词出空态提示,不崩', () => {
    render(<PageClient />)
    const box = screen.getByPlaceholderText(/搜索名称/)
    fireEvent.change(box, { target: { value: 'zzz-不存在的词-zzz' } })
    expect(screen.getByText(/无匹配能力/)).toBeTruthy()
    expect(screen.queryAllByTestId('rea-capability-card')).toHaveLength(0)
  })

  it('③分类下拉选 terminal 只剩 terminal 卡', () => {
    render(<PageClient />)
    const sel = screen.getByLabelText('按分类筛选') as HTMLSelectElement
    fireEvent.change(sel, { target: { value: 'terminal' } })
    const shown = cards()
    expect(shown.length).toBeGreaterThan(0)
    for (const card of shown) {
      expect(card.getAttribute('data-category')).toBe('terminal')
    }
  })

  it('③计数徽章随过滤更新(terminal 数)', () => {
    const expected = REA_CAPABILITIES.filter((c) => c.category === 'terminal').length
    render(<PageClient />)
    const sel = screen.getByLabelText('按分类筛选') as HTMLSelectElement
    fireEvent.change(sel, { target: { value: 'terminal' } })
    expect(screen.getByText(`${expected} 项`)).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
