// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D64 ②(2026-09-24 装车):图片预览的翻页 / 第 N·M 张 / 缩放档位 / 保存与复制成败。
// 判据在 `@ihui/shared/chat/element-pack`;本用例验的是**渲染位真的用上了它**
// (mock 翻译器回显键名 + 插值,断言不查文案)。
// G-751(2026-09-29)追加:WorkPanel 全量查看器 ImageViewer 的加载三态用例(见文件尾部)。
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

// mock 一律模块级稳定引用(vi.hoisted):worker 反复起文件时不因每次渲染新造闭包而堆积(OOM 假死预防)
const { nextImageStub, useTranslationsStub } = vi.hoisted(() => {
  // 键名 + 插值原样吐回,便于断言"用的是判定层的那个键"
  const translateKey = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key
  const useTranslationsStub = () => translateKey
  // next/image → img 桩:白名单转发。onLoad/onError 必须转发 —— G-751 三态判据就打在 img 事件上;
  // 只转发合法 img 属性,unoptimized/placeholder 等 next 专属 prop 不落 DOM(避免未知属性告警噪音)。
  const nextImageStub = (props: Record<string, unknown>) => {
    const { src, alt, onLoad, onError, style, className, width, height } = props
    return React.createElement('img', { src, alt, onLoad, onError, style, className, width, height })
  }
  return { nextImageStub, useTranslationsStub }
})

vi.mock('next/image', () => ({ default: nextImageStub }))

vi.mock('next-intl', () => ({ useTranslations: useTranslationsStub }))

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
import { ImageViewer } from '../ImageViewer'

const GALLERY = [
  { url: 'https://cdn.example.com/a.png', name: 'a.png' },
  { url: 'https://cdn.example.com/b.png', name: 'b.png' },
  { url: 'https://cdn.example.com/c.png', name: 'c.png' },
]

function root(): HTMLElement {
  return document.querySelector('[data-image-preview-total]') as HTMLElement
}

/** 画廊夹具按索引取用:先验形再用(noUncheckedIndexedAccess 下裸索引是 undefined) */
function galleryAt(index: number): (typeof GALLERY)[number] {
  const item = GALLERY[index]
  if (!item) throw new Error(`setup failed: 画廊没有第 ${index + 1} 张`)
  return item
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
    render(<FilePreview url={galleryAt(0).url} type="image" gallery={GALLERY} />)
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
    render(<FilePreview url={galleryAt(0).url} type="image" gallery={GALLERY} />)
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

    render(<FilePreview url={galleryAt(0).url} type="image" gallery={GALLERY} />)
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

  it('保存:先把字节取到手再落盘,播报 saveSuccess(G-851 改写本用例)', async () => {
    // 这一条原来把"同步点锚点 + 无条件 success"钉成规格 —— 而那**正是 G-851 的缺陷本身**:
    // 跨域 URL 下浏览器忽略 download 属性(变成导航),`a.click()` 不抛错,于是磁盘上什么都没有
    // 而界面报"已保存"。所以判据换向:**success 必须以"字节真到手"为前件**,不是以"没抛错"为前件。
    // 反向那一半(fetch 被拒 ⇒ save-failed)在 `image-preview-save-gated.test.tsx` 里钉。
    const clicks: string[] = []
    const realClick = HTMLElement.prototype.click
    HTMLElement.prototype.click = function (this: HTMLElement) {
      if (this instanceof HTMLAnchorElement) clicks.push(this.getAttribute('download') ?? '')
      // 不委托实现:jsdom 的锚点 click 会触发 "not implemented" 噪音
    }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null),
      },
      body: {
        getReader: () => {
          let sent = false
          return {
            read: async () =>
              sent
                ? { done: true, value: undefined }
                : ((sent = true), { done: false, value: new Uint8Array([1, 2, 3]) }),
          }
        },
      },
    }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    // 组件把 revoke 推迟 1s(真浏览器里同 tick revoke 会掐掉下载)。这里**只截 1s 那一档**、
    // 其余原样转发 —— waitFor 自己靠 setTimeout 轮询,整个换掉它就是把测试挂死(第一版就撞在这)。
    let revokeLater: Array<() => void> = []
    const realSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
      if (ms === 1000 && typeof fn === 'function') {
        revokeLater.push(fn as () => void)
        return 0 as unknown as ReturnType<typeof window.setTimeout>
      }
      return realSetTimeout(fn as () => void, ms, ...args)
    }) as unknown as typeof window.setTimeout

    try {
      render(<FilePreview url={galleryAt(1).url} type="image" gallery={GALLERY} galleryIndex={1} />)
      fireEvent.click(screen.getByRole('button', { name: 'imagePreview.save' }))
      await waitFor(() => {
        expect(
          document.querySelector('[data-image-transfer]')?.getAttribute('data-image-transfer'),
        ).toBe('save-success')
      })
      expect(clicks).toEqual(['b.png'])
      // 前件本身也要断到:没取体就播 success 正是本票要拦的形态,只测结果测不出它
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(document.querySelector('[data-image-transfer]')?.textContent).toBe(
        'imagePreview.saveSuccess',
      )
    } finally {
      window.setTimeout = realSetTimeout
      revokeLater.forEach((f) => f())
      HTMLElement.prototype.click = realClick
    }
  })
})

// ─── G-751(2026-09-29):WorkPanel 全量查看器 ImageViewer 的加载三态 ───
// ImageViewer 是 next/image 语义(onLoad/onError 从 props 接线),与 G-738 流式内联图
// (裸 <img> DOM 事件)不同 API;两条纪律同构复用:状态↔src 配对、key 按资源重建。
// 判据键名走 next-intl mock 回显(不查文案,与本文件 D64 ② 同一取向)。
describe('G-751 ImageViewer 加载三态', () => {
  afterEach(() => cleanup())

  it('加载中:role="status" 占位在位(spinner 非空白)、img 暂不可见;成功后占位消失、img 转可见(正反成对)', () => {
    const { container } = render(<ImageViewer src={galleryAt(0).url} alt={galleryAt(0).name} />)
    const statusEl = container.querySelector('[role="status"]')
    expect(statusEl?.getAttribute('data-image-viewer-state')).toBe('loading')
    // a11y.loading 键回显 + lucide Loader2 的 svg(禁止纯文字/空白占位)
    expect(statusEl?.textContent).toContain('loading')
    expect(statusEl?.querySelector('svg')).toBeTruthy()
    // 加载中正例:图本体挂载但不可见;反例:不得已处于失败态
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.className).toContain('invisible')
    expect(container.querySelector('[data-image-viewer-state="error"]')).toBeNull()

    // 成功:占位退场、图转可见,且不得残留任何失败态
    fireEvent.load(img)
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(img.className).not.toContain('invisible')
    expect(container.querySelector('[data-image-viewer-state="error"]')).toBeNull()
  })

  it('失败态:role="img" + aria-label(imageLoadFailed 既有键回显),含图标非空白;不再渲染破图本体,与 role="status" 分离', () => {
    const { container } = render(<ImageViewer src={galleryAt(2).url} alt={galleryAt(2).name} />)
    fireEvent.error(container.querySelector('img') as HTMLImageElement)
    const errorEl = container.querySelector('[data-image-viewer-state="error"]')
    expect(errorEl).toBeTruthy()
    expect(errorEl?.getAttribute('role')).toBe('img')
    expect(errorEl?.getAttribute('aria-label')).toBe('imageLoadFailed')
    // 非空白区域:lucide ImageOff 的 <svg>(与 G-738 同款错误视觉语言)
    expect(errorEl?.querySelector('svg')).toBeTruthy()
    // 两种 aria 语义各自独立容器:失败时不得同时有 role="status",也不再渲染破图本体
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('换图:喂 A 失败、翻到 B —— B 不继承 A 的失败态(状态↔src 配对),从加载中抵达成功;key 重建 ⇒ 非复用节点', () => {
    const { container } = render(
      <ImageViewer
        src={galleryAt(0).url}
        images={[galleryAt(0).url, galleryAt(1).url]}
        alt={galleryAt(0).name}
      />,
    )
    const nodeA = container.querySelector('img') as HTMLImageElement
    fireEvent.error(nodeA)
    expect(container.querySelector('[data-image-viewer-state="error"]')).toBeTruthy()

    // 走查看器自己的翻页路径换图(不是 rerender 硬换 props)
    fireEvent.click(screen.getByRole('button', { name: 'next' }))
    // 配对判据:state.source(A) !== 当前 src(B) ⇒ A 的失败态作废,B 从加载中起步
    expect(container.querySelector('[data-image-viewer-state="error"]')).toBeNull()
    expect(container.querySelector('[role="status"]')).toBeTruthy()
    const nodeB = container.querySelector(
      `img[src="${galleryAt(1).url}"]`,
    ) as HTMLImageElement
    expect(nodeB).toBeTruthy()
    // key 按资源重建:B 是全新节点,不是 A 的复用(否则 A 的迟到异步事件会命中 B 的处理器)
    expect(nodeB).not.toBe(nodeA)

    // B 抵达成功态(而非停在失败占位)
    fireEvent.load(nodeB)
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(nodeB.className).not.toContain('invisible')
    expect(container.querySelector('[data-image-viewer-state="error"]')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
