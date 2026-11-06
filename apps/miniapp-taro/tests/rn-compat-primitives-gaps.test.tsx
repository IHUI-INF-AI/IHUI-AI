// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * rn-compat 原语能力缺口判据(2026-11-06)。
 *
 * 五类缺口(逐条:阴性对照先红 → 阳性对照后绿):
 *  1. ScrollView 无确定高度边界(flex:1 在 Taro scroll-view 不成立);
 *  2. Modal 无 Portal(被祖先 overflow/transform 裁剪);
 *  3. onLayout 声明不下发;
 *  4. onEndReachedThreshold 误读成 onEndThreshold(ratio 当 px);
 *  5. numberOfLines≥2 丢失(line-clamp 从未生成)。
 *
 * 说明:miniapp-taro 未安装 jsdom / @testing-library,沿用 tests/rn-compat-flatlist-ref.test.tsx
 * 的最小 DOM shim(同源 tests/use-auth.test.tsx)。DOM stub 没有 Yoga,量不出真实布局 ⇒
 * 本判据只锁「原语交给 Taro 的属性/结构」以及与 RN 语义的换算结果,不假装测了布局。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const captured = vi.hoisted(() => ({
  scrollView: null as Record<string, unknown> | null,
  text: null as Record<string, unknown> | null,
  taroView: null as Record<string, unknown> | null,
  portal: null as Record<string, unknown> | null,
  queries: [] as string[],
  rect: null as { left?: number; top?: number; width?: number; height?: number } | null,
}))

// Taro 组件替换成记录 props 的最小实现;本判据只关心原语交给 Taro 的属性/结构。
vi.mock('@tarojs/components', () => ({
  ScrollView: (props: Record<string, unknown>) => {
    captured.scrollView = props
    return null
  },
  View: (props: Record<string, unknown>) => {
    captured.taroView = props
    // 关键:ScrollView 的 flex 包装层必须把 children 真的挂下去,
    // 否则内层 scroll-view 不会被渲染,拿不到它交给 Taro 的 style。
    return (props.children ?? null) as never
  },
  Text: (props: Record<string, unknown>) => {
    captured.text = props
    return null
  },
  Image: () => null,
  Input: () => null,
  Textarea: () => null,
  Switch: () => null,
  RootPortal: (props: Record<string, unknown>) => {
    captured.portal = props
    return null
  },
}))

// `primitives` → `./style` 在模块 load 期 `import Taro from '@tarojs/taro'`;真实包会拉起
// @tarojs/runtime 的 dom-external,node 环境缺 `ENABLE_INNER_HTML` 当场爆。
// 这里的替身同时提供 SelectorQuery / nextTick,用于 onLayout 与 threshold 视口测量。
vi.mock('@tarojs/taro', () => ({
  default: {
    getSystemInfoSync: () => ({ pixelRatio: 2, windowWidth: 375, windowHeight: 800 }),
    nextTick: (fn: () => void) => fn(),
    createSelectorQuery: () => ({
      select: (selector: string) => ({
        boundingClientRect: (cb: (rect: unknown) => void) => ({
          exec: () => {
            captured.queries.push(selector)
            if (captured.rect) cb(captured.rect)
          },
        }),
      }),
    }),
  },
}))

// === 最小 DOM shim(与 tests/rn-compat-flatlist-ref.test.tsx / tests/use-auth.test.tsx 同源)===
const ELEMENT_NODE = 1
const TEXT_NODE = 3
const DOCUMENT_NODE = 9
const FRAGMENT_NODE = 11

class ShimNode {
  nodeType = 0
  nodeName = ''
  parentNode: ShimNode | null = null
  childNodes: ShimNode[] = []
  nextSibling: ShimNode | null = null
  previousSibling: ShimNode | null = null
  ownerDocument!: ShimDocument
  appendChild<T extends ShimNode>(c: T): T {
    if (c.parentNode) {
      const i = c.parentNode.childNodes.indexOf(c)
      if (i >= 0) c.parentNode.childNodes.splice(i, 1)
    }
    c.parentNode = this
    this.childNodes.push(c)
    this._relink()
    return c
  }
  removeChild<T extends ShimNode>(c: T): T {
    const i = this.childNodes.indexOf(c)
    if (i >= 0) this.childNodes.splice(i, 1)
    c.parentNode = null
    this._relink()
    return c
  }
  insertBefore<T extends ShimNode>(c: T, ref: ShimNode | null): T {
    if (c.parentNode) {
      const i = c.parentNode.childNodes.indexOf(c)
      if (i >= 0) c.parentNode.childNodes.splice(i, 1)
    }
    c.parentNode = this
    if (ref === null) this.childNodes.push(c)
    else {
      const i = this.childNodes.indexOf(ref)
      this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, c)
    }
    this._relink()
    return c
  }
  private _relink(): void {
    for (let i = 0; i < this.childNodes.length; i++) {
      const c = this.childNodes[i]
      if (!c) continue
      c.previousSibling = i > 0 ? (this.childNodes[i - 1] ?? null) : null
      c.nextSibling = i < this.childNodes.length - 1 ? (this.childNodes[i + 1] ?? null) : null
    }
  }
  get firstChild(): ShimNode | null {
    return this.childNodes[0] ?? null
  }
  get lastChild(): ShimNode | null {
    return this.childNodes[this.childNodes.length - 1] ?? null
  }
  hasChildNodes(): boolean {
    return this.childNodes.length > 0
  }
  contains(n: ShimNode | null): boolean {
    let x: ShimNode | null = n
    while (x) {
      if (x === this) return true
      x = x.parentNode
    }
    return false
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true
  }
  cloneNode(): ShimNode {
    return new ShimNode()
  }
  get textContent(): string {
    return ''
  }
  set textContent(_v: string) {}
}

class ShimElement extends ShimNode {
  nodeType = ELEMENT_NODE
  tagName: string
  attributes: Record<string, string> = {}
  style: Record<string, string> = {}
  classList = {
    add() {},
    remove() {},
    contains() {
      return false
    },
  }
  dataset: Record<string, string> = {}
  constructor(tagName: string, ownerDocument: ShimDocument) {
    super()
    this.tagName = tagName.toUpperCase()
    this.nodeName = this.tagName
    this.ownerDocument = ownerDocument
  }
  setAttribute(name: string, value: unknown): void {
    this.attributes[name] = String(value)
  }
  getAttribute(name: string): string | null {
    return name in this.attributes ? (this.attributes[name] ?? null) : null
  }
  hasAttribute(name: string): boolean {
    return name in this.attributes
  }
  removeAttribute(name: string): void {
    delete this.attributes[name]
  }
  getElementById(): ShimElement | null {
    return null
  }
  querySelector(): ShimElement | null {
    return null
  }
  querySelectorAll(): ShimElement[] {
    return []
  }
  override get textContent(): string {
    return this.childNodes
      .map((c) => (c.nodeType === TEXT_NODE ? (c as ShimText).data : c.textContent))
      .join('')
  }
  override set textContent(v: string) {
    this.childNodes = []
    const t = new ShimText(v, this.ownerDocument)
    t.parentNode = this
    this.childNodes.push(t)
  }
}

class ShimText extends ShimNode {
  nodeType = TEXT_NODE
  nodeName = '#text'
  data = ''
  constructor(text: string, ownerDocument: ShimDocument) {
    super()
    this.data = text
    this.ownerDocument = ownerDocument
  }
  override get textContent(): string {
    return this.data
  }
  override set textContent(v: string) {
    this.data = v
  }
}

class ShimDocumentFragment extends ShimNode {
  nodeType = FRAGMENT_NODE
  nodeName = '#document-fragment'
  constructor(ownerDocument: ShimDocument) {
    super()
    this.ownerDocument = ownerDocument
  }
}

class ShimWindow {
  document: ShimDocument
  navigator = { userAgent: 'vitest-node' }
  HTMLElement = ShimElement
  HTMLInputElement = ShimElement
  HTMLTextAreaElement = ShimElement
  HTMLSelectElement = ShimElement
  HTMLIFrameElement = class HTMLIFrameElement {}
  Element = ShimElement
  Node = ShimNode
  constructor(doc: ShimDocument) {
    this.document = doc
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  setTimeout = (fn: () => void, ms?: number) => setTimeout(fn, ms)
  clearTimeout = (id: ReturnType<typeof setTimeout>) => clearTimeout(id)
  requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0)
  cancelAnimationFrame = (id: ReturnType<typeof setTimeout>) => clearTimeout(id)
  getComputedStyle(): { getPropertyValue(): string } {
    return {
      getPropertyValue() {
        return ''
      },
    }
  }
  getSelection(): { rangeCount: number; toString(): string } {
    return { rangeCount: 0, toString: () => '' }
  }
}

class ShimDocument extends ShimNode {
  nodeType = DOCUMENT_NODE
  nodeName = '#document'
  documentElement: ShimElement
  body: ShimElement
  head: ShimElement
  defaultView: ShimWindow
  activeElement: ShimElement | null = null
  constructor() {
    super()
    this.ownerDocument = this
    this.documentElement = new ShimElement('html', this)
    this.body = new ShimElement('body', this)
    this.head = new ShimElement('head', this)
    this.activeElement = this.body
    this.defaultView = new ShimWindow(this)
  }
  createElement(tag: string): ShimElement {
    return new ShimElement(tag, this)
  }
  createElementNS(_ns: string, tag: string): ShimElement {
    return new ShimElement(tag, this)
  }
  createTextNode(text: string): ShimText {
    return new ShimText(text, this)
  }
  createDocumentFragment(): ShimDocumentFragment {
    return new ShimDocumentFragment(this)
  }
  createComment(_text: string): ShimNode {
    const n = new ShimNode()
    n.nodeType = 8
    n.nodeName = '#comment'
    n.ownerDocument = this
    return n
  }
  getElementById(): ShimElement | null {
    return null
  }
  querySelector(): ShimElement | null {
    return null
  }
  querySelectorAll(): ShimElement[] {
    return []
  }
}

const shimDoc = new ShimDocument()
const defineGlobal = (name: string, value: unknown): void => {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
    enumerable: false,
  })
}
defineGlobal('document', shimDoc)
defineGlobal('window', shimDoc.defaultView)
defineGlobal('navigator', shimDoc.defaultView.navigator)
defineGlobal('Element', ShimElement)
defineGlobal('HTMLElement', ShimElement)
defineGlobal('HTMLInputElement', ShimElement)
defineGlobal('HTMLIFrameElement', class HTMLIFrameElement {})
defineGlobal('HTMLTextAreaElement', ShimElement)
defineGlobal('HTMLSelectElement', ShimElement)
defineGlobal('SVGElement', ShimElement)
defineGlobal('Text', ShimText)
defineGlobal('Document', ShimDocument)
defineGlobal('Node', ShimNode)
defineGlobal('DocumentFragment', ShimDocumentFragment)
defineGlobal('requestAnimationFrame', shimDoc.defaultView.requestAnimationFrame)
defineGlobal('cancelAnimationFrame', shimDoc.defaultView.cancelAnimationFrame)
defineGlobal(
  'MutationObserver',
  class {
    observe(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] {
      return []
    }
  },
)
defineGlobal('IS_REACT_ACT_ENVIRONMENT', true)

async function renderNode(node: ReactElement): Promise<Root> {
  const root = createRoot(shimDoc.createElement('div') as unknown as HTMLElement)
  await act(async () => {
    root.render(node)
  })
  return root
}

beforeEach(() => {
  captured.scrollView = null
  captured.text = null
  captured.taroView = null
  captured.portal = null
  captured.queries = []
  captured.rect = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// === 1. ScrollView 高度边界 ===
describe('rn-compat ScrollView 高度边界', () => {
  it('阴性对照:旧形制(flex:1 直出)没有确定高度,scroll-view 不会滚', async () => {
    const { ScrollView: TaroScrollView } = await import('@tarojs/components')
    const { toTaroStyle } = await import('../src/rn-compat/style')
    const LegacyScrollView = (props: Record<string, unknown>) =>
      createElement(
        TaroScrollView as never,
        {
          ...props,
          style: toTaroStyle(props.style),
          lowerThreshold: props.onEndThreshold,
          onScrollToLower: props.onEndReached,
        } as never,
      )
    const root = await renderNode(createElement(LegacyScrollView as never, { style: { flex: 1 } }))
    expect(captured.scrollView?.style).toEqual({ flex: 1 })
    expect((captured.scrollView?.style as Record<string, unknown>)?.height).toBeUndefined()
    await act(async () => root.unmount())
  })

  it('阳性对照:flex:1 在内层补 height:100%(外层容器提供确定基准)', async () => {
    const { ScrollView } = await import('../src/rn-compat/primitives')
    const root = await renderNode(createElement(ScrollView as never, { style: { flex: 1 } }))
    const style = captured.scrollView?.style as Record<string, unknown>
    expect(style.height).toBe('100%')
    expect(style.flex).toBe(1)
    await act(async () => root.unmount())
  })

  it('显式 height 路径不注入 100%(不改变既有盒模型)', async () => {
    const { ScrollView } = await import('../src/rn-compat/primitives')
    const root = await renderNode(createElement(ScrollView as never, { style: { height: 300 } }))
    const style = captured.scrollView?.style as Record<string, unknown>
    expect(style.height).toBe('300px')
    await act(async () => root.unmount())
  })

  it('横向 flex:1 补 width:100%', async () => {
    const { ScrollView } = await import('../src/rn-compat/primitives')
    const root = await renderNode(
      createElement(ScrollView as never, { horizontal: true, style: { flex: 1 } }),
    )
    const style = captured.scrollView?.style as Record<string, unknown>
    expect(style.width).toBe('100%')
    await act(async () => root.unmount())
  })
})

// === 2. Modal → Portal ===
describe('rn-compat Modal Portal', () => {
  it('阴性对照:旧形制直出 fixed View,不进 RootPortal(会被祖先裁剪)', async () => {
    const { View: TaroView } = await import('@tarojs/components')
    const LegacyModal = (props: Record<string, unknown>) => {
      if (props.visible !== true) return null
      return createElement(
        TaroView as never,
        {
          style: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 },
        } as never,
      )
    }
    const root = await renderNode(createElement(LegacyModal as never, { visible: true }))
    expect(captured.portal).toBeNull()
    expect(captured.taroView?.style).toMatchObject({ position: 'fixed', zIndex: 9999 })
    await act(async () => root.unmount())
  })

  it('阳性对照:visible 时内容经 RootPortal 渲染(脱离祖先层叠上下文)', async () => {
    const { Modal } = await import('../src/rn-compat/primitives')
    const root = await renderNode(
      createElement(Modal as never, { visible: true, transparent: true }),
    )
    expect(captured.portal).not.toBeNull()
    const overlay = (captured.portal?.children as ReactElement<{ style?: Record<string, unknown> }>)
      .props.style
    expect(overlay).toMatchObject({ position: 'fixed', zIndex: 9999 })
    await act(async () => root.unmount())
  })

  it('visible !== true ⇒ 不渲染也不进 Portal(RN 关闭态语义)', async () => {
    const { Modal } = await import('../src/rn-compat/primitives')
    const root = await renderNode(createElement(Modal as never, { visible: false }))
    expect(captured.portal).toBeNull()
    expect(captured.taroView).toBeNull()
    await act(async () => root.unmount())
  })
})

// === 3. onLayout 下发 ===
describe('rn-compat onLayout 下发', () => {
  it('阴性对照:旧形制把 onLayout 声明丢了,回调永不触发', async () => {
    const { View: TaroView } = await import('@tarojs/components')
    const onLayout = vi.fn()
    const LegacyView = (props: Record<string, unknown>) =>
      createElement(TaroView as never, { id: 'probe', onLayout: props.onLayout } as never)
    const root = await renderNode(createElement(LegacyView as never, { onLayout }))
    expect(onLayout).not.toHaveBeenCalled()
    expect(captured.queries).toEqual([])
    await act(async () => root.unmount())
  })

  it('阳性对照:SelectorQuery → 合成 RN 形状 nativeEvent.layout(width/height 全等)', async () => {
    captured.rect = { left: 10, top: 20, width: 320, height: 120 }
    const { View } = await import('../src/rn-compat/primitives')
    const onLayout = vi.fn()
    const root = await renderNode(
      createElement(View as never, { id: 'probe', onLayout, style: { flex: 1 } }),
    )
    expect(captured.queries).toContain('#probe')
    expect(onLayout).toHaveBeenCalledTimes(1)
    expect(onLayout.mock.calls[0]?.[0]).toEqual({
      nativeEvent: { layout: { x: 10, y: 20, width: 320, height: 120 } },
    })
    await act(async () => root.unmount())
  })

  it('取不到节点矩形 ⇒ 静默跳过,不派发 0 尺寸假事件', async () => {
    captured.rect = null
    const { View } = await import('../src/rn-compat/primitives')
    const onLayout = vi.fn()
    const root = await renderNode(createElement(View as never, { id: 'probe', onLayout }))
    expect(onLayout).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })
})

// === 4. onEndReachedThreshold 单位换算 ===
describe('rn-compat onEndReachedThreshold', () => {
  it('阴性对照:旧形制只认 onEndThreshold,RN 的 ratio 键被丢弃', async () => {
    const { ScrollView: TaroScrollView } = await import('@tarojs/components')
    const LegacyScrollView = (props: Record<string, unknown>) =>
      createElement(
        TaroScrollView as never,
        {
          ...props,
          lowerThreshold: props.onEndThreshold,
          onScrollToLower: props.onEndReached,
        } as never,
      )
    const root = await renderNode(
      createElement(LegacyScrollView as never, {
        style: { height: 600 },
        onEndReachedThreshold: 0.5,
        onEndReached: () => {},
      }),
    )
    expect(captured.scrollView?.lowerThreshold).toBeUndefined()
    await act(async () => root.unmount())
  })

  it('阳性对照:0.5 ratio × 800px 窗口 = 400px,并接住 onEndReached', async () => {
    captured.rect = null // 量不到自身尺寸时退回系统窗口高度
    const { ScrollView } = await import('../src/rn-compat/primitives')
    const onEndReached = vi.fn()
    const root = await renderNode(
      createElement(ScrollView as never, {
        style: { height: 600 },
        onEndReachedThreshold: 0.5,
        onEndReached,
      }),
    )
    expect(captured.scrollView?.lowerThreshold).toBe(400)
    expect(captured.scrollView?.onScrollToLower).toBe(onEndReached)
    await act(async () => root.unmount())
  })

  it('量到自身视口时按自身轴向尺寸换算(嵌套半屏列表不放大触发距离)', async () => {
    captured.rect = { left: 0, top: 0, width: 375, height: 300 }
    const { ScrollView } = await import('../src/rn-compat/primitives')
    const root = await renderNode(
      createElement(ScrollView as never, {
        style: { height: 300 },
        onEndReachedThreshold: 0.5,
      }),
    )
    expect(captured.scrollView?.lowerThreshold).toBe(150)
    await act(async () => root.unmount())
  })
})

// === 5. numberOfLines≥2 ===
describe('rn-compat numberOfLines≥2', () => {
  it('阴性对照:旧形制只处理单行,3 行截断无 -webkit-line-clamp', async () => {
    const { Text: TaroText } = await import('@tarojs/components')
    const { toTaroStyle } = await import('../src/rn-compat/style')
    const LegacyText = (props: Record<string, unknown>) =>
      createElement(
        TaroText as never,
        {
          style: toTaroStyle({
            ...(props.style as Record<string, unknown>),
            ...(props.numberOfLines === 1 ? { whiteSpace: 'nowrap' } : {}),
          }),
        } as never,
      )
    const root = await renderNode(
      createElement(LegacyText as never, { numberOfLines: 3, style: { fontSize: 14 } }),
    )
    const style = captured.text?.style as Record<string, unknown>
    expect(style.WebkitLineClamp).toBeUndefined()
    expect(style.display).toBeUndefined()
    await act(async () => root.unmount())
  })

  it('阳性对照:numberOfLines=3 ⇒ line-clamp 3 + -webkit-box', async () => {
    const { Text } = await import('../src/rn-compat/primitives')
    const root = await renderNode(
      createElement(Text as never, { numberOfLines: 3, style: { fontSize: 14 } }),
    )
    const style = captured.text?.style as Record<string, unknown>
    expect(style.WebkitLineClamp).toBe(3)
    expect(style.display).toBe('-webkit-box')
    expect(style.WebkitBoxOrient).toBe('vertical')
    expect(style.overflow).toBe('hidden')
    await act(async () => root.unmount())
  })

  it('单行维持旧 nowrap(不改变既有单行排版)', async () => {
    const { Text } = await import('../src/rn-compat/primitives')
    const root = await renderNode(createElement(Text as never, { numberOfLines: 1 }))
    const style = captured.text?.style as Record<string, unknown>
    expect(style.whiteSpace).toBe('nowrap')
    expect(style.WebkitLineClamp).toBeUndefined()
    await act(async () => root.unmount())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
