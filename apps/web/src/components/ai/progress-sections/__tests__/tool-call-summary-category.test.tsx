// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * D58 工具类目聚合层 · 卡片渲染侧。
 * 覆盖:同类连续步骤聚合成多张卡(被中断断卡)、折叠点击埋点三字段、
 * ShowMoreList "更多"容器、countable=false 类目仍可渲染标题。
 * 复用既有通道(useAnalytics / FoldableSection),不新建折叠组件。
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const track = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

// Tooltip 基于 radix,需 TooltipProvider;本测试不测 tooltip 本身,剪掉避免 provider 依赖
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({
    track,
    trackPageView: vi.fn(),
    trackClick: vi.fn(),
    flush: vi.fn(),
    flushBeacon: vi.fn(),
  }),
}))

import { ToolCallSummaryCard } from '../tool-call-summary-card'

afterEach(() => {
  cleanup()
  track.mockClear()
})

describe('D58 卡片 · 同类连续聚合成卡(被中断断卡)', () => {
  it('read,read,edit,read → 3 张类目卡(file_read / file_modify / file_read)', () => {
    const { container } = render(
      <ToolCallSummaryCard
        toolCalls={[
          { toolName: 'read_file' },
          { toolName: 'read_file' },
          { toolName: 'edit_file' },
          { toolName: 'read_file' },
        ]}
      />,
    )
    const cards = container.querySelectorAll('[data-testid^="tool-call-category-"]')
    expect(cards).toHaveLength(3)
    // 类目键顺序:file_read → file_modify → file_read(不连续不聚合)
    const keys = Array.from(cards).map((el) =>
      (el.getAttribute('data-testid') ?? '').replace('tool-call-category-', ''),
    )
    expect(keys).toEqual(['file_read', 'file_modify', 'file_read'])
  })

  it('连续同类合并:read,read,read → 仅 1 张 file_read 卡', () => {
    const { container } = render(
      <ToolCallSummaryCard
        toolCalls={[
          { toolName: 'read_file' },
          { toolName: 'read_file' },
          { toolName: 'read_file' },
        ]}
      />,
    )
    const cards = container.querySelectorAll('[data-testid^="tool-call-category-"]')
    expect(cards).toHaveLength(1)
    // ?. :缺元素时 getAttribute 得 undefined,对具体期望照样判失败
    expect(cards[0]?.getAttribute('data-testid')).toBe('tool-call-category-file_read')
  })
})

describe('D58 卡片 · 折叠点击埋点', () => {
  it('点击类目卡头部 → 经既有通道上报 cardType/group_key/children_count', () => {
    const { container } = render(
      <ToolCallSummaryCard
        toolCalls={[
          { toolName: 'read_file' },
          { toolName: 'read_file' },
          { toolName: 'edit_file' },
        ]}
      />,
    )
    // 第一张是 file_read 卡(含 2 次连续调用)
    const fileReadCard = container.querySelector('[data-testid="tool-call-category-file_read"]')
    expect(fileReadCard).not.toBeNull()
    const header = fileReadCard!.querySelector<HTMLElement>('button[data-section-header="true"]')!
    fireEvent.click(header)

    expect(track).toHaveBeenCalledTimes(1)
    const event = track.mock.calls[0]?.[0]
    expect(event.name).toBe('tool_category_toggle')
    expect(event.category).toBe('ai')
    expect(event.props).toMatchObject({
      cardType: 'tool_category',
      group_key: 'file_read',
      children_count: 2,
    })
  })

  it('不同类目卡各自上报对应 group_key', () => {
    const { container } = render(
      <ToolCallSummaryCard toolCalls={[{ toolName: 'run_command' }, { toolName: 'web_search' }]} />,
    )
    const cmdCard = container.querySelector('[data-testid="tool-call-category-command"]')!
    fireEvent.click(cmdCard.querySelector<HTMLElement>('button[data-section-header="true"]')!)

    expect(track).toHaveBeenCalledTimes(1)
    expect(track.mock.calls[0]?.[0].props).toMatchObject({
      cardType: 'tool_category',
      group_key: 'command',
      children_count: 1,
    })
  })
})

describe('D58 卡片 · ShowMoreList "更多"容器', () => {
  it('类目超过 6 个时渲染"更多"按钮', () => {
    const tools = [
      'read_file',
      'write_file',
      'edit_file',
      'delete_file',
      'search_codebase',
      'run_command',
      'web_search',
      'use_skill',
    ]
    const { container } = render(
      <ToolCallSummaryCard toolCalls={tools.map((t) => ({ toolName: t }))} />,
    )
    const more = container.querySelector('[data-testid="tool-call-summary-category-list-more"]')
    expect(more).not.toBeNull()
    // 按钮文案含隐藏数量
    expect(more!.textContent).toMatch(/\(\d+\)/)
  })

  it('类目 ≤ 6 个时不渲染"更多"按钮', () => {
    const { container } = render(
      <ToolCallSummaryCard
        toolCalls={['read_file', 'write_file', 'edit_file'].map((t) => ({ toolName: t }))}
      />,
    )
    const more = container.querySelector('[data-testid="tool-call-summary-category-list-more"]')
    expect(more).toBeNull()
  })
})

describe('D58 卡片 · countable=false 类目仍渲染标题', () => {
  it('thinking 类目卡存在且标题取自 labelKey', () => {
    const { container } = render(<ToolCallSummaryCard toolCalls={[{ toolName: 'think' }]} />)
    const card = container.querySelector('[data-testid="tool-call-category-thinking"]')
    expect(card).not.toBeNull()
    // 标题来自 ai.pane.catThinking(mock 返回命名空间.键形式)
    const title = card!.querySelector('button[data-section-header="true"]')!.textContent ?? ''
    expect(title).toContain('catThinking')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
