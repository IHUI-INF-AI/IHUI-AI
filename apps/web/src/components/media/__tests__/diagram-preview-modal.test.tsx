// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * G-854 矢量图独立预览 Modal 的接线与手势测试。
 *
 * 分两块:
 *   A. **入口链路**(票面点名那条):点内联工具条的「展开」→ 出现 role=dialog → Esc 关掉。
 *      走真实 `MermaidDiagram`,只 mock mermaid / next-themes / next-intl,不 mock 承载层。
 *   B. **手势数学落到 DOM 的方式**:倍率、滚动位、捏合、ctrl+滚轮。
 *
 * 关于 mock 与桩的边界(§「不要 mock 掉你正要验的那一层」):
 *   · 被 mock 的只有 mermaid(渲染耗时与真图无关)、next-themes、next-intl(回显键名)。
 *   · 几何一律**只喂输入**:`getBoundingClientRect` 与 `clientWidth/Height` 打桩,
 *     钳制/定点/键表走的仍是组件与共享层的真实代码。
 *   · `scrollLeft/scrollTop`:jsdom 没有布局,写进去读不回来,所以在实例上定义**可写自有属性**
 *     让它可观测 —— 断言打的仍是"组件有没有把值写到这个元素上",不是内部布尔。
 *   · **不断言 computed style**:jsdom 会静默丢掉 oklab 这类新色彩函数(本仓记过),
 *     观感一律留到真机复核(见交付报告「未验证」)。
 */
import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const { mockMermaidRender, mockMermaidInitialize } = vi.hoisted(() => ({
  mockMermaidRender: vi.fn(),
  mockMermaidInitialize: vi.fn(),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('mermaid', () => ({
  default: {
    initialize: mockMermaidInitialize.mockResolvedValue(undefined),
    render: mockMermaidRender,
  },
}))
vi.mock('@/lib/copy-as-image', () => ({
  svgElementToPngBlob: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })),
}))

import { MermaidDiagram } from '../MermaidDiagram'
import { DiagramPreviewModal } from '../DiagramPreviewModal'

const CONTENT = { w: 1000, h: 800 }
const VIEWPORT = { w: 400, h: 300 }

const rect = (w: number, h: number): DOMRect =>
  ({
    width: w,
    height: h,
    top: 0,
    left: 0,
    right: w,
    bottom: h,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect

/**
 * 视口/内容的量测桩:按 data-testid 分派,其余元素一律当视口大小。
 * jsdom 不做布局,真实值恒为 0 ⇒ 不打桩就只能得到"回落"那一档结论。
 */
function stubGeometry(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute('data-testid') === 'diagram-preview-content'
      ? rect(CONTENT.w, CONTENT.h)
      : rect(VIEWPORT.w, VIEWPORT.h)
  })
}

/** 把滚动位与视口尺寸做成实例上可读写的属性(jsdom 不提供布局,写进去本就读不回来)。 */
function instrumentScrollArea(el: HTMLElement): void {
  for (const [prop, value] of [
    ['scrollLeft', 0],
    ['scrollTop', 0],
    ['clientWidth', VIEWPORT.w],
    ['clientHeight', VIEWPORT.h],
  ] as const) {
    Object.defineProperty(el, prop, { configurable: true, writable: true, value })
  }
}

function scrollArea(): HTMLElement {
  const el = screen.queryByTestId('diagram-preview-scroll')
  if (!(el instanceof HTMLElement)) throw new Error('setup failed: 没渲染出预览画布')
  return el
}

function level(): string {
  const el = screen.getByTestId('diagram-preview-zoom-level')
  return el.textContent ?? ''
}

function openModal(): HTMLElement {
  stubGeometry()
  render(<DiagramPreviewModal open onClose={vi.fn()} svgMarkup="<svg><text>mocked</text></svg>" />)
  const el = scrollArea()
  instrumentScrollArea(el)
  return el
}

const POINTER = { bubbles: true, cancelable: true, pointerId: 1 }

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('G-854 · 入口链路:展开 → dialog → Esc', () => {
  it('点「展开为独立预览」出现 role=dialog,Esc 关闭后画布整块摘除', async () => {
    mockMermaidRender.mockResolvedValue({ svg: '<svg><text>mocked</text></svg>' })
    stubGeometry()
    render(<MermaidDiagram code="graph TD;A-->B" />)
    await waitFor(() => expect(screen.queryByTestId('mermaid-scroll')).toBeTruthy())

    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByTestId('mermaid-expand-preview'))
    await screen.findByRole('dialog')
    expect(screen.getByTestId('diagram-preview-scroll')).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('展开按钮走 i18n 键且声明了它打开的是 dialog(不得写死中文、不得裸用 title)', async () => {
    mockMermaidRender.mockResolvedValue({ svg: '<svg><text>mocked</text></svg>' })
    stubGeometry()
    render(<MermaidDiagram code="graph TD;A-->B" />)
    await waitFor(() => expect(screen.queryByTestId('mermaid-expand-preview')).toBeTruthy())
    const btn = screen.getByTestId('mermaid-expand-preview')
    expect(btn.getAttribute('aria-label')).toBe('mermaidExpandPreview')
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    expect(btn.getAttribute('title')).toBeNull()
  })
})

describe('G-854 · 拖拽平移(平移就是滚动位置)', () => {
  it('D1 单段拖拽:scrollLeft/scrollTop 跟着反向位移走', () => {
    const el = openModal()
    fireEvent.pointerDown(el, { ...POINTER, clientX: 200, clientY: 150 })
    fireEvent.pointerMove(el, { ...POINTER, clientX: 120, clientY: 110 })
    expect(el.scrollLeft).toBe(80)
    expect(el.scrollTop).toBe(40)
  })

  it('D2 同一趟拖拽的第二段不得累加(基线取按下那一刻,不是实时值)', () => {
    const el = openModal()
    fireEvent.pointerDown(el, { ...POINTER, clientX: 200, clientY: 150 })
    fireEvent.pointerMove(el, { ...POINTER, clientX: 120, clientY: 110 })
    expect(el.scrollLeft).toBe(80)
    // 回到中途:目标 = 基线(0) + (200 − 160) = 40,而不是 80 + 40 = 120
    fireEvent.pointerMove(el, { ...POINTER, clientX: 160, clientY: 130 })
    expect(el.scrollLeft).toBe(40)
    expect(el.scrollTop).toBe(20)
  })

  it('D3 越界被钳:上界 = 缩放后占位 − 视口,下界 = 0', () => {
    const el = openModal()
    fireEvent.pointerDown(el, { ...POINTER, clientX: 200, clientY: 150 })
    fireEvent.pointerMove(el, { ...POINTER, clientX: -9999, clientY: -9999 })
    expect(el.scrollLeft).toBe(CONTENT.w - VIEWPORT.w)
    expect(el.scrollTop).toBe(CONTENT.h - VIEWPORT.h)
    fireEvent.pointerMove(el, { ...POINTER, clientX: 9999, clientY: 9999 })
    expect(el.scrollLeft).toBe(0)
    expect(el.scrollTop).toBe(0)
  })
})

describe('G-854 · 键盘与按钮改倍率/平移', () => {
  it('K1 “+” 放大一档并以视口中心定点;方向键再平移一档', () => {
    const el = openModal()
    fireEvent.keyDown(el, { key: '+' })
    expect(level()).toBe('120%')
    // 定点缩放:中心 (200,150) 处的内容点在 1→1.2 后仍停在原位 ⇒ scroll = 0.2 × 200 / 0.2 × 150
    expect(el.scrollLeft).toBe(40)
    expect(el.scrollTop).toBe(30)
    fireEvent.keyDown(el, { key: 'ArrowRight' })
    expect(el.scrollLeft).toBe(88)
    fireEvent.keyDown(el, { key: 'ArrowLeft' })
    expect(el.scrollLeft).toBe(40)
  })

  it('K2 “-” 缩小一档、“0” 复位到 100%', () => {
    const el = openModal()
    fireEvent.keyDown(el, { key: '=' })
    expect(level()).toBe('120%')
    fireEvent.keyDown(el, { key: '-' })
    expect(level()).toBe('100%')
    fireEvent.keyDown(el, { key: '=' })
    fireEvent.keyDown(el, { key: '0' })
    expect(level()).toBe('100%')
  })

  it('K3 不认识的键:既不改动视图,也**不 preventDefault**(键得还给上层与浏览器)', () => {
    const el = openModal()
    const before = el.scrollLeft
    const handled = fireEvent.keyDown(el, { key: 'PageDown' })
    expect(handled, 'fireEvent 返回 false 才说明事件被 preventDefault 了').toBe(true)
    expect(el.scrollLeft).toBe(before)
    expect(level()).toBe('100%')
  })

  it('K4 ctrl+方向键不归预览器(那是文本编辑/浏览器手势),ctrl+"=" 才归', () => {
    const el = openModal()
    const handled = fireEvent.keyDown(el, { key: 'ArrowRight', ctrlKey: true })
    expect(handled).toBe(true)
    expect(el.scrollLeft).toBe(0)
    fireEvent.keyDown(el, { key: '=', ctrlKey: true })
    expect(level()).toBe('120%')
  })

  it('K5 工具条按钮:放大/缩小/适应视口/复位各管一档', () => {
    const el = openModal()
    fireEvent.click(screen.getByTestId('diagram-preview-zoom-in'))
    expect(level()).toBe('120%')
    fireEvent.click(screen.getByTestId('diagram-preview-zoom-out'))
    expect(level()).toBe('100%')
    // 适应视口:min(1, 400/1000, 300/800) = 0.375 ⇒ 触底到 MIN_ZOOM 0.4,且滚动归零
    fireEvent.pointerDown(el, { ...POINTER, clientX: 200, clientY: 150 })
    fireEvent.pointerMove(el, { ...POINTER, clientX: 100, clientY: 100 })
    expect(el.scrollLeft).toBe(100)
    fireEvent.click(screen.getByTestId('diagram-preview-zoom-fit'))
    expect(level()).toBe('40%')
    expect(el.scrollLeft).toBe(0)
    expect(el.scrollTop).toBe(0)
    fireEvent.click(screen.getByTestId('diagram-preview-zoom-reset'))
    expect(level()).toBe('100%')
  })
})

describe('G-854 · ctrl+滚轮定点缩放与双指捏合', () => {
  it('W1 ctrl+滚轮:吃掉浏览器缩放并把光标下的内容点钉住', () => {
    const el = openModal()
    const handled = fireEvent.wheel(el, { ctrlKey: true, deltaY: -100, clientX: 200, clientY: 150 })
    expect(handled, '处理器必须 preventDefault,否则页面级缩放会抢走这次手势').toBe(false)
    expect(level()).toBe('122%')
    // 锚点 (200,150) 不动 ⇒ scroll = 0.22 × 200 ≈ 44(钳制后仍在上界内)
    expect(el.scrollLeft).toBeCloseTo(44, 0)
  })

  it('W2 不带 ctrl 的滚轮:不动倍率、更不吃事件(它本来就是滚动意图)', () => {
    const el = openModal()
    const handled = fireEvent.wheel(el, { deltaY: -100, clientX: 200, clientY: 150 })
    expect(handled).toBe(true)
    expect(level()).toBe('100%')
    expect(el.scrollLeft).toBe(0)
  })

  it('N1 双指张开:以两指**当前**中点为锚放大,倍率跟距离比', () => {
    const el = openModal()
    fireEvent.pointerDown(el, { ...POINTER, pointerId: 1, clientX: 100, clientY: 150 })
    fireEvent.pointerDown(el, { ...POINTER, pointerId: 2, clientX: 300, clientY: 150 })
    fireEvent.pointerMove(el, { ...POINTER, pointerId: 2, clientX: 500, clientY: 150 })
    expect(level()).toBe('200%')
    // 焦点取张开之后的中点 ((100+500)/2 = 300,150) —— 与地图类捏合同一条口径;
    // 1 → 2 时该点下的内容坐标就是 300,所以滚动位 = (2 − 1) × 300 = 300(上界 1000×2−400 之内)
    expect(el.scrollLeft).toBe(300)
    expect(el.scrollTop).toBe(150)
  })

  it('N2 捏合进行中不把它当成一次拖拽平移(第二指落下即作废拖拽基线)', () => {
    const el = openModal()
    fireEvent.pointerDown(el, { ...POINTER, pointerId: 1, clientX: 100, clientY: 150 })
    fireEvent.pointerMove(el, { ...POINTER, pointerId: 1, clientX: 60, clientY: 150 })
    expect(el.scrollLeft).toBe(40)
    fireEvent.pointerDown(el, { ...POINTER, pointerId: 2, clientX: 300, clientY: 150 })
    fireEvent.pointerMove(el, { ...POINTER, pointerId: 1, clientX: 10, clientY: 150 })
    // 距离被拉大(200 → 290)⇒ 走捏合分支,倍率上升;而不是把这次位移再算成一次平移
    expect(parseInt(level(), 10)).toBeGreaterThan(100)
  })
})

describe('G-854 · 挂载时机(这条是本轮真 bug 的钉子)', () => {
  /**
   * Radix Dialog 的滚动锁(react-remove-scroll)在**第一次提交渲染的是 null**,children 要等它自己
   * 的 effect 之后那次提交才挂上来。所以任何 `useEffect(…, [open])` 里 `scrollRef.current` 的写法
   * 都会在"打开的那一刻"读到 null ⇒ ctrl+滚轮的监听与"打开即聚焦"**静默不生效**,
   * 而 React 合成事件(按钮、键盘、拖拽)照常工作 —— 症状正是"渲染好了、只有滚轮没反应"。
   * 本条把两半都钉住:监听必须真的挂在**画布节点**上,且真能吃掉这次事件。
   */
  it('M1 ctrl+滚轮监听挂在画布节点上,并且真 preventDefault', () => {
    const registered: EventTarget[] = []
    const orig = EventTarget.prototype.addEventListener
    vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === 'wheel' && (options as { passive?: boolean } | undefined)?.passive === false) {
        registered.push(this)
      }
      return orig.call(this, type as never, listener as never, options as never)
    })
    stubGeometry()
    render(<DiagramPreviewModal open onClose={vi.fn()} svgMarkup="<svg><text>a</text></svg>" />)
    const el = scrollArea()
    instrumentScrollArea(el)

    expect(registered, 'passive:false 的 wheel 监听必须挂在画布节点上').toContain(el)

    const ev = new WheelEvent('wheel', {
      ctrlKey: true,
      deltaY: -100,
      clientX: 200,
      clientY: 150,
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    vi.restoreAllMocks()
  })
})

describe('G-854 · 打开即复位(不带上一张图的视角)', () => {
  it('O1 关闭再打开:倍率回 100%', () => {
    stubGeometry()
    const view = render(
      <DiagramPreviewModal open onClose={vi.fn()} svgMarkup="<svg><text>a</text></svg>" />,
    )
    const el = scrollArea()
    instrumentScrollArea(el)
    fireEvent.keyDown(el, { key: '+' })
    expect(level()).toBe('120%')

    view.rerender(
      <DiagramPreviewModal open={false} onClose={vi.fn()} svgMarkup="<svg><text>a</text></svg>" />,
    )
    view.rerender(
      <DiagramPreviewModal open onClose={vi.fn()} svgMarkup="<svg><text>a</text></svg>" />,
    )
    expect(level()).toBe('100%')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
