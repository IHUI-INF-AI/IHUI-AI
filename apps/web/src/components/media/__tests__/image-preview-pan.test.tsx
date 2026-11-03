// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * G-853(web)图片预览的**平移**与 **pointer capture 的显式释放**。
 *
 * 与同目录 `image-preview-pack.test.tsx` 的分工:那份验翻页/计数/缩放档位/传输成败,
 * 本份只验票面结清的两件事 —— ① 放大后有平移且越界被钳制(判据来自共享层
 * `@ihui/shared/utils/image-preview-offset`,这里验的是渲染位真的用上了它),
 * ② pointerup / pointercancel / **卸载** 三个出口都显式 release。
 *
 * 关于 mock 的边界(§验收口径「不要 mock 掉你正要验的那一层」):
 *   · 被 mock 的只有 next/image(渲染成 img)、next-intl(回显键名)、以及两个与手势无关的
 *     取数/降级 hook —— 与被 clone 的那份测试逐字同一套,免得两处各写一套替身。
 *   · 几何用 `getBoundingClientRect` 桩:jsdom 不做布局,真值恒为 0。**桩只喂输入**,
 *     钳制与捕获释放走的仍是组件真实代码路径。
 *   · `setPointerCapture` / `releasePointerCapture` 用 spy 挂在真实 DOM 节点上:
 *     断言打的就是"组件有没有真的调用这个出口",不是打一个内部布尔。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'

const { nextImageStub, useTranslationsStub } = vi.hoisted(() => {
  const translateKey = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key
  const nextImageStub = (props: Record<string, unknown>) => {
    const { src, alt, onLoad, onError, style, className, width, height } = props
    return React.createElement('img', { src, alt, onLoad, onError, style, className, width, height })
  }
  return { nextImageStub, useTranslationsStub: () => translateKey }
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
  PreviewExpiredState: () => null,
  PreviewTooLargeState: () => null,
  usePreviewCopy: () => ({}),
}))

import { FilePreview } from '../FilePreview'

const VIEWPORT = { w: 800, h: 600 }
const URL_A = 'https://cdn.example.com/a.png'

const rect = (w: number, h: number): DOMRect =>
  ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect

/** 图片画出来多大(含 transform scale 后的实际占位),由组件自己量;这里只喂输入。 */
function stubGeometry(image: { w: number; h: number }): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.tagName === 'IMG' ? rect(image.w, image.h) : rect(VIEWPORT.w, VIEWPORT.h)
  })
}

function panSurface(container: HTMLElement): HTMLElement {
  const node = container.querySelector('[data-image-pan-ready]')
  if (!(node instanceof HTMLElement)) throw new Error('setup failed: 没渲染出平移层')
  return node
}

/** 把捕获 API 以 spy 挂到真实节点上(jsdom 未实现),返回三个计数入口。 */
function spyOnCapture(node: HTMLElement) {
  const setPointerCapture = vi.fn()
  const releasePointerCapture = vi.fn()
  const hasPointerCapture = vi.fn(() => true)
  Object.assign(node, { setPointerCapture, releasePointerCapture, hasPointerCapture })
  return { setPointerCapture, releasePointerCapture, hasPointerCapture }
}

const POINTER = { pointerId: 7, bubbles: true, cancelable: true }

function renderPreview() {
  return render(<FilePreview url={URL_A} type="image" name="a.png" />)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('G-853 web · 放大后的平移', () => {
  it('放大态:拖过头被钳到 +上限(向右 / 向下各越界一次)', () => {
    // 1600×1200 的图片装在 800×600 的视口里 ⇒ 两轴各溢出 800/600 ⇒ 上限 400/300
    stubGeometry({ w: 1600, h: 1200 })
    const { container } = renderPreview()
    const surface = panSurface(container)
    expect(surface.getAttribute('data-image-pan-ready')).toBe('true')

    fireEvent.pointerDown(surface, { ...POINTER, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(surface, { ...POINTER, clientX: 9999, clientY: 9999 })
    expect(surface.getAttribute('data-image-pan-x')).toBe('400')
    expect(surface.getAttribute('data-image-pan-y')).toBe('300')
  })

  it('放大态:反方向越界被钳到 −上限(与上一条是两向各一条)', () => {
    stubGeometry({ w: 1600, h: 1200 })
    const { container } = renderPreview()
    const surface = panSurface(container)
    fireEvent.pointerDown(surface, { ...POINTER, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(surface, { ...POINTER, clientX: -9999, clientY: -9999 })
    expect(surface.getAttribute('data-image-pan-x')).toBe('-400')
    expect(surface.getAttribute('data-image-pan-y')).toBe('-300')
  })

  it('范围内逐字跟手(钳制不是量化)', () => {
    stubGeometry({ w: 1600, h: 1200 })
    const { container } = renderPreview()
    const surface = panSurface(container)
    fireEvent.pointerDown(surface, { ...POINTER, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(surface, { ...POINTER, clientX: 430, clientY: 280 })
    expect(surface.getAttribute('data-image-pan-x')).toBe('30')
    expect(surface.getAttribute('data-image-pan-y')).toBe('-20')
  })

  it('未放大:不吃事件、不平移,且**不捕获指针**(不得吃掉页面滚动)', () => {
    stubGeometry({ w: VIEWPORT.w, h: VIEWPORT.h })
    const { container } = renderPreview()
    const surface = panSurface(container)
    const capture = spyOnCapture(surface)
    expect(surface.getAttribute('data-image-pan-ready')).toBe('false')
    expect(surface.style.touchAction).toBe('auto')

    fireEvent.pointerDown(surface, { ...POINTER, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(surface, { ...POINTER, clientX: 1200, clientY: 300 })
    expect(capture.setPointerCapture).not.toHaveBeenCalled()
    expect(surface.getAttribute('data-image-pan-x')).toBe('0')
  })
})

describe('G-853 web · pointer capture 的三个显式出口', () => {
  it('pointerdown 捕获;pointerup 释放', () => {
    stubGeometry({ w: 1600, h: 1200 })
    const { container } = renderPreview()
    const surface = panSurface(container)
    const capture = spyOnCapture(surface)

    fireEvent.pointerDown(surface, { ...POINTER, clientX: 10, clientY: 10 })
    expect(capture.setPointerCapture).toHaveBeenCalledWith(7)

    fireEvent.pointerUp(surface, { ...POINTER, clientX: 50, clientY: 50 })
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it('pointercancel 释放(残留捕获会让 hover/click 继续命中视口而不是浮层按钮)', () => {
    stubGeometry({ w: 1600, h: 1200 })
    const { container } = renderPreview()
    const surface = panSurface(container)
    const capture = spyOnCapture(surface)

    fireEvent.pointerDown(surface, { ...POINTER, clientX: 10, clientY: 10 })
    fireEvent.pointerCancel(surface, { ...POINTER, clientX: 50, clientY: 50 })
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it('卸载释放:拖到一半直接 unmount,捕获不得留给下一个组件', () => {
    stubGeometry({ w: 1600, h: 1200 })
    const { container, unmount } = renderPreview()
    const surface = panSurface(container)
    const capture = spyOnCapture(surface)

    fireEvent.pointerDown(surface, { ...POINTER, clientX: 10, clientY: 10 })
    expect(capture.setPointerCapture).toHaveBeenCalledTimes(1)
    unmount()
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it('换图(翻页)复位平移量,不把上一张的偏移带到下一张', () => {
    stubGeometry({ w: 1600, h: 1200 })
    const { container } = renderPreview()
    const surface = panSurface(container)
    fireEvent.pointerDown(surface, { ...POINTER, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(surface, { ...POINTER, clientX: 300, clientY: 260 })
    expect(surface.getAttribute('data-image-pan-x')).toBe('200')
    // 单图夹具没有翻页按钮 ⇒ 用缩放触发同一条复位路径(换图与改缩放共用它)
    const zoomOut = container.querySelector('[data-image-zoom-btn="out"]')
    if (!(zoomOut instanceof HTMLElement)) throw new Error('setup failed: 没有缩小按钮')
    fireEvent.click(zoomOut)
    const again = panSurface(container)
    expect(again.getAttribute('data-image-pan-x')).toBe('0')
    expect(again.getAttribute('data-image-pan-y')).toBe('0')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
