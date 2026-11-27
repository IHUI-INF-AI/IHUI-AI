// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { OfficeConvertPreview } from '../office-convert-preview'
import { fetchRaw } from '@/lib/api'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      `[[${key}]]`,
}))

vi.mock('@/components/media/PDFViewer', () => ({
  PDFViewer: ({ url, className }: { url: string; className?: string }) =>
    React.createElement('div', {
      'data-testid': 'pdf-viewer-stub',
      'data-url': url,
      'data-class': className ?? '',
    }),
}))

vi.mock('@/lib/api', () => ({ fetchRaw: vi.fn() }))

const fetchRawMock = vi.mocked(fetchRaw)

beforeEach(() => {
  fetchRawMock.mockReset()
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:converted-pdf'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('OfficeConvertPreview', () => {
  it('读取源字节 → POST /api/office/preview → 用 PDFViewer 渲染转出的 PDF', async () => {
    const source = new Blob(['legacy doc bytes'], { type: 'application/msword' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => source })),
    )
    fetchRawMock.mockResolvedValue(new Blob(['pdf bytes'], { type: 'application/pdf' }))

    render(<OfficeConvertPreview src="blob:legacy-doc" name="旧版文档.doc" ext="doc" />)

    expect(screen.getByText('[[officeLoading]]')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('pdf-viewer-stub')).toBeTruthy())
    expect(screen.getByTestId('pdf-viewer-stub').getAttribute('data-url')).toBe(
      'blob:converted-pdf',
    )
    expect(fetchRawMock).toHaveBeenCalledTimes(1)
    const [path, init] = fetchRawMock.mock.calls[0] ?? []
    expect(path).toBe('/api/office/preview')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(FormData)
    expect((init?.body as FormData).get('file')).toBeInstanceOf(Blob)
  })

  it('服务端拒绝时给出可下载的错误态,不白屏', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => new Blob(['doc']) })),
    )
    fetchRawMock.mockRejectedValue(new Error('503: LibreOffice unavailable'))

    render(<OfficeConvertPreview src="blob:legacy-doc" name="旧版文档.doc" ext="doc" />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText('[[officeFailed]]')).toBeTruthy()
    expect(screen.getByText('503: LibreOffice unavailable')).toBeTruthy()
    expect(screen.getByText('[[officeDownload]]')).toBeTruthy()
  })

  it('超过 50MB 在客户端先拦,不上传', async () => {
    const big = new Blob([new Uint8Array(50 * 1024 * 1024 + 1)], { type: 'application/msword' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => big })),
    )

    render(<OfficeConvertPreview src="blob:legacy-doc" name="旧版文档.doc" ext="doc" />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(fetchRawMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
