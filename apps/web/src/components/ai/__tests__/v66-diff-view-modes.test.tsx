// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * V3 #66 组件层断言:排版投影是否**如实落到 DOM**,以及档位是否真的只有一份。
 *
 * 分工:两栏配对/折叠的行级形态由 `src/lib/__tests__/diff-split-rows.test.ts` 在纯函数层
 * 逐条钉死;本文件不重复那些断言,只测"只有 DOM 才看得见的事"(空侧占位格、折叠条能否展开、
 * 一张卡切档另一张卡跟着变)。
 *
 * ⚠️ 写这里容易踩的坑:JSX **属性字符串字面量不解析 `\n`** —— `base="a\nb\n"` 传进去的是
 * 含反斜杠的单行文本,三方对比会因此把整份文件判成一个冲突块。内容一律经 `L(...)` 表达式传入。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    if (!params) return key
    return `${key}|${Object.entries(params).map(([k, v]) => `${k}=${v}`).join('|')}`
  },
}))

vi.mock('@/stores/chat', () => ({
  useChatStore: (sel?: (s: { pendingDiffComments: never[] }) => unknown) => {
    const state = { pendingDiffComments: [] as never[] }
    return typeof sel === 'function' ? sel(state) : state
  },
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const clipboardMock = vi.hoisted(() => ({ copy: vi.fn(async () => true as boolean) }))
vi.mock('@/hooks/use-clipboard', () => ({
  useClipboard: () => ({ copy: clipboardMock.copy, copied: false }),
}))

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    success: toastMock.success,
    error: toastMock.error,
    warning: vi.fn(),
    info: vi.fn(),
    toast: {},
  }),
}))

import { InlineDiffCard } from '../inline-diff-card'
import { DiffPreview } from '../diff-preview'
import { ThreeWayMergeView } from '../inline-diff-viewer'
import { useDiffViewModeStore } from '@/lib/diff-view-mode'
import type { InlineDiffInfo } from '../types'

/** 行数组 → 文本(带结尾换行)。空数组 ⇒ 空文件 */
function L(...xs: string[]): string {
  return xs.length === 0 ? '' : `${xs.join('\n')}\n`
}

/** 一份「两处改动隔着 10 行等值上下文」的内容:足够触发一次跨 hunk 折叠 */
const OLD = L('A1', 'A2', 'A3', 'o1', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'o2', 'B1', 'B2', 'B3')
const NEW = L('A1', 'A2', 'A3', 'n1', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'n2', 'B1', 'B2', 'B3')

function diffInfo(over: Partial<InlineDiffInfo> = {}): InlineDiffInfo {
  return {
    file_path: 'src/a.ts',
    old_content: OLD,
    new_content: NEW,
    is_new_file: false,
    ...over,
  }
}

beforeEach(() => {
  localStorage.clear()
  useDiffViewModeStore.setState({ mode: 'split', threeWayOpen: false })
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe('V3 #66 判据 1:档位是单一真相源,两个渲染面共用', () => {
  it('chat 卡片按档位渲染 split / unified', () => {
    render(<InlineDiffCard diffInfo={diffInfo()} />)
    expect(screen.getByTestId('diff-split-body')).toBeTruthy()
    expect(screen.queryByTestId('diff-unified-body')).toBeNull()
    fireEvent.click(screen.getByTestId('inline-diff-mode-unified'))
    expect(screen.getByTestId('diff-unified-body')).toBeTruthy()
    expect(screen.queryByTestId('diff-split-body')).toBeNull()
  })

  it('一张卡切档,另一张卡同时跟着变(证明不是各存一份)', () => {
    const { container } = render(
      <>
        <InlineDiffCard diffInfo={diffInfo({ file_path: 'src/one.ts' })} />
        <InlineDiffCard diffInfo={diffInfo({ file_path: 'src/two.ts' })} />
      </>,
    )
    expect(container.querySelectorAll('[data-testid="diff-split-body"]').length).toBe(2)
    const firstCardUnified = screen.getAllByTestId('inline-diff-mode-unified')[0]
    if (!firstCardUnified) throw new Error('fixture')
    fireEvent.click(firstCardUnified)
    expect(container.querySelectorAll('[data-testid="diff-unified-body"]').length).toBe(2)
    expect(container.querySelectorAll('[data-testid="diff-split-body"]').length).toBe(0)
    expect(useDiffViewModeStore.getState().mode).toBe('unified')
  })

  it('档位按钮的 aria-pressed 与实际档一致(选中态不是写死的)', () => {
    render(<InlineDiffCard diffInfo={diffInfo()} />)
    const splitBtn = screen.getByTestId('inline-diff-mode-split')
    const unifiedBtn = screen.getByTestId('inline-diff-mode-unified')
    expect(splitBtn.getAttribute('aria-pressed')).toBe('true')
    expect(unifiedBtn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(unifiedBtn)
    expect(splitBtn.getAttribute('aria-pressed')).toBe('false')
    expect(unifiedBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('hunk 小标题在两种排版下都只出现一次(勾选/暂存语义不分叉)', () => {
    const { container } = render(<InlineDiffCard diffInfo={diffInfo()} />)
    expect(container.querySelectorAll('[data-testid^="diff-hunk-header-"]').length).toBe(2)
    fireEvent.click(screen.getByTestId('inline-diff-mode-unified'))
    expect(container.querySelectorAll('[data-testid^="diff-hunk-header-"]').length).toBe(2)
  })
})

describe('V3 #66 判据 2:split 排版如实落到 DOM', () => {
  it('两栏各有列头;两行内容不触发折叠', () => {
    const { container } = render(
      <DiffPreview oldContent={L('a', 'b')} newContent={L('a', 'B')} filename="x.ts" />,
    )
    expect(screen.getByTestId('diff-split-label-left').textContent).toBe('diffViewer.oldVersion')
    expect(screen.getByTestId('diff-split-label-right').textContent).toBe('diffViewer.newVersion')
    expect(container.querySelector('[data-testid^="diff-fold-"]')).toBeNull()
  })

  it('删 2 增 3:左栏产出一格占位而不是少一行(行高不塌)', () => {
    const { container } = render(
      <DiffPreview
        oldContent={L('A', 'd1', 'd2', 'B')}
        newContent={L('A', 'i1', 'i2', 'i3', 'B')}
      />,
    )
    expect(container.querySelectorAll('[data-testid="diff-empty-left"]').length).toBe(1)
    expect(container.querySelectorAll('[data-testid="diff-empty-right"]').length).toBe(0)
  })

  it('增 3 删 2:右栏两格占位,左栏无占位', () => {
    const { container } = render(
      <DiffPreview
        oldContent={L('A', 'i1', 'i2', 'i3', 'B')}
        newContent={L('A', 'd1', 'd2', 'B')}
      />,
    )
    expect(container.querySelectorAll('[data-testid="diff-empty-right"]').length).toBe(1)
    expect(container.querySelectorAll('[data-testid="diff-empty-left"]').length).toBe(0)
  })

  it('纯新增(无删除)整段:左栏每行都占位', () => {
    const { container } = render(
      <DiffPreview oldContent={L('a')} newContent={L('a', 'b', 'c')} />,
    )
    expect(container.querySelectorAll('[data-testid="diff-empty-left"]').length).toBe(2)
  })

  it('长上下文折一条,点一下能展开看回被隐去的行', () => {
    const { container } = render(<DiffPreview oldContent={OLD} newContent={NEW} />)
    const fold = container.querySelector('[data-testid^="diff-fold-"]')
    expect(fold).not.toBeNull()
    const foldId = fold?.getAttribute('data-testid')
    if (!foldId) throw new Error('fixture')
    expect(screen.queryByText('E5')).toBeNull()
    fireEvent.click(fold as HTMLElement)
    expect(container.querySelector(`[data-testid="${foldId}-expanded"]`)).not.toBeNull()
    expect(screen.queryByText('E5')).not.toBeNull()
    fireEvent.click(screen.getByTestId(`${foldId}-collapse`))
    expect(screen.queryByText('E5')).toBeNull()
  })

  it('折叠条跨两栏(col-span-2),不会只压在某一侧上', () => {
    const { container } = render(<DiffPreview oldContent={OLD} newContent={NEW} />)
    const fold = container.querySelector('[data-testid^="diff-fold-"]')
    expect(fold?.parentElement?.className).toContain('col-span-2')
  })

  it('chat 卡片切到 split 后仍可逐 hunk 勾选并部分应用', () => {
    const onApplyPartial = vi.fn(async () => undefined)
    render(<InlineDiffCard diffInfo={diffInfo()} onApplyPartial={onApplyPartial} />)
    const toggle = screen.getByTestId('diff-hunk-toggle-0') as HTMLInputElement
    expect(toggle.checked).toBe(true)
    fireEvent.click(toggle)
    expect(toggle.checked).toBe(false)
    fireEvent.click(screen.getByTestId('diff-hunk-apply-selected'))
    expect(onApplyPartial).toHaveBeenCalledTimes(1)
    // 勾掉 hunk0 ⇒ 落盘内容保留原文那一段、只应用 hunk1
    const applied = String((onApplyPartial.mock.calls[0] as unknown as [string])[0])
    expect(applied).toContain('o1')
    expect(applied).toContain('n2')
    expect(applied).not.toContain('n1')
  })

  it('行级评论入口在并排档下仍然可用(每行只出一个,不与左栏撞 testid)', () => {
    const { container } = render(<InlineDiffCard diffInfo={diffInfo()} />)
    const buttons = container.querySelectorAll('[data-testid^="diff-row-comment-"]')
    const ids = new Set([...buttons].map((b) => b.getAttribute('data-testid')))
    expect(buttons.length).toBeGreaterThan(0)
    expect(ids.size).toBe(buttons.length)
  })
})

describe('V3 #66 判据 3:三方合并视图', () => {
  it('两侧改到不相交的两段 ⇒ 无需选择即产出同时含两处改动的结果', () => {
    render(
      <ThreeWayMergeView
        base={L('a', 'b', 'c')}
        ours={L('A', 'b', 'c')}
        theirs={L('a', 'b', 'C')}
      />,
    )
    const result = screen.getByTestId('diff-3way-result')
    expect(result.textContent).toContain('A')
    expect(result.textContent).toContain('C')
    expect(screen.queryByTestId('diff-3way-unresolved')).toBeNull()
    expect(screen.queryAllByTestId('diff-3way-conflict')).toHaveLength(0)
  })

  it('冲突块列出 base/ours/theirs 三段,未选来源时明确不给结果', () => {
    render(
      <ThreeWayMergeView base={L('a', 'b', 'c')} ours={L('a', 'OURS', 'c')} theirs={L('a', 'THEIRS', 'c')} />,
    )
    const panels = screen.getAllByTestId('diff-3way-conflict')
    expect(panels).toHaveLength(1)
    const panel = panels[0]
    if (!panel) throw new Error('fixture')
    expect(panel.textContent).toContain('b')
    expect(panel.textContent).toContain('OURS')
    expect(panel.textContent).toContain('THEIRS')
    expect(screen.getByTestId('diff-3way-unresolved')).toBeTruthy()
    expect(screen.queryByTestId('diff-3way-result')).toBeNull()
  })

  it('选定传入侧 ⇒ 结果含 theirs、不含 ours;复制按钮把结果送进剪贴板', async () => {
    render(
      <ThreeWayMergeView
        base={L('a', 'b', 'c')}
        ours={L('a', 'OURS', 'c')}
        theirs={L('a', 'THEIRS', 'c')}
      />,
    )
    fireEvent.click(screen.getByTestId(/^diff-3way-choose-theirs/))
    const result = screen.getByTestId('diff-3way-result')
    expect(result.textContent).toContain('THEIRS')
    expect(result.textContent).not.toContain('OURS')
    fireEvent.click(screen.getByTestId('diff-3way-copy'))
    expect(clipboardMock.copy).toHaveBeenCalledTimes(1)
    expect(String((clipboardMock.copy.mock.calls[0] as unknown as [string])[0])).toContain('THEIRS')
    // copy 返回 Promise,toast 在 .then 里 —— 同步断言只会测到"还没轮到它"
    await vi.waitFor(() => expect(toastMock.success).toHaveBeenCalled())
  })

  it('两侧改动完全相同 ⇒ 判 both-same 而非冲突(不该逼人无谓选择)', () => {
    render(<ThreeWayMergeView base={L('a', 'b')} ours={L('a', 'X')} theirs={L('a', 'X')} />)
    expect(screen.queryAllByTestId('diff-3way-conflict')).toHaveLength(0)
    expect(screen.getByTestId('diff-3way-result').textContent).toContain('X')
  })

  it('「全部采用当前」一次覆盖所有冲突块并解除未决态', () => {
    render(
      <ThreeWayMergeView
        base={L('a', 'b', 'c', 'd', 'e')}
        ours={L('A', 'b', 'C', 'd', 'e')}
        theirs={L('X', 'b', 'Y', 'd', 'e')}
      />,
    )
    expect(screen.getAllByTestId('diff-3way-conflict')).toHaveLength(2)
    expect(screen.getByTestId('diff-3way-conflict-count').textContent).toContain('count=2')
    fireEvent.click(screen.getByTestId('diff-3way-all-ours'))
    expect(screen.queryByTestId('diff-3way-unresolved')).toBeNull()
    const result = screen.getByTestId('diff-3way-result').textContent ?? ''
    expect(result).toContain('A')
    expect(result).toContain('C')
    expect(result).not.toContain('X')
  })

  it('三方面板不改档位状态(三方视图与 unified/split 正交,互不覆盖)', () => {
    render(<ThreeWayMergeView base={L('a')} ours={L('a')} theirs={L('a')} />)
    expect(useDiffViewModeStore.getState().mode).toBe('split')
    expect(useDiffViewModeStore.getState().threeWayOpen).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
