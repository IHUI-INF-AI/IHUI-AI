// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/api', () => ({
  fetchRaw: vi.fn(),
  fetchApi: vi.fn(),
  getToken: () => 'test-token',
  getBaseUrl: () => '',
}))

vi.mock('./universal-file-preview', () => ({
  UniversalFilePreview: ({ name }: { name: string }) => (
    <div data-testid="universal-preview">{name}</div>
  ),
}))

import { fetchApi, fetchRaw } from '@/lib/api'
import { useFileHandoffStore } from '@/stores/file-handoff'
import { FileViewerDialog } from './file-viewer-dialog'

/**
 * 统一查看器接线锁:字节只从 `fetchRaw(src)` 取(带鉴权),取到后才渲染预览;
 * 失败要给重试入口,工具栏下载按钮只在有 blob 时可用。
 */

beforeEach(() => {
  useFileHandoffStore.getState().clear()
  // AI 面板优先走原生 fetch 的 SSE;测试环境没有真实同源代理,
  // 显式置空让它走 JSON 回退,避免连接 127.0.0.1:3000 的噪音。
  vi.stubGlobal('fetch', undefined)
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:preview'),
    revokeObjectURL: vi.fn(),
  })
  vi.mocked(fetchApi).mockResolvedValue({
    success: true,
    data: {
      answer: '**总结**：已读取文档。',
      mode: 'summary',
      model: 'test-model',
      usage: null,
      extractedChars: 12,
      truncated: false,
    },
  })
})

afterEach(() => {
  cleanup()
  useFileHandoffStore.getState().clear()
  vi.mocked(fetchRaw).mockReset()
  vi.mocked(fetchApi).mockReset()
  vi.unstubAllGlobals()
})

describe('FileViewerDialog', () => {
  it('取到字节后渲染预览,并给出下载入口', async () => {
    vi.mocked(fetchRaw).mockResolvedValue(new Blob(['hello'], { type: 'text/plain' }))

    render(
      <FileViewerDialog
        target={{ name: '季度报告.docx', src: '/api/files/1', subtitle: '项目A · 12 KB' }}
        onClose={() => {}}
      />,
    )

    expect(await screen.findByTestId('universal-preview')).toBeTruthy()
    expect(screen.getAllByText('季度报告.docx').length).toBeGreaterThan(0)
    expect(screen.getByText('项目A · 12 KB')).toBeTruthy()
    expect(screen.getByLabelText('download')).toBeTruthy()
    expect(fetchRaw).toHaveBeenCalledWith('/api/files/1')
  })

  it('取件失败给出重试,重试后再次取件', async () => {
    vi.mocked(fetchRaw)
      .mockRejectedValueOnce(new Error('401'))
      .mockResolvedValueOnce(new Blob(['ok'], { type: 'text/plain' }))

    render(<FileViewerDialog target={{ name: 'a.pdf', src: '/api/files/2' }} onClose={() => {}} />)

    expect(await screen.findByText('previewFailed')).toBeTruthy()
    fireEvent.click(screen.getByText('retry'))
    expect(await screen.findByTestId('universal-preview')).toBeTruthy()
    expect(fetchRaw).toHaveBeenCalledTimes(2)
  })

  it('给了 load 时不再走 URL 取件', async () => {
    const load = vi.fn(async () => new Blob(['ide'], { type: 'text/plain' }))

    render(<FileViewerDialog target={{ name: 'main.ts', load }} onClose={() => {}} />)

    expect(await screen.findByTestId('universal-preview')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(1)
    expect(fetchRaw).not.toHaveBeenCalled()
  })

  it('文档类文件提供 AI 解读入口,并把原始字节交给 AI 面板', async () => {
    vi.mocked(fetchRaw).mockResolvedValue(new Blob(['hello'], { type: 'text/plain' }))

    render(
      <FileViewerDialog
        target={{ name: '季度报告.docx', src: '/api/files/9' }}
        onClose={() => {}}
      />,
    )

    await screen.findByTestId('universal-preview')
    fireEvent.click(screen.getByLabelText('aiAnalyze'))

    expect(await screen.findByText('aiTitle')).toBeTruthy()
    // 布局回归:查看器曾把 `max-h-[60vh]` 传给面板,真实浏览器里算出 max-height:0,
    // 面板只剩 2px 高(答案已在 DOM 里但看起来空白)。面板高度必须交给网格自然拉伸,
    // 只保底 min-h,不得再挂会塌成 0 的 max-h 约束。
    const panel = screen.getByLabelText('aiTitle')
    expect(panel.className).toContain('min-h-[360px]')
    expect(panel.className).not.toContain('max-h-[60vh]')
    await waitFor(() =>
      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('/api/office/analyze?mode=summary'),
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('「在对话中继续」把当前字节排进主对话交接队列并关闭查看器', async () => {
    const onClose = vi.fn()
    vi.mocked(fetchRaw).mockResolvedValue(new Blob(['hello'], { type: 'text/plain' }))

    render(
      <FileViewerDialog
        target={{ name: '季度报告.docx', src: '/api/files/10' }}
        onClose={onClose}
      />,
    )

    await screen.findByTestId('universal-preview')
    fireEvent.click(screen.getByLabelText('aiContinueChat'))

    const pending = useFileHandoffStore.getState().pending
    expect(pending).toHaveLength(1)
    expect(pending[0]?.file.name).toBe('季度报告.docx')
    expect(pending[0]?.prompt).toBe('aiContinuePrompt')
    expect(onClose).toHaveBeenCalled()
  })

  it('关闭时回调 onClose', async () => {
    const onClose = vi.fn()
    vi.mocked(fetchRaw).mockResolvedValue(new Blob(['x']))

    render(<FileViewerDialog target={{ name: 'x.txt', src: '/x' }} onClose={onClose} />)

    await waitFor(() => expect(screen.getByTestId('universal-preview')).toBeTruthy())
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
