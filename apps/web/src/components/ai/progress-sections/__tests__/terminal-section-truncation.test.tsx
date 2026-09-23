// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 终端输出截断的可发现性(D40/D41 渲染侧,2026-09-22 第 39 轮):
// 服务端只下发前 8000 字符时,界面报的"原文总长"必须是 totalChars 而不是截断文本自身的长度,
// 否则刷新/回放后用户会把截断当完整(本地已无更多可展开时也不给"显示更多"按钮)。
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string, values?: Record<string, string | number>): string =>
      ns === 'ai.pane' && key === 'terminal.truncated'
        ? `TOTAL=${String(values?.total ?? 'none')}`
        : `${ns}.${key}`,
}))

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: { terminalOutputs: Record<string, string> }) => unknown) =>
    selector({ terminalOutputs: {} }),
}))

// CopyButton 走 radix Tooltip(需 TooltipProvider),与被测的截断口径无关 → 直接剪掉
vi.mock('../copy-button', () => ({ CopyButton: () => null }))

import { TerminalSection } from '../terminal-section'
import type { TerminalTask } from '@/hooks/use-agent-progress'

function task(over: Partial<TerminalTask> & { id: string }): TerminalTask {
  return {
    command: 'pnpm build',
    status: 'completed',
    startedAt: '2026-09-22T00:00:00.000Z',
    ...over,
  }
}

/** 展开某条终端任务的详情(与用户点行为同一事件路径) */
function expand(container: HTMLElement, id: string): void {
  const row = container.querySelector<HTMLElement>(`[data-testid="terminal-item-${id}"]`)
  if (!row) throw new Error(`未找到终端行 terminal-item-${id}`)
  fireEvent.click(row)
}

describe('终端截断输出必须可被发现(D40/D41 渲染侧)', () => {
  afterEach(() => cleanup())

  it('服务端截断时总长取 totalChars,展开本地全文后仍继续交代', () => {
    const truncatedOutput = 'x'.repeat(8000)
    const { container } = render(
      <TerminalSection
        terminals={[
          task({
            id: 't-trunc',
            output: truncatedOutput,
            truncated: true,
            totalChars: 42000,
          }),
        ]}
      />,
    )
    expand(container, 't-trunc')
    const text = container.textContent ?? ''
    expect(text).toContain('TOTAL=42000')
    // 拿截断文本自身长度报错数 = 主动说谎
    expect(text).not.toContain('TOTAL=8000')
    expect(text).not.toContain('TOTAL=2000')
    // 本地还有 6000 字符未预览 → 「显示更多」此时是有效控件
    const more = container.querySelector<HTMLElement>('[data-testid="terminal-show-more-t-trunc"]')
    expect(more).not.toBeNull()
    fireEvent.click(more as HTMLElement)
    // 点完之后再没有"更多"可给,但服务端截掉的那 34000 字仍必须一直交代着
    expect(container.querySelector('[data-testid="terminal-show-more-t-trunc"]')).toBeNull()
    expect(container.textContent ?? '').toContain('TOTAL=42000')
  })

  it('未截断但超预览上限时仍报原文总长,并给出"显示更多"', () => {
    const localOnly = 'y'.repeat(2500)
    const { container } = render(
      <TerminalSection terminals={[task({ id: 't-local', output: localOnly })]} />,
    )
    expand(container, 't-local')
    expect(container.textContent ?? '').toContain('TOTAL=2500')
    const more = container.querySelector<HTMLElement>('[data-testid="terminal-show-more-t-local"]')
    expect(more).not.toBeNull()
    fireEvent.click(more as HTMLElement)
    // 全部展开后既没有按钮也没有"截断"提示(内容本就完整)
    expect(container.querySelector('[data-testid="terminal-show-more-t-local"]')).toBeNull()
    expect(container.textContent ?? '').not.toContain('TOTAL=')
  })

  it('旧落库记录没有 totalChars 时退回现长度口径(不得报出 NaN)', () => {
    const legacy = 'z'.repeat(8000)
    const { container } = render(
      <TerminalSection terminals={[task({ id: 't-legacy', output: legacy, truncated: true })]} />,
    )
    expand(container, 't-legacy')
    const text = container.textContent ?? ''
    expect(text).toContain('TOTAL=8000')
    expect(text).not.toContain('NaN')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
