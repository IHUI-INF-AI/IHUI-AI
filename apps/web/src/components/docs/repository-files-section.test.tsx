// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
}))

vi.mock('@/components/media/file-viewer-dialog', () => ({
  FileViewerDialog: ({ target }: { target: { name: string } | null }) => (
    <div data-testid="docs-preview-dialog">{target?.name ?? ''}</div>
  ),
}))

import { fetchApi } from '@/lib/api'
import { RepositoryFilesSection } from './repository-files-section'

/**
 * 接线锁:文档中心首页的「文档文件」板块只列非 Markdown 文件,预览目标必须带
 * **真实文件名(含扩展名)** —— 判型靠它,不能退化成标题(标题已剥扩展名会误判)。
 */

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RepositoryFilesSection />
    </QueryClientProvider>,
  )
}

const pdfItem = {
  id: 'file:developer/report.pdf',
  title: '季度报告',
  description: 'developer/ops/report.pdf',
  format: 'pdf',
  url: '/api/feature-center/documents/file/developer/ops/report.pdf',
  updatedAt: '2026-11-26T00:00:00.000Z',
}

afterEach(() => {
  cleanup()
  vi.mocked(fetchApi).mockReset()
})

describe('RepositoryFilesSection', () => {
  it('只列非 Markdown 文件,并给出带扩展名的预览目标', async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'file:guide.md',
          title: '指南',
          description: 'guide.md',
          format: 'markdown',
          url: '/docs/guide',
          updatedAt: '',
        },
        pdfItem,
      ],
    } as never)

    renderSection()
    expect(await screen.findByText('季度报告')).toBeTruthy()
    expect(screen.queryByText('指南')).toBeNull()

    fireEvent.click(screen.getByText('preview'))
    await waitFor(() =>
      expect(screen.getByTestId('docs-preview-dialog').textContent).toBe('report.pdf'),
    )
  })

  it('全是 Markdown 时不立空板块', async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'file:guide.md',
          title: '指南',
          description: 'guide.md',
          format: 'markdown',
          url: '/docs/guide',
          updatedAt: '',
        },
      ],
    } as never)

    const { container } = renderSection()
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
