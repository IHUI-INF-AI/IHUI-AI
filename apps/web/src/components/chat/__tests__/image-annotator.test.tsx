// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// D124 / G-238 位图标注编辑器用例。
// jsdom 没有 canvas 实现:getContext/toDataURL 全部用 spy 接管,断言的是
// "绘制调用序列 + 导出入口 + 形状栈进出",不依赖任何像素行为。
// Image 同样替换为可控桩:赋值 src 后微任务触发 onload,让"图片就绪"可被 await。

import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      key,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }): React.ReactElement => <>{children}</>,
}))

import { ImageAnnotator, dataUrlToFile } from '../image-annotator'

const ctxSpies = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
}

const canvasContext = {
  ...ctxSpies,
  lineCap: 'butt',
  lineJoin: 'miter',
  lineWidth: 1,
  strokeStyle: '#000000',
  fillStyle: '#000000',
  font: '10px sans-serif',
} as unknown as CanvasRenderingContext2D

const EXPORTED_DATA_URL = 'data:image/png;base64,AAAA'

class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 800
  naturalHeight = 600
  crossOrigin: string | null = null
  private currentSrc = ''
  set src(value: string) {
    this.currentSrc = value
    queueMicrotask(() => this.onload?.())
  }
  get src(): string {
    return this.currentSrc
  }
}

function renderAnnotator() {
  const onApply = vi.fn()
  const onClose = vi.fn()
  render(<ImageAnnotator open imageUrl="blob:mock-image" onClose={onClose} onApply={onApply} />)
  return { onApply, onClose }
}

/** 等图片就绪(状态 ready)并给 canvas 补上 1:1 的布局矩形,让指针坐标可直接换算 */
async function readyCanvas(): Promise<HTMLCanvasElement> {
  const canvas = (await screen.findByTestId('image-annotator-canvas')) as HTMLCanvasElement
  await waitFor(() => {
    expect(screen.getByTestId('image-annotator-surface').getAttribute('data-status')).toBe('ready')
  })
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  } as DOMRect)
  return canvas
}

function drawRect(canvas: HTMLCanvasElement): void {
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 20, clientY: 20 })
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 140, clientY: 100 })
  fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 140, clientY: 100 })
}

function annotationCount(): string | null {
  return screen.getByTestId('image-annotator-surface').getAttribute('data-annotation-count')
}

beforeEach(() => {
  Object.values(ctxSpies).forEach((spy) => spy.mockClear())
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(EXPORTED_DATA_URL)
  vi.stubGlobal('Image', MockImage)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ImageAnnotator(D124)', () => {
  it('打开后渲染标注对话框与画布,且未自动应用', async () => {
    const { onApply } = renderAnnotator()
    expect(await screen.findByTestId('image-annotator')).toBeTruthy()
    await readyCanvas()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('拖拽绘制产生非空 dataURL 并回传给宿主', async () => {
    const { onApply } = renderAnnotator()
    const canvas = await readyCanvas()

    drawRect(canvas)
    await waitFor(() => expect(annotationCount()).toBe('1'))

    fireEvent.click(screen.getByTestId('image-annotator-apply'))

    expect(onApply).toHaveBeenCalledTimes(1)
    const dataUrl = onApply.mock.calls[0]?.[0] as string
    expect(dataUrl.startsWith('data:image/png')).toBe(true)
    expect(dataUrl.length).toBeGreaterThan('data:image/png'.length)
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/png')
    // 画布上确实执行过绘制指令(clearRect + strokeRect 是矩形工具的最小证据)
    expect(ctxSpies.clearRect).toHaveBeenCalled()
    expect(ctxSpies.strokeRect).toHaveBeenCalled()
  })

  it('撤销移除最后一个形状,重做可恢复', async () => {
    renderAnnotator()
    const canvas = await readyCanvas()

    drawRect(canvas)
    await waitFor(() => expect(annotationCount()).toBe('1'))

    const undo = screen.getByTestId('image-annotator-undo') as HTMLButtonElement
    const redo = screen.getByTestId('image-annotator-redo') as HTMLButtonElement
    expect(undo.disabled).toBe(false)
    expect(redo.disabled).toBe(true)

    fireEvent.click(undo)
    await waitFor(() => expect(annotationCount()).toBe('0'))
    expect(undo.disabled).toBe(true)

    fireEvent.click(redo)
    await waitFor(() => expect(annotationCount()).toBe('1'))
    expect(redo.disabled).toBe(true)
  })

  it('关闭对话框不触发应用回调', async () => {
    const { onApply, onClose } = renderAnnotator()
    await readyCanvas()

    fireEvent.click(screen.getByTestId('image-annotator-cancel'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('dataUrlToFile 把导出结果转成可直接上传的 PNG File', () => {
    const file = dataUrlToFile(EXPORTED_DATA_URL, 'shot-annotated.png')
    expect(file.name).toBe('shot-annotated.png')
    expect(file.type).toBe('image/png')
    expect(file.size).toBe(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
