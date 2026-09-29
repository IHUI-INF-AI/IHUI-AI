// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D198「复制为图片」落盘层单测:canvas/Image/URL 全部 stub,
// 只验证绘制编排(尺寸计算、超宽行折行、主题底色、字体重置时机)与 Blob 产出。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { codeTextToPngBlob, svgElementToPngBlob } from '../copy-as-image'

const MONO_FONT = '14px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'

function buildCtxStub(measureCharWidth: number) {
  const fillStyleHistory: string[] = []
  return {
    fillStyleHistory,
    font: '',
    textBaseline: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * measureCharWidth })),
    get fillStyle(): string {
      return fillStyleHistory[fillStyleHistory.length - 1] ?? ''
    },
    set fillStyle(v: string) {
      fillStyleHistory.push(v)
    },
  }
}

function buildCanvasStub(ctx: ReturnType<typeof buildCtxStub>) {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn((cb: (b: Blob | null) => void) =>
      cb(new Blob(['png-bytes'], { type: 'image/png' })),
    ),
  }
}

class FakeImage {
  static last: FakeImage | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ''
  constructor() {
    FakeImage.last = this
    queueMicrotask(() => this.onload?.())
  }
}

describe('codeTextToPngBlob', () => {
  let ctx: ReturnType<typeof buildCtxStub>
  let canvas: ReturnType<typeof buildCanvasStub>
  const realCreateElement = document.createElement.bind(document)

  beforeEach(() => {
    vi.stubGlobal('Image', FakeImage)
    ctx = buildCtxStub(8.4)
    canvas = buildCanvasStub(ctx)
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas'
        ? (canvas as unknown as HTMLCanvasElement)
        : realCreateElement(tag)) as typeof document.createElement)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('短代码:最小宽度 160,单行绘制,字体重置在置尺寸之后', async () => {
    const blob = await codeTextToPngBlob('const a=1', { dark: true })
    expect(canvas.width).toBe(160) // max(9*8.4+32, 160) → 160
    expect(canvas.height).toBe(52) // 1 行 * 20 + 32
    expect(ctx.font).toBe(MONO_FONT) // 置尺寸会清掉上下文状态,末次赋值必须是绘制字体
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 160, 52)
    expect(ctx.fillText).toHaveBeenCalledTimes(1)
    expect(ctx.fillText).toHaveBeenCalledWith('const a=1', 16, 16)
    expect(blob.type).toBe('image/png')
  })

  it('深/浅主题底色与前景色按序赋值(dark: zinc-950/zinc-100;light: zinc-100/zinc-900)', async () => {
    await codeTextToPngBlob('x', { dark: true })
    expect(ctx.fillStyleHistory).toEqual(['#09090b', '#f4f4f5'])

    await codeTextToPngBlob('x')
    expect(ctx.fillStyleHistory).toEqual(['#09090b', '#f4f4f5', '#f4f4f5', '#18181b'])
  })

  it('超宽行按字符折行(138 字符/行 → 300 字符 3 行),宽度封顶 1200', async () => {
    // maxCharsPerLine = floor((1200-32)/8.4) = 138
    const long = 'a'.repeat(300)
    await codeTextToPngBlob(long)
    expect(ctx.fillText).toHaveBeenCalledTimes(3)
    expect(canvas.height).toBe(3 * 20 + 32)
    expect(canvas.width).toBe(1200)
  })

  it('多行代码逐行绘制', async () => {
    await codeTextToPngBlob('a\nb\nc')
    expect(ctx.fillText).toHaveBeenCalledTimes(3)
    expect(canvas.height).toBe(3 * 20 + 32)
  })
})

describe('svgElementToPngBlob', () => {
  let ctx: ReturnType<typeof buildCtxStub>
  let canvas: ReturnType<typeof buildCanvasStub>
  const realCreateElement = document.createElement.bind(document)

  beforeEach(() => {
    vi.stubGlobal('Image', FakeImage)
    ctx = buildCtxStub(8.4)
    canvas = buildCanvasStub(ctx)
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas'
        ? (canvas as unknown as HTMLCanvasElement)
        : realCreateElement(tag)) as typeof document.createElement)
    ;(URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:mock')
    ;(URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function makeSvg(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('style', 'max-width: 600px;')
    document.body.appendChild(svg)
    return svg as unknown as SVGSVGElement
  }

  it('克隆定尺寸 → Image → canvas 绘制(2x)→ PNG Blob,并回收 objectURL', async () => {
    const svg = makeSvg()
    const blob = await svgElementToPngBlob(svg, { background: '#09090b' })
    // jsdom 无布局:clientWidth/gBCR 全 0 → 兜底 300×150,scale 2 → 600×300
    expect(canvas.width).toBe(600)
    expect(canvas.height).toBe(300)
    expect(ctx.fillStyleHistory).toEqual(['#09090b'])
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 600, 300)
    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
    expect(ctx.drawImage.mock.calls[0]?.[0]).toBeInstanceOf(FakeImage)
    expect(FakeImage.last?.src).toBe('blob:mock')
    expect(blob.type).toBe('image/png')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    svg.remove()
  })
})
