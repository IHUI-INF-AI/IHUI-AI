// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * 小程序 distribution/team 团队树接线锁(缺口 B)。
 *
 * 阳性:getDistributionTree 返回的真实树数据必须到共享屏 `tree` prop,层级数、
 * onRetryTree(重新取数)、onPressTreeMember(跳 member-detail?id=)全部真接线。
 * 阴性对照:页面不传 `tree={tree}`(或删掉 loadTree/setTree)时,本套件首条
 * `expect(props().tree).toBeDefined()` 即红;数据腿失败时 tree 保持 undefined、
 * 只置 treeFailed,不影响成员列表。
 *
 * miniapp-taro 无 jsdom / @testing-library,沿用 tests/use-auth.test.tsx 的最小
 * DOM shim(仅依赖 react 18 + react-dom 18)真实挂载并跑 useEffect/useState。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// === 最小 DOM shim(react-dom/client createRoot 依赖 document/window/Element 等)===
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

const captured = vi.hoisted(() => ({
  team: null as Record<string, unknown> | null,
  didShow: null as (() => void) | null,
}))

const apiMocks = vi.hoisted(() => ({
  getDistributionTeam: vi.fn(),
  getDistributionTree: vi.fn(),
}))

const taroMocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
}))

vi.mock('@ihui/rn-app/features/team/TeamScreen', () => ({
  TeamScreen: (props: Record<string, unknown>) => {
    captured.team = props
    return createElement('div', { 'data-shell': 'team-screen' })
  },
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => createElement('div', props),
  Text: (props: Record<string, unknown>) => createElement('span', props),
}))

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateBack: taroMocks.navigateBack,
    navigateTo: taroMocks.navigateTo,
    stopPullDownRefresh: vi.fn(),
  }
  return {
    default: Taro,
    useDidShow: (cb: () => void) => {
      captured.didShow = cb
    },
    ...Taro,
  }
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
  useTt: () => (key: string, fallback?: string) => fallback ?? key,
}))

vi.mock('@/api', () => ({
  getDistributionTeam: apiMocks.getDistributionTeam,
}))

vi.mock('@ihui/api-client', () => ({
  getDistributionTree: apiMocks.getDistributionTree,
}))

vi.mock('@/hooks/use-auth-ready-gate', () => {
  // 门控立即放行:本册只判树接线,不测冷启动抢跑
  const gate = {
    waitUntilReady: (cb: () => void) => {
      cb()
      return () => {}
    },
  }
  return { useAuthReadyGate: () => gate }
})

vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: unknown }) =>
    createElement('div', null, props.children as never)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import DistributionTeam from '../src/pages/distribution/team'

const PAGE_SOURCE = readFileSync(resolve('src/pages/distribution/team.tsx'), 'utf8')
const props = () => captured.team as Record<string, unknown>

const roots: Root[] = []

async function mountPage(): Promise<Root> {
  const container = shimDoc.createElement('div')
  const root = createRoot(container as unknown as HTMLElement)
  roots.push(root)
  await act(async () => {
    root.render(createElement(DistributionTeam))
  })
  return root
}

/** 模拟页面显示:触发 useDidShow 回调(内部经门控立即跑成员 + 树取数) */
async function showPage(): Promise<void> {
  await act(async () => {
    captured.didShow?.()
    await Promise.resolve()
  })
}

async function waitFor<T>(fn: () => T, timeout = 1000): Promise<T> {
  const start = Date.now()
  while (true) {
    try {
      return fn()
    } catch (e) {
      if (Date.now() - start > timeout) throw e
      await new Promise((r) => setTimeout(r, 10))
    }
  }
}

const treeRow = {
  id: 't1',
  username: 'alice',
  nickname: '爱丽丝',
  avatar: null,
  createdAt: '2026-01-01',
  level: 1,
  children: [
    {
      id: 't2',
      username: 'bob',
      nickname: null,
      avatar: null,
      createdAt: '2026-02-01',
      level: 2,
    },
  ],
}

describe('distribution/team 团队树接线(缺口 B)', () => {
  beforeEach(() => {
    captured.team = null
    captured.didShow = null
    taroMocks.navigateTo.mockReset()
    taroMocks.navigateBack.mockReset()
    apiMocks.getDistributionTree.mockReset()
    apiMocks.getDistributionTeam.mockReset()
    apiMocks.getDistributionTeam.mockResolvedValue({ list: [], total: 0 })
  })

  it('阳性:树数据真到共享屏 tree prop,层级/重试/节点点击全部接线', async () => {
    apiMocks.getDistributionTree.mockResolvedValue({
      success: true,
      data: { tree: [treeRow], totalLevels: 2 },
    })
    const root = await mountPage()
    await showPage()

    await waitFor(() => expect(props().tree).toBeDefined())
    const tree = props().tree as Array<Record<string, unknown>>
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ id: 't1', username: 'alice', nickname: '爱丽丝', level: 1 })
    expect((tree[0]!.children as unknown[]).length).toBe(1)
    expect(props().treeTotalLevels).toBe(2)
    expect(props().treeLoading).toBe(false)
    expect(props().treeFailed).toBe(false)
    expect(typeof props().onRetryTree).toBe('function')
    expect(typeof props().onPressTreeMember).toBe('function')

    // 重试真重新取数
    apiMocks.getDistributionTree.mockClear()
    apiMocks.getDistributionTree.mockResolvedValue({
      success: true,
      data: { tree: [], totalLevels: 0 },
    })
    await act(async () => {
      ;(props().onRetryTree as () => void)()
    })
    await waitFor(() => expect(apiMocks.getDistributionTree).toHaveBeenCalledTimes(1))
    await waitFor(() => expect((props().tree as unknown[]).length).toBe(0))

    // 树节点点击 → 小程序 member-detail,参数与 RN memberId 同义
    ;(props().onPressTreeMember as (id: string) => void)('t9')
    expect(taroMocks.navigateTo).toHaveBeenCalledWith({
      url: '/pages/distribution/member-detail/index?id=t9',
    })

    await act(async () => root.unmount())
  })

  it('阴性对照:数据腿失败时 tree 保持 undefined,只置 treeFailed', async () => {
    apiMocks.getDistributionTree.mockResolvedValue({ success: false })
    const root = await mountPage()
    await showPage()

    await waitFor(() => expect(props().treeFailed).toBe(true))
    expect(props().tree).toBeUndefined()
    expect(props().treeTotalLevels).toBe(0)
    expect(typeof props().onRetryTree).toBe('function')

    await act(async () => root.unmount())
  })

  it('源码锁:tree 系列 props 必须真的传给共享屏(摘除即红)', () => {
    expect(PAGE_SOURCE).toContain('getDistributionTree')
    expect(PAGE_SOURCE).toContain('tree={tree}')
    expect(PAGE_SOURCE).toContain('treeLoading={treeLoading}')
    expect(PAGE_SOURCE).toContain('treeFailed={treeFailed}')
    expect(PAGE_SOURCE).toContain('treeTotalLevels={treeTotalLevels}')
    expect(PAGE_SOURCE).toContain('onRetryTree=')
    expect(PAGE_SOURCE).toContain('onPressTreeMember=')
  })
})
