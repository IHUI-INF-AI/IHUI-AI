// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { UniversalFilePreview } from '../universal-file-preview'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('../FilePreview', () => ({
  FilePreview: ({ type, name, ext }: { type: string; name: string; ext?: string }) =>
    React.createElement('div', {
      'data-testid': 'file-preview-stub',
      'data-type': type,
      'data-name': name,
      'data-ext': ext ?? '',
    }),
}))

vi.mock('../office-preview', () => ({
  SUPPORTED_EXTS: new Set(['docx', 'xlsx', 'xls', 'pptx']),
  OfficePreview: ({ ext }: { ext: string }) =>
    React.createElement('div', {
      'data-testid': 'office-preview-stub',
      'data-ext': ext,
    }),
}))

vi.mock('../office-convert-preview', () => ({
  OfficeConvertPreview: ({ ext, name }: { ext: string; name: string }) =>
    React.createElement('div', {
      'data-testid': 'office-convert-stub',
      'data-ext': ext,
      'data-name': name,
    }),
}))

vi.mock('@/components/file-preview/delimited-file-preview', () => ({
  DelimitedFilePreview: () => React.createElement('div', { 'data-testid': 'delimited-stub' }),
}))

vi.mock('@/components/file-preview/preview-error-card', () => ({
  PreviewErrorCard: ({ ext }: { ext: string }) =>
    React.createElement('div', { 'data-testid': 'error-card-stub', 'data-ext': ext }),
  fileNameOf: (src: string) => src.split('/').pop() ?? src,
}))

afterEach(cleanup)

describe('UniversalFilePreview 扩展名判据', () => {
  it('blob 地址没有后缀时,用展示文件名判出 Word 并交 OfficePreview', () => {
    render(<UniversalFilePreview src="blob:http://localhost/abc" name="季度报告.docx" />)
    const stub = screen.getByTestId('file-preview-stub')
    expect(stub.getAttribute('data-type')).toBe('office')
    expect(stub.getAttribute('data-name')).toBe('季度报告.docx')
    // 关键回归:blob 地址没有后缀,FilePreview 不能再从 url 猜 ext,否则 OfficePreview
    // 会收到空 ext 并显示“该文件类型不支持预览”。扩展名必须原样传到底。
    expect(stub.getAttribute('data-ext')).toBe('docx')
  })

  it('blob 地址 + 旧版 .doc 文件名 → 服务端转换预览', () => {
    render(<UniversalFilePreview src="blob:http://localhost/abc" name="历史归档.doc" />)
    const stub = screen.getByTestId('office-convert-stub')
    expect(stub.getAttribute('data-ext')).toBe('doc')
    expect(stub.getAttribute('data-name')).toBe('历史归档.doc')
  })

  it('blob 地址 + 图片文件名 → 图片视口(不是 download 卡)', () => {
    render(<UniversalFilePreview src="blob:http://localhost/abc" name="现场照片.PNG" />)
    expect(screen.getByTestId('file-preview-stub').getAttribute('data-type')).toBe('image')
  })

  it('显式 ext 优先于文件名,且大小写/前导点归一', () => {
    render(<UniversalFilePreview src="blob:http://localhost/abc" name="误名.bin" ext=".PDF" />)
    expect(screen.getByTestId('file-preview-stub').getAttribute('data-type')).toBe('pdf')
  })

  it('确实没有后缀时仍给错误卡,不白屏', () => {
    render(<UniversalFilePreview src="blob:http://localhost/abc" />)
    expect(screen.getByTestId('error-card-stub')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
