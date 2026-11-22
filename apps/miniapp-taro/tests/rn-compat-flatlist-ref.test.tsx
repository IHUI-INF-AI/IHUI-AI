// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * rn-compat FlatList ref 透传判据(2026-11-05,薄壳化前置)
 *
 * 现场:`packages/app/src/features/chat/ChatScreen.tsx:199-203` 把内部 FlatList 的 ref 交给
 * `onListRef`,消费端靠 `ref.scrollToEnd({animated:true})` 做流式自动滚底
 * (`apps/miniapp-taro/src/pkg-ai/ai-chat-detail/index.tsx` 原先用 scrollTop 承接同一行为)。
 *
 * 阴性对照(必须先红后绿):
 *  - 旧形制是普通函数组件,React 不挂 ref ⇒ 同 harness 传 ref 拿到 null,`scrollToEnd` 不触发;
 *  - 补 forwardRef 后同 harness 拿到句柄,scrollTop 递增并带 scrollWithAnimation。
 *  两段用同一个 `runHarness()` 现场,只替换被渲染的组件,避免"补了能跑"自证。
 *
 * 说明:miniapp-taro 未安装 jsdom / @testing-library,故此处沿用 tests/use-auth.test.tsx
 * 的最小 DOM shim,仅依赖 react 18 + react-dom 18。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, act, type Ref } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type {
  ScrollViewHandle,
  TextInputHandle,
  SectionListHandle,
} from '../src/rn-compat/primitives'

const captured = vi.hoisted(() => ({
  scrollView: null as Record<string, unknown> | null,
  input: null as Record<string, unknown> | null,
  textarea: null as Record<string, unknown> | null,
}))

// Taro 组件替换成记录 props 的最小实现;本判据只关心命令式方法翻译后落到哪些 prop
vi.mock('@tarojs/components', () => ({
  ScrollView: (props: Record<string, unknown>) => {
    captured.scrollView = props
    return null
  },
  View: () => null,
  Text: () => null,
  Image: () => null,
  Input: (props: Record<string, unknown>) => {
    captured.input = props
    return null
  },
  Textarea: (props: Record<string, unknown>) => {
    captured.textarea = props
    return null
  },
  Switch: () => null,
}))

// `primitives` → `./style` 在模块 load 期 `import Taro from '@tarojs/taro'`;真实包会拉起
// @tarojs/runtime 的 dom-external,node 环境缺 `ENABLE_INNER_HTML` 当场爆。本判据只关心
// FlatList 的命令式滚动,故给最小替身(style.ts 唯一运行时取值是 hairlineWidth 的 pixelRatio)。
vi.mock('@tarojs/taro', () => ({
  default: { getSystemInfoSync: () => ({ pixelRatio: 2 }) },
}))

// === 最小 DOM shim(与 tests/use-auth.test.tsx 同源,react-dom/client 需要)===
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

interface Handle {
  scrollToEnd: (p?: { animated?: boolean }) => void
  scrollToOffset: (p: { offset: number; animated?: boolean }) => void
  scrollToIndex: (p: { index: number; animated?: boolean }) => void
}

/** 同一现场:同一 harness,只替换被渲染组件(extraProps 供 ScrollView/TextInput/SectionList 用例) */
async function runHarness<T = Handle>(
  Comp: never,
  extraProps: Record<string, unknown> = {},
): Promise<{ handle: T | null; root: Root }> {
  let handle: T | null = null
  const onRef: Ref<T> = (h) => {
    handle = h
  }
  function Harness() {
    return createElement(Comp, {
      data: [],
      renderItem: () => null,
      ...extraProps,
      ref: onRef,
    } as never)
  }
  const root = createRoot(shimDoc.createElement('div') as unknown as HTMLElement)
  await act(async () => {
    root.render(createElement(Harness))
  })
  return { handle, root }
}

describe('rn-compat FlatList ref 透传', () => {
  beforeEach(() => {
    captured.scrollView = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('阴性对照:旧形制(普通函数组件,未补 ref)同一现场拿不到句柄,scrollToEnd 不触发', async () => {
    // 旧版形制原样复刻:普通函数组件,不 forwardRef
    // 这里借用 mock 的 ScrollView 承接 props,才能记录到"旧形制交给底层 ScrollView 的是什么";
    // React 对普通函数组件会剥掉 ref(仅告警),故 scrollTop 必然缺席。
    const { ScrollView } = await import('@tarojs/components')
    const LegacyFlatList = (props: Record<string, unknown>) =>
      createElement(ScrollView as never, props as never)
    const { handle, root } = await runHarness(LegacyFlatList as never)
    expect(handle).toBeNull()
    expect(captured.scrollView).not.toBeNull()
    expect((captured.scrollView as Record<string, unknown>).scrollTop).toBeUndefined()
    await act(async () => root.unmount())
  })

  it('阳性对照:补 forwardRef 后同一现场拿到句柄,scrollToEnd 驱动 scrollTop 递增', async () => {
    const { FlatList } = await import('../src/rn-compat/primitives')
    const first = await runHarness(FlatList as never)
    expect(first.handle).not.toBeNull()
    await act(async () => first.handle?.scrollToEnd({ animated: true }))
    expect((captured.scrollView as Record<string, unknown>).scrollTop).toBe(1_000_000)
    expect((captured.scrollView as Record<string, unknown>).scrollWithAnimation).toBe(true)
    await act(async () => first.handle?.scrollToEnd({ animated: false }))
    expect((captured.scrollView as Record<string, unknown>).scrollTop).toBe(2_000_000)
    expect((captured.scrollView as Record<string, unknown>).scrollWithAnimation).toBe(false)
    await act(async () => first.handle?.scrollToOffset({ offset: 120, animated: true }))
    expect((captured.scrollView as Record<string, unknown>).scrollTop).toBe(120)
    await act(async () => first.root.unmount())
  })
})

// === 同类真缺口(2026-11-05 一并补):ScrollView / TextInput / SectionList 的命令式方法 ===

describe('rn-compat ScrollView ref 透传', () => {
  beforeEach(() => {
    captured.scrollView = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('阴性对照:旧形制(普通函数组件)拿不到句柄,scrollToEnd 不触发', async () => {
    const { ScrollView: TaroScrollView } = await import('@tarojs/components')
    const LegacyScrollView = (props: Record<string, unknown>) =>
      createElement(TaroScrollView as never, props as never)
    const { handle, root } = await runHarness(LegacyScrollView as never)
    expect(handle).toBeNull()
    expect(captured.scrollView).not.toBeNull()
    expect(captured.scrollView?.scrollTop).toBeUndefined()
    await act(async () => root.unmount())
  })

  it('阳性对照:补 forwardRef 后 scrollTo/scrollToEnd 翻译成 scrollTop/scrollLeft', async () => {
    const { ScrollView } = await import('../src/rn-compat/primitives')
    const first = await runHarness<ScrollViewHandle>(ScrollView as never)
    expect(first.handle).not.toBeNull()
    await act(async () => first.handle?.scrollToEnd({ animated: true }))
    expect(captured.scrollView?.scrollTop).toBe(1_000_000)
    expect(captured.scrollView?.scrollWithAnimation).toBe(true)
    await act(async () => first.handle?.scrollTo({ x: 30, y: 240, animated: false }))
    expect(captured.scrollView?.scrollTop).toBe(240)
    expect(captured.scrollView?.scrollLeft).toBe(30)
    expect(captured.scrollView?.scrollWithAnimation).toBe(false)
    expect(first.handle?.getScrollResponder()).toBe(first.handle)
    await act(async () => first.root.unmount())
  })
})

describe('rn-compat TextInput ref 透传', () => {
  beforeEach(() => {
    captured.input = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('阴性对照:旧形制拿不到句柄,focus 从未落到 Taro Input', async () => {
    const { Input } = await import('@tarojs/components')
    const LegacyTextInput = (props: Record<string, unknown>) =>
      createElement(Input as never, props as never)
    const { handle, root } = await runHarness(LegacyTextInput as never, {
      value: '',
      onChangeText: () => {},
    })
    expect(handle).toBeNull()
    expect(captured.input).not.toBeNull()
    expect(captured.input?.focus).toBeUndefined()
    await act(async () => root.unmount())
  })

  it('阳性对照:补 forwardRef 后 focus/blur/clear/isFocused 生效且句柄稳定', async () => {
    const { TextInput } = await import('../src/rn-compat/primitives')
    const onChangeText = vi.fn()
    const first = await runHarness<TextInputHandle>(TextInput as never, {
      value: '',
      onChangeText,
    })
    expect(first.handle).not.toBeNull()
    await act(async () => first.handle?.focus())
    expect(captured.input?.focus).toBe(true)
    expect(first.handle?.isFocused()).toBe(true)
    await act(async () => first.handle?.blur())
    expect(captured.input?.focus).toBe(false)
    expect(first.handle?.isFocused()).toBe(false)
    await act(async () => first.handle?.clear())
    expect(onChangeText).toHaveBeenCalledWith('')
    await act(async () => first.root.unmount())
  })
})

describe('rn-compat SectionList ref 透传', () => {
  beforeEach(() => {
    captured.scrollView = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  const sections = [
    { key: 'a', data: [1, 2] },
    { key: 'b', data: [3] },
  ]

  it('阴性对照:旧形制拿不到句柄,scrollToLocation 不触发', async () => {
    const { ScrollView: TaroScrollView } = await import('@tarojs/components')
    const LegacySectionList = (props: Record<string, unknown>) =>
      createElement(TaroScrollView as never, props as never)
    const { handle, root } = await runHarness(LegacySectionList as never, { sections })
    expect(handle).toBeNull()
    expect(captured.scrollView).not.toBeNull()
    expect(captured.scrollView?.scrollIntoView).toBeUndefined()
    await act(async () => root.unmount())
  })

  it('阳性对照:补 forwardRef 后 scrollToLocation 翻译成 scrollIntoView', async () => {
    const { SectionList } = await import('../src/rn-compat/primitives')
    const first = await runHarness<SectionListHandle>(SectionList as never, { sections })
    expect(first.handle).not.toBeNull()
    await act(async () => first.handle?.scrollToLocation({ sectionIndex: 1, itemIndex: 0 }))
    expect(captured.scrollView?.scrollIntoView).toBe('sl-1-0')
    expect(captured.scrollView?.scrollWithAnimation).toBe(true)
    expect(first.handle?.getScrollResponder()).not.toBeNull()
    await act(async () => first.root.unmount())
  })
})

/**
 * 受控 scrollTop 的 prop→state 同步(2026-11-12 补)。
 *
 * 旧形制把 `props.scrollTop` 只当 useState 的**初值**:挂载取一次,此后父级每次改这个 prop
 * 都被这一层丢掉,底层 ScrollView 收到的永远是内部 state 的旧值。后果不是"滚得不准"而是
 * **整条路不存在** —— pkg-ai 聊天页 2026-11-12 把流式跟底改成"父级递增 scrollTop"之后,
 * 父级算出的新值一次也没到达 ScrollView,只有命令式句柄那条腿还通。
 *
 * 判据:同一个 root 上 rerender 换 prop,底层必须跟着变;不传时不得凭空产生值。
 */
describe('rn-compat FlatList 受控 scrollTop prop 同步', () => {
  beforeEach(() => {
    captured.scrollView = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  async function mountWithScrollTop(initial: number) {
    const { FlatList } = await import('../src/rn-compat/primitives')
    let root: Root | null = null
    const onRef: Ref<Handle> = () => undefined
    function Harness({ scrollTop }: { scrollTop?: number }) {
      return createElement(
        FlatList as never,
        {
          data: [],
          renderItem: () => null,
          ...(scrollTop === undefined ? {} : { scrollTop }),
          ref: onRef,
        } as never,
      )
    }
    const container = shimDoc.createElement('div') as unknown as HTMLElement
    root = createRoot(container)
    await act(async () => {
      root!.render(createElement(Harness, { scrollTop: initial }))
    })
    return {
      rerender: async (next: number | undefined) => {
        await act(async () => {
          root!.render(createElement(Harness, next === undefined ? {} : { scrollTop: next }))
        })
      },
      unmount: async () => {
        await act(async () => root!.unmount())
      },
    }
  }

  it('父级更新 scrollTop ⇒ 底层 ScrollView 跟着变(旧实现此处恒为初值)', async () => {
    const h = await mountWithScrollTop(1_000_000)
    expect(captured.scrollView?.scrollTop).toBe(1_000_000)
    await h.rerender(2_000_000)
    expect(captured.scrollView?.scrollTop).toBe(2_000_000)
    await h.rerender(3_000_000)
    expect(captured.scrollView?.scrollTop).toBe(3_000_000)
    await h.unmount()
  })

  it('不传 scrollTop 时不凭空产生受控值(既有宿主零变化)', async () => {
    const h = await mountWithScrollTop(undefined as unknown as number)
    expect(captured.scrollView?.scrollTop).toBeUndefined()
    await h.unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
