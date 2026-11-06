// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 考试结果页薄壳形制锁(apps/miniapp-taro/src/pages/exam/result.tsx)。
 *
 * 本页在「单源改造」后只保留:数据(记录详情 + 名次摘要)/ 主题根 / NavBar / 微信分享节点。
 * 版面、四格统计、全量解析、rank、底部三操作全部由
 * `@ihui/rn-app/features/exam-result/ExamResultScreen` 输出。
 *
 * 钉四件事:
 *  ① 共享屏真被渲染,数据按记录口径注入(passed/totalCount/rank/details);
 *  ② props 逐个到达(含 onNavigate 与 shareAction 节点,少一个即红);
 *  ③ onNavigate 真落成小程序路径(ExamQuestion → answer?id=<examId>,Exam → list);
 *  ④ 端内不再有第二份渲染(自绘统计/回顾/底栏 JSX 与样式类不得回潮)。
 *
 * 渲染层:miniapp-taro 端 vitest environment=node 且未安装 jsdom / @testing-library/react,
 * 故沿用同仓先例 tests/use-auth.test.tsx 与 tests/rn-compat-flatlist-ref.test.tsx 的
 * 自包含 DOM shim + react-dom/client 真实挂载。本页取数走 useEffect ⇒ 必须真挂载,
 * 否则量不到 item 映射与错误态(SSR 不跑 effect)。
 *
 * 阴性对照:
 *  - 摘掉页面任一传入 prop(例 onNavigate / shareAction) ⇒ ② 必红;
 *  - 改回页内自渲染(重新出现 <Text>/exam-result-hero) ⇒ ④ 必红。
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const state = vi.hoisted(() => ({
  routeParams: {} as Record<string, string>,
  captured: null as Record<string, unknown> | null,
  record: null as Record<string, unknown> | null,
  summary: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/exam-result/ExamResultScreen', () => {
  const Stub = (props: Record<string, unknown>) => {
    state.captured = props
    return createElement('div', { 'data-shell': 'exam-result-screen' })
  }
  Stub.displayName = 'ExamResultScreenShellStub'
  return { ExamResultScreen: Stub }
})

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateBack: vi.fn(),
    redirectTo: vi.fn(),
  }
  return {
    default: Taro,
    ...Taro,
    useRouter: () => ({ params: state.routeParams }),
    useShareAppMessage: vi.fn(),
  }
})

vi.mock('@tarojs/components', () => ({
  View: (props: { children?: ReactNode }) => createElement('div', {}, props.children),
  Button: (props: { children?: ReactNode; openType?: string; className?: string }) =>
    createElement(
      'button',
      { 'data-open-type': props.openType, 'data-class-name': props.className },
      props.children,
    ),
}))

// t 与 gate 必须是模块级稳定引用:本页 effect 依赖 t / waitUntilReady,
// 每次渲染新建函数会把 effect 打成自激循环。
vi.mock('@/i18n', () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    params?.n !== undefined ? `${key}#${params.n}` : key
  const api = { t, locale: 'zh-CN' }
  return { useI18n: () => api }
})

vi.mock('@/api', () => ({
  get: vi.fn(() => Promise.resolve(state.record)),
  getExamResult: vi.fn(() => Promise.resolve(state.summary)),
}))

vi.mock('@/hooks/use-auth-ready-gate', () => {
  const gate = {
    ready: true,
    allow: true,
    waitUntilReady: (cb: () => void) => {
      cb()
    },
  }
  return { useAuthReadyGate: () => gate }
})

vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

vi.mock('@/components', () => ({
  NavBar: (props: { title?: string; showBack?: boolean }) =>
    createElement('header', { 'data-nav-back': String(props.showBack) }, props.title),
}))

vi.mock('@/rn-compat/theme', () => {
  const theme = { resolvedTheme: 'light' as const }
  return { useTheme: () => theme }
})

// === 最小 DOM shim(原样取自 tests/use-auth.test.tsx,不装 jsdom/RTL,不新建公共 stub)===

const SHIM_ELEMENT_NODE = 1
const SHIM_TEXT_NODE = 3
const SHIM_DOCUMENT_NODE = 9
const SHIM_FRAGMENT_NODE = 11

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
    if (ref === null) {
      this.childNodes.push(c)
    } else {
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
  nodeType = SHIM_ELEMENT_NODE
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
      .map((c) => (c.nodeType === SHIM_TEXT_NODE ? (c as ShimText).data : c.textContent))
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
  nodeType = SHIM_TEXT_NODE
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
  nodeType = SHIM_FRAGMENT_NODE
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
  nodeType = SHIM_DOCUMENT_NODE
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

// 安装全局 DOM(react-dom/client 依赖 document/window/Element 等)
// Node 21+ 把 navigator 暴露为只读 getter,需用 defineProperty 覆盖;
// document/window/Element 等也统一用 defineProperty 以避免潜在的 setter 冲突。
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
  class MutationObserverShim {
    observe(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] {
      return []
    }
  },
)
defineGlobal('IS_REACT_ACT_ENVIRONMENT', true)

// === 真实挂载:await act 两跳,第一跳渲染 + 跑 effect,第二跳把取数 Promise 链推到 setState ===
let root: Root | null = null

async function mount(element: ReactElement): Promise<void> {
  const container = document.createElement('div')
  root = createRoot(container)
  await act(async () => {
    root!.render(element)
  })
  // 取数链是 Promise.all(...).then(...).catch(...).finally(...):用一次宏任务把整条
  // 微任务链在 act 内跑完,避免 setState 落到 act 之外(否则 ⑤ 会报未包裹的 Root 更新)。
  await act(async () => {
    await new Promise<void>((done) => setTimeout(done, 0))
  })
}

import Taro from '@tarojs/taro'
import { onToast } from '@/host/on-toast'
import { get, getExamResult } from '@/api'
import ExamResult from '../src/pages/exam/result'

const PAGE_SOURCE = readFileSync(resolve('src/pages/exam/result.tsx'), 'utf8')

const RECORD = {
  examId: 'e1',
  score: 88,
  totalScore: 100,
  isPassed: true,
  correctCount: 3,
  wrongCount: 2,
  unansweredCount: 1,
  duration: 30,
  submittedAt: '2026-11-01 10:00',
  details: [
    {
      questionId: 'q1',
      title: '题一',
      userAnswer: ['A', 'B'],
      correctAnswer: ['A', 'B'],
      isCorrect: true,
      score: 10,
      analysis: '解析一',
    },
  ],
}

const SUMMARY = { score: 88, pass: true, rank: 3, total: 20 }

describe('考试结果页(共享屏薄壳)', () => {
  beforeEach(() => {
    state.routeParams = { id: 'r1' }
    state.captured = null
    state.record = RECORD
    state.summary = SUMMARY
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await act(async () => {
      root?.unmount()
      root = null
    })
  })

  it('① 数据注入:记录口径映射成 item,汇总只补 rank', async () => {
    await mount(createElement(ExamResult))

    expect(get).toHaveBeenCalledWith('/exam/records/r1')
    expect(getExamResult).toHaveBeenCalledWith('r1')
    expect(state.captured!.item).toMatchObject({
      id: 'r1',
      examId: 'e1',
      score: 88,
      totalScore: 100,
      passed: true,
      correctCount: 3,
      wrongCount: 2,
      unansweredCount: 1,
      totalCount: 6,
      duration: 30,
      rank: 3,
      rankTotal: 20,
    })
    const details = (state.captured!.item as { details: Array<Record<string, unknown>> }).details
    expect(details).toHaveLength(1)
    expect(details[0]).toMatchObject({ id: 'q1', yourAnswer: ['A', 'B'], isCorrect: true })
  })

  it('② props 逐个到达:onNavigate 与 shareAction(原生 share 节点)都在,摘掉即红', async () => {
    await mount(createElement(ExamResult))
    const props = state.captured!
    expect(typeof props.t).toBe('function')
    expect(props.colorScheme).toBe('light')
    expect(typeof props.onBack).toBe('function')
    expect(typeof props.onRetry).toBe('function')
    // 阴性对照①:摘掉 onNavigate → 这里拿不到函数,测试必红
    expect(typeof props.onNavigate).toBe('function')
    // 阴性对照②:分享必须是注入节点,且是小程序原生 openType(不是回调、不是页内自绘)
    // 注:断言落在宿主节点的原始 props 上(Taro 的 openType 只在渲染时翻译成属性),
    // 因此这里看到的就是 `<Button openType="share">`,换成回调或自绘按钮都会红。
    const shareNode = props.shareAction as ReactElement<{
      openType?: string
      className?: string
    }>
    expect(shareNode).toBeTruthy()
    expect(shareNode.props.openType).toBe('share')
    expect(shareNode.props.className).toBe('exam-result-share-btn')
  })

  it('③ onNavigate 真映射:再考一次落到 answer?id=<examId>,列表落到 list', async () => {
    await mount(createElement(ExamResult))
    const onNavigate = state.captured!.onNavigate as (
      target: string,
      params?: Record<string, unknown>,
    ) => void

    onNavigate('ExamQuestion', { examId: 'e1' })
    expect(Taro.redirectTo).toHaveBeenCalledWith({ url: '/pages/exam/answer?id=e1' })

    onNavigate('Exam')
    expect(Taro.redirectTo).toHaveBeenCalledWith({ url: '/pages/exam/list' })

    onNavigate('Unknown')
    expect(onToast).toHaveBeenCalled()
  })

  it('④ 端内不再有第二份渲染:自绘 JSX/样式类/统计键不得回潮', () => {
    expect(PAGE_SOURCE).not.toMatch(/<Text\b|<ScrollView\b|LineIcon/)
    expect(PAGE_SOURCE).not.toMatch(/exam-result-(hero|badge|stats|review|footer|btn|card)/)
    expect(PAGE_SOURCE).not.toMatch(/examResult\.(statCorrect|reviewTitle|rank)/)
    expect(PAGE_SOURCE).toContain("from '@ihui/rn-app/features/exam-result/ExamResultScreen'")
    expect(PAGE_SOURCE).toContain('onNavigate={onNavigate}')
    expect(PAGE_SOURCE).toContain('shareAction={renderWxShareButton(')
  })

  it('⑤ 无 id 无 score:显式错误态,且不造无动作的重试按钮', async () => {
    state.routeParams = {}
    state.record = null
    await mount(createElement(ExamResult))
    expect(state.captured!.error).toBe('examResult.loadFailed')
    expect(state.captured!.loading).toBe(false)
    expect(state.captured!.item).toBeNull()
    expect(state.captured!.onRetry).toBeUndefined()
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
