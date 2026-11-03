// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    if (!params) return key
    return `${key}|${Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('|')}`
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

import { InlineDiffCard, hashDiffContent, loadInlineViewed } from '../inline-diff-card'

/** D98①⑤:单卡审阅态(版本绑定)+ 单文件导出命令。 */
const DIFF = { file_path: 'src/a.ts', old_content: 'x\n', new_content: 'y\n' }

describe('D98 InlineDiffCard review + export', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(() => cleanup())

  it('审阅切换落盘且重挂载仍存;内容变化视为新改动回到未审', () => {
    const { unmount } = render(<InlineDiffCard diffInfo={DIFF} />)
    const btn = screen.getByTestId('inline-diff-reviewed')
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    const hash = hashDiffContent(`${DIFF.old_content}\n${DIFF.new_content}`)
    expect(loadInlineViewed(DIFF.file_path, hash)).toBe(true)
    unmount()
    render(<InlineDiffCard diffInfo={DIFF} />)
    expect(screen.getByTestId('inline-diff-reviewed').getAttribute('aria-pressed')).toBe('true')
    cleanup()
    // 新版本改动 → 回到未审(不把旧审阅态套到新 diff 上)
    render(<InlineDiffCard diffInfo={{ ...DIFF, new_content: 'z\n' }} />)
    expect(screen.getByTestId('inline-diff-reviewed').getAttribute('aria-pressed')).toBe('false')
  })

  it('复制导出命令:含 git apply + 文件名 + 成功 toast', async () => {
    render(<InlineDiffCard diffInfo={DIFF} />)
    fireEvent.click(screen.getByTestId('inline-diff-copy-apply'))
    await waitFor(() => expect(clipboardMock.copy).toHaveBeenCalledTimes(1))
    const firstCall = clipboardMock.copy.mock.calls[0]
    expect(firstCall).toBeDefined()
    const cmd = (firstCall as unknown as [string])[0]
    expect(cmd).toContain('git apply')
    expect(cmd).toContain('src/a.ts')
    expect(toastMock.success).toHaveBeenCalledWith('diffReview.copyGitApplyToast')
  })

  it('无改动时导出按钮禁用(不复制空 patch)', () => {
    render(
      <InlineDiffCard
        diffInfo={{ file_path: 'src/a.ts', old_content: 'x\n', new_content: 'x\n' }}
      />,
    )
    expect((screen.getByTestId('inline-diff-copy-apply') as HTMLButtonElement).disabled).toBe(true)
  })
})
