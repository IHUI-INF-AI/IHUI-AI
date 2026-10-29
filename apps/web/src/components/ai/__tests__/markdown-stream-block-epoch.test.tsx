// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 流式块 key 换代处置锁(2026-10-29 立)。
 *
 * 立因是真浏览器验证发现的结构性缺口:`judgeBlockStability` 把"上游改写"
 * (内容不再以上一拍为前缀)合法地归为**不可判**(`appendOnly: false`),但
 * `MarkdownStream` 的接线只覆盖了 `appendOnly && !stable` 那一支 —— 非追加时
 * **既不告警、也不换 epoch**,静默沿用旧 key。
 *
 * 后果不是"判错",而是**该重挂的时候没重挂**:块内容已整体换过、序号 key 不变 ⇒
 * React 按旧下标复用节点 ⇒ 段落张冠李戴、代码块折叠态与 mermaid 渲染结果串到新内容上。
 * 这一型最容易漏:stable 回退时**不会**触发块边界回退告警,只看告警会判成"一切正常"。
 *
 * 本件用两向成对钉住:
 *  ① 纯追加(常态)⇒ key 前缀**不得**换代,否则每拍整列重挂、memo 全失效;
 *  ② 非追加(上游改写)⇒ key 前缀**必须**换代。
 *
 * 注意 `MarkdownStream` 有 16ms 同帧合并节流:同步连续 rerender 会被收尾 timer 吞成一拍,
 * 故本件用 fake timers 逐拍推进(否则测的是"节流器"而不是换代判据)。
 */
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { MarkdownStream } from '@/components/ai/markdown-stream'
import { MARKDOWN_SPLIT_MIN_LENGTH } from '@/lib/markdown-stable-split'

/** 每段 > 512 字,保证真的分块;总长 > 切分门槛,保证 stable 非空。 */
function longDoc(tag: string): string {
  return Array.from({ length: 4 }, (_, i) => `第${i}段 ${tag}。` + '内容'.repeat(300)).join('\n\n')
}

/** 推进一拍:先 rerender,再走完 16ms 节流窗口,让 throttledContent 真正落地。 */
function tick(rerender: (ui: React.ReactElement) => void, content: string): void {
  act(() => {
    rerender(<MarkdownStream content={content} isStreaming />)
  })
  act(() => {
    vi.advanceTimersByTime(40)
  })
}

describe('MarkdownStream · 块 key 换代处置(纯追加不得换代 / 非追加必须换代)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    vi.useRealTimers()
    cleanup()
  })

  const warnings = (): string[] =>
    warnSpy.mock.calls.map((call: unknown[]) => String(call[0] ?? ''))
  const epochWarnings = (): string[] =>
    warnings().filter((t) => t.includes('块边界回退') || t.includes('stable 非纯追加'))

  it('纯追加(逐拍增长)⇒ 全程零换代告警', () => {
    const base = longDoc('甲')
    const { rerender } = render(<MarkdownStream content={base} isStreaming />)
    act(() => {
      vi.advanceTimersByTime(40)
    })

    for (let i = 1; i <= 6; i += 1) {
      tick(rerender, base + '\n\n追加段' + '续'.repeat(i * 40))
    }

    expect(epochWarnings()).toEqual([])
  })

  it('非纯追加(上游改写)⇒ 必须换代并告警 —— 真浏览器验证发现的缺口', () => {
    const first = longDoc('甲')
    const { rerender, container } = render(<MarkdownStream content={first} isStreaming />)
    act(() => {
      vi.advanceTimersByTime(40)
    })

    // 先走两拍纯追加,确认账本已建立且稳态无告警
    tick(rerender, first + '\n\n追加一')
    tick(rerender, first + '\n\n追加一\n\n追加二')
    expect(epochWarnings()).toEqual([])

    // 关键一步:内容整体换成另一份(不再是上一拍的前缀)——编辑后重生成 / 上级回退
    const replaced = longDoc('乙')
    expect(replaced.startsWith(first)).toBe(false)
    tick(rerender, replaced)

    const retract = warnings().filter((t) => t.includes('stable 非纯追加'))
    expect(retract).toHaveLength(1)
    expect(retract[0]).toContain('epoch=')
    // 换代后仍正常渲染(不是把内容弄丢)
    expect(container.querySelector('[data-testid="markdown-stream"]')).not.toBeNull()
  })

  it('换代是一次性的:换完之后继续纯追加,不得每拍都换代', () => {
    const first = longDoc('甲')
    const { rerender } = render(<MarkdownStream content={first} isStreaming />)
    act(() => {
      vi.advanceTimersByTime(40)
    })
    tick(rerender, first + '\n\n追加一')

    const replaced = longDoc('乙')
    tick(rerender, replaced)
    expect(warnings().filter((t) => t.includes('stable 非纯追加'))).toHaveLength(1)

    for (let i = 1; i <= 4; i += 1) {
      tick(rerender, replaced + '\n\n续' + '写'.repeat(i * 50))
    }
    expect(warnings().filter((t) => t.includes('stable 非纯追加'))).toHaveLength(1)
    expect(warnings().filter((t) => t.includes('块边界回退'))).toEqual([])
  })

  it('短内容(低于切分门槛)不参与该判据:换代告警为零', () => {
    expect(MARKDOWN_SPLIT_MIN_LENGTH).toBeGreaterThan(100)
    const { rerender } = render(<MarkdownStream content="短" isStreaming />)
    act(() => {
      vi.advanceTimersByTime(40)
    })
    tick(rerender, '短内容换了一份')
    tick(rerender, '完全不同的短内容')

    expect(epochWarnings()).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
