// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * D166 链接预览卡测试(2026-09-30 立)。
 *
 * 覆盖(票面验收 ①③ 的组件面):
 * - 三态卡渲染区别化:loading / ok(标题+摘要)/ unavailable / undetermined;
 *   title 缺省回落主机名;dismiss 可关;null 零占位;
 * - 装车证明(与 message-input 落地形态同构的 harness):粘贴 URL → 探测失败
 *   (undetermined)后,发送回调**仍被调用** —— 预览失败不阻止发送。
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
}))

// 本仓测试环境未开 RTL 全局 auto-cleanup,此处显式收尾防跨用例 DOM 串染
afterEach(() => {
  cleanup()
  vi.mocked(fetchApi).mockReset()
})

import { fetchApi } from '@/lib/api'
import { LinkPreviewCard } from '../link-preview-card'
import { useLinkPreview } from '@/hooks/use-link-preview'
import type { LinkPreviewState } from '@/hooks/use-link-preview'

function renderCard(preview: LinkPreviewState | null) {
  const onDismiss = vi.fn()
  const utils = render(<LinkPreviewCard preview={preview} onDismiss={onDismiss} />)
  return { onDismiss, unmount: utils.unmount }
}

describe('LinkPreviewCard 三态区别化(票面验收 ①)', () => {
  it('loading → loading 文案', () => {
    renderCard({ status: 'loading', url: 'https://example.com/' })
    expect(screen.getByTestId('link-preview-card').dataset.previewStatus).toBe('loading')
    expect(screen.getByText('loading')).toBeTruthy()
  })

  it('ok → 标题 + 摘要', () => {
    renderCard({
      status: 'ok',
      url: 'https://example.com/',
      title: 'Example Domain',
      description: 'For use in examples.',
    })
    expect(screen.getByTestId('link-preview-card').dataset.previewStatus).toBe('ok')
    expect(screen.getByText('Example Domain')).toBeTruthy()
    expect(screen.getByText('For use in examples.')).toBeTruthy()
  })

  it('ok 无标题 → 回落主机名(不误报读不到)', () => {
    renderCard({ status: 'ok', url: 'https://docs.example.com/x' })
    expect(screen.getByText('docs.example.com')).toBeTruthy()
  })

  it('unavailable 与 undetermined 文案严格区别', () => {
    const { unmount } = renderCard({ status: 'unavailable', url: 'u', reason: 'http_404' })
    expect(screen.getByTestId('link-preview-card').dataset.previewStatus).toBe('unavailable')
    expect(screen.getByText('unavailable')).toBeTruthy()
    unmount()

    renderCard({ status: 'undetermined', url: 'u', reason: 'http_401' })
    expect(screen.getByTestId('link-preview-card').dataset.previewStatus).toBe('undetermined')
    expect(screen.getByText('undetermined')).toBeTruthy()
  })

  it('dismiss 可关;null 零占位不渲染', () => {
    const { onDismiss } = renderCard({ status: 'loading', url: 'https://example.com/' })
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)

    cleanup()
    render(<LinkPreviewCard preview={null} onDismiss={() => {}} />)
    expect(screen.queryByTestId('link-preview-card')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// 装车证明:与 message-input 落地形态同构的 harness
// (hook + 卡片 + 发送按钮;发送回调不读预览态)
// ─────────────────────────────────────────────────────────────

const PASTE_URL = 'https://fail.example.com/a'

function ComposerHarness({ onSend }: { onSend: (text: string) => void }) {
  const { preview, probeFromPaste, reset } = useLinkPreview()
  return (
    <div>
      <LinkPreviewCard preview={preview} onDismiss={reset} />
      <button type="button" onClick={() => probeFromPaste(`看下 ${PASTE_URL} 这个`)}>
        paste-url
      </button>
      <button type="button" onClick={() => onSend(PASTE_URL)}>
        send
      </button>
    </div>
  )
}

describe('装车形态:预览失败不阻止发送(票面验收 ③)', () => {
  it('探测失败(undetermined)后,发送回调仍被调用', async () => {
    vi.mocked(fetchApi).mockRejectedValue(new Error('network down'))
    const onSend = vi.fn()
    render(<ComposerHarness onSend={onSend} />)

    fireEvent.click(screen.getByText('paste-url'))
    await waitFor(() =>
      expect(screen.getByTestId('link-preview-card').dataset.previewStatus).toBe('undetermined'),
    )

    // 预览失败不阻止发送:发送仍被调用,载荷为用户正文。
    fireEvent.click(screen.getByText('send'))
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith(PASTE_URL)
  })

  it('探测成功(ok)后发送照常;同 URL 重复粘贴请求数保持 == 1', async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      success: true,
      data: { status: 'ok', url: PASTE_URL, title: 'T' },
    } as never)
    const onSend = vi.fn()
    render(<ComposerHarness onSend={onSend} />)

    fireEvent.click(screen.getByText('paste-url'))
    fireEvent.click(screen.getByText('paste-url')) // 并发重复触发被记账挡住
    await waitFor(() =>
      expect(screen.getByTestId('link-preview-card').dataset.previewStatus).toBe('ok'),
    )

    fireEvent.click(screen.getByText('send'))
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetchApi)).toHaveBeenCalledTimes(1) // 防双抓:请求数 == 1
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
