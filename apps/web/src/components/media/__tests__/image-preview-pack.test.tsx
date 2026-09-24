// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D64 ②(2026-09-24 装车):图片预览的翻页 / 第 N·M 张 / 缩放档位 / 保存与复制成败。
// 判据在 `@ihui/shared/chat/element-pack`;本用例验的是**渲染位真的用上了它**
// (mock 翻译器回显键名 + 插值,断言不查文案)。
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}))

// 键名 + 插值原样吐回,便于断言"用的是判定层的那个键"
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

vi.mock('../use-preview-staleness', () => ({
  usePreviewMediaProbe: () => ({ readAt: null, isRecord: false, notice: null, refresh: vi.fn() }),
  usePreviewTextFeed: () => ({
    readAt: null,
    isRecord: false,
    notice: null,
    loading: false,
    content: '',
    fileUpdated: false,
    refresh: vi.fn(),
    applyLatest: vi.fn(),
    dismissFileUpdated: vi.fn(),
  }),
}))

vi.mock('../preview-degradation-banner', () => ({
  PreviewFileUpdatedBar: () => null,
  PreviewNoContentState: () => null,
  PreviewSnapshotNotice: () => null,
  usePreviewCopy: () => ({}),
}))

import { FilePreview } from '../FilePreview'

const GALLERY = [
  { url: 'https://cdn.example.com/a.png', name: 'a.png' },
  { url: 'https://cdn.example.com/b.png', name: 'b.png' },
  { url: 'https://cdn.example.com/c.png', name: 'c.png' },
]

function root(): HTMLElement {
  return document.querySelector('[data-image-preview-total]') as HTMLElement
}

describe('D64 ② 图片预览器装车', () => {
  beforeEach(() => cleanup())
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('单图:不出翻页控件,但计数/缩放/保存/复制恒在位(不静默缺席)', () => {
    render(<FilePreview url="https://cdn.example.com/solo.png" type="image" name="solo.png" />)
    expect(root().getAttribute('data-image-preview-total')).toBe('1')
    expect(document.querySelector('[data-image-nav="prev"]')).toBeNull()
    expect(document.querySelector('[data-image-nav="next"]')).toBeNull()
    // 判定层键 + 1 基插值(imageCounterView)
    expect(document.querySelector('[data-image-counter]')?.textContent).toBe(
      'imagePreview.counter:{"index":1,"total":1}',
    )
    expect(document.querySelector('[data-image-zoom-btn="in"]')).toBeTruthy()
    expect(document.querySelector('[data-image-transfer-btn="save"]')).toBeTruthy()
    expect(document.querySelector('[data-image-transfer-btn="copy"]')).toBeTruthy()
  })

  it('多图:翻页循环由 pageImage(wrap) 决定 —— 末张下一张回首张,首张上一张回末张', () => {
    render(<FilePreview url={GALLERY[0].url} type="image" gallery={GALLERY} />)
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.next' }))
    expect(root().getAttribute('data-image-preview-index')).toBe('1')
    expect(document.querySelector('[data-image-counter]')?.textContent).toBe(
      'imagePreview.counter:{"index":2,"total":3}',
    )
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.next' }))
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.next' }))
    expect(root().getAttribute('data-image-preview-index')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.prev' }))
    expect(root().getAttribute('data-image-preview-index')).toBe('2')
    // 渲染源跟着翻页走(不是永远第一张)
    expect(screen.getByAltText('c.png')).toBeTruthy()
  })

  it('缩放档位:1 → in 得 1.25;连 out 到底钳在 0.5 不再降(端点不循环)', () => {
    render(<FilePreview url={GALLERY[0].url} type="image" gallery={GALLERY} />)
    expect(document.querySelector('[data-image-zoom-label]')?.textContent).toBe('100%')
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.zoomIn' }))
    expect(document.querySelector('[data-image-zoom-label]')?.textContent).toBe('125%')
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'imagePreview.zoomOut' }))
    }
    expect(document.querySelector('[data-image-zoom-label]')?.textContent).toBe('50%')
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.zoomOut' }))
    expect(document.querySelector('[data-image-zoom-label]')?.textContent).toBe('50%')
  })

  it('复制成功/失败都显式播报(imageTransferView 四组合之二),失败不静默吞', async () => {
    const write = vi.fn(async () => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) })),
    )
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(_init: unknown) {}
      },
    )
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { write },
      configurable: true,
    })

    render(<FilePreview url={GALLERY[0].url} type="image" gallery={GALLERY} />)
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.copy' }))
    await waitFor(() => {
      expect(
        document.querySelector('[data-image-transfer]')?.getAttribute('data-image-transfer'),
      ).toBe('copy-success')
    })
    expect(write).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-image-transfer]')?.textContent).toBe(
      'imagePreview.copySuccess',
    )

    // 反例:剪贴板不可用 → copy-failed(不是"没反应")
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: {}, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.copy' }))
    await waitFor(() => {
      expect(
        document.querySelector('[data-image-transfer]')?.getAttribute('data-image-transfer'),
      ).toBe('copy-failed')
    })
    expect(document.querySelector('[data-image-transfer]')?.textContent).toBe(
      'imagePreview.copyFailed',
    )
  })

  it('保存:走 download 锚点并播报 saveSuccess', () => {
    const clicks: string[] = []
    const realClick = HTMLElement.prototype.click
    HTMLElement.prototype.click = function (this: HTMLElement) {
      if (this instanceof HTMLAnchorElement) clicks.push(this.getAttribute('download') ?? '')
      // 不委托实现:jsdom 的锚点 click 会触发 "not implemented" 噪音
    }
    render(<FilePreview url={GALLERY[1].url} type="image" gallery={GALLERY} galleryIndex={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.save' }))
    expect(clicks).toEqual(['b.png'])
    expect(
      document.querySelector('[data-image-transfer]')?.getAttribute('data-image-transfer'),
    ).toBe('save-success')
    HTMLElement.prototype.click = realClick
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
