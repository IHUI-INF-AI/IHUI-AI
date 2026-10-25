// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * miniapp-taro 端 I18nProvider:context value / t / tList 的身份必须跨渲染稳定(母型缺陷回归锁)
 *
 * 立因(与 mobile-rn 同一母型,RN 已修并入库,本端同步修复 + 补锁):
 *   Provider 原先把 `value={{ locale, t, tList, setLocale }}` 写成每次渲染新建的字面量 ⇒
 *   整个 context 值**每次渲染都换身份**。后果不是"多渲染一次"这么轻:任何把 context 值
 *   (或它的成员)写进 effect 依赖、或用 memo 消费该值的真实页面都会跟着重跑/被无谓重渲染
 *   —— 这正是 RN 端实测到的钱包页 `[load]` effect 重跑、`getBalance` 被真调 2 次的那具母型。
 *   本端 t/tList 已是 useCallback([messages])、setLocale 已是 useCallback([]),缺的只是把
 *   value 用 useMemo 定身(依赖 = locale/t/tList/setLocale)。
 *
 * 三条判据(照 mobile-rn 的 tests/i18n-provider-value-identity.test.tsx,不许更弱):
 *  ① 消费者确实被渲染 ≥2 次 —— 否则下面两条恒成立,测试是空的;
 *  ② 重渲染前后 value / t / tList / setLocale 引用**不变**,且依赖 t(以及依赖整个 value)
 *     的 effect 只跑 1 次(这条就是钱包那台机的最小形状);
 *  ③ 反向对照:locale 变化后必须真的换词典(取到 en 文案)、t/tList 身份**必须**变、
 *     effect 必须重跑 —— 防"把 value memo 成常量 / 依赖漏写 locale"这种把语言冻住的假修复。
 *
 * 为什么本端要自建 DOM shim:miniapp-taro 的 vitest environment=node,devDependencies 里
 * 没有 jsdom / @testing-library/react(react 18 + react-dom 18 已在依赖内)。本文件复用
 * 同仓先例 tests/use-auth.test.tsx 的最小 DOM shim 形态,真实挂载 Provider 跑
 * useState/useEffect —— 只有真渲染才量得到"重渲染前后身份"与"effect 实际执行次数"。
 *
 * 判据③为什么走 storage 预置 en 包(而不是"setLocale('en') 后取词变英文"):本端非 zh-CN
 * 语言包是 CDN 按需拉取,getMessages 的契约是 fail-closed —— 包未就绪一律同步回落内置
 * zh-CN,不抛错。所以单测里直接切 en 取到的恒是中文回落值,那条断言要么恒真要么恒假。
 * 这里给 en 预置**与 CDN 同源的真实载荷**(src/assets/remote-locales/en.b64.txt),
 * readCachedPack 同步命中 ⇒ 词典真的换成 en,判据③量的是真切换。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergeMessages } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
import { LOCALE_KEY, I18N_PACK_KEY_PREFIX } from '@/constants/storage'
import { REMOTE_LOCALE_MANIFEST } from '@/i18n/generated/remote-locale-manifest.gen'

// === Taro 替身:同步 storage(本端真机同语义)+ 绝不走网络 ===
// 状态挂在 hoisted 上:mock 工厂按引用闭包捕获它,用例之间只重置内容、不重注册。
const T = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  requestCalls: [] as string[],
}))

vi.mock('@tarojs/taro', () => {
  const TaroMock = {
    // 真机 getStorageSync 取不到时返回 ''(不是 undefined),照此模拟
    getStorageSync: (key: string) => (T.storage.has(key) ? T.storage.get(key) : ''),
    setStorageSync: (key: string, value: string) => {
      T.storage.set(key, value)
    },
    removeStorageSync: (key: string) => {
      T.storage.delete(key)
    },
    getStorageInfoSync: () => ({ keys: [...T.storage.keys()] }),
    // 本文件不测 CDN 腿:任何网络调用当场失败 —— 词典切换必须靠 storage 同步命中,
    // 若哪天判据③变成"等网络回来",这里会立刻炸而不是悄悄变绿。
    request: (opts: { url: string }) => {
      T.requestCalls.push(opts.url)
      return Promise.reject(new Error(`mock: 本用例不得走 CDN(${opts.url})`))
    },
    setTabBarItem: () => Promise.resolve(),
  }
  return { default: TaroMock, ...TaroMock }
})

// === 最小 DOM shim(形态与 tests/use-auth.test.tsx 同一份先例)===
// react-dom/client 的 createRoot 需要 document/window/Element 等全局;本端无 jsdom,
// shim 只需撑起"挂载一棵返回 null 的组件树并跑通 useState/useEffect"这一档。
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
  appendChild<C extends ShimNode>(c: C): C {
    if (c.parentNode) {
      const i = c.parentNode.childNodes.indexOf(c)
      if (i >= 0) c.parentNode.childNodes.splice(i, 1)
    }
    c.parentNode = this
    this.childNodes.push(c)
    this._relink()
    return c
  }
  removeChild<C extends ShimNode>(c: C): C {
    const i = this.childNodes.indexOf(c)
    if (i >= 0) this.childNodes.splice(i, 1)
    c.parentNode = null
    this._relink()
    return c
  }
  insertBefore<C extends ShimNode>(c: C, ref: ShimNode | null): C {
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

// 安装全局 DOM;Node 21+ 的 navigator 是只读 getter,统一用 defineProperty 覆盖。
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

// === 被测件 ===
// import 声明提升到模块顶部,但首次渲染发生在用例里 mount() 之后 ⇒ 上面的全局 shim 必定已就位;
// react-dom/client 的模块期不触 DOM(同仓先例 tests/use-auth.test.tsx 是同一顺序)。
import { I18nProvider, useI18n } from '@/i18n'

type I18nContextValue = ReturnType<typeof useI18n>

/** 每次提交后登记一次,用于量身份是否随渲染漂移 */
let seenContexts: I18nContextValue[] = []
/** 依赖 `t` 的 effect 实际执行次数:缺陷形态下跟着渲染次数走,修复后只在词典换时变 */
let tDependentEffectRuns = 0
/** 依赖**整个 context 值**的 effect 次数:本端 t 本身已稳定,这维才是"每次渲染都换值"的直接伤口 */
let valueDependentEffectRuns = 0

function Consumer() {
  const ctx = useI18n()
  const { t } = ctx

  // 无依赖数组 ⇒ 每次提交后都记一次当前身份(不写渲染期副作用)
  useEffect(() => {
    seenContexts.push(ctx)
  })

  // 钱包那台机的形状:effect 依赖 t,t 换身份 ⇒ effect 重跑 ⇒ 请求被真发第二次
  useEffect(() => {
    tDependentEffectRuns += 1
  }, [t])

  // 同一条母型的另一面:消费者依赖整个 context 值(常见于 `const ctx = useI18n()` 后写进依赖)
  useEffect(() => {
    valueDependentEffectRuns += 1
  }, [ctx])

  return null
}

/** 一个五语言都在的稳定键;词典切换必须能在它上面量到值的变化 */
const KEY = 'tabBar.square'

const MESSAGES_ROOT = join(__dirname, '..', '..', '..', 'packages', 'i18n', 'messages')

function sourceMessages(locale: Locale): Messages {
  const read = (root: 'shared' | 'miniapp-taro') =>
    JSON.parse(readFileSync(join(MESSAGES_ROOT, root, `${locale}.json`), 'utf8')) as Messages
  return mergeMessages(read('shared'), read('miniapp-taro'))
}

function nestedValue(messages: Messages, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, seg) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined,
      messages,
    )
  return typeof value === 'string' ? value : undefined
}

const ZH_TEXT = nestedValue(sourceMessages('zh-CN'), KEY)
const EN_TEXT = nestedValue(sourceMessages('en'), KEY)

/** CDN 同源的真实 en 载荷:storage 命中 ⇒ getMessages 同步拿到 en 词典(不靠网络) */
const EN_PAYLOAD = readFileSync(
  join(__dirname, '..', 'src', 'assets', 'remote-locales', 'en.b64.txt'),
  'utf8',
)

/** 缓存键 = 前缀 + locale + 清单 version(与 src/i18n 的 packStorageKey 同源同式) */
const EN_PACK_STORAGE_KEY = `${I18N_PACK_KEY_PREFIX}en_${REMOTE_LOCALE_MANIFEST.en.version}`

const mountedRoots: Root[] = []
const shimContainer = () => shimDoc.createElement('div')

function tree() {
  return createElement(I18nProvider, null, createElement(Consumer))
}

async function mount(): Promise<{ rerender: () => Promise<void> }> {
  const root = createRoot(shimContainer() as unknown as HTMLElement)
  mountedRoots.push(root)
  await act(async () => {
    root.render(tree())
  })
  return {
    rerender: async () => {
      await act(async () => {
        root.render(tree())
      })
    },
  }
}

/**
 * 本端 tsconfig 开了 noUncheckedIndexedAccess ⇒ 下标取值是 `| undefined`。
 * 取不到样本就是判据没跑起来,必须当场点名,不接受"拿 undefined 继续断言"。
 */
function seenAt(index: number): I18nContextValue {
  const ctx = seenContexts[index]
  if (!ctx) {
    throw new Error(`第 ${index} 次登记没有 context 样本(当前共 ${String(seenContexts.length)} 次)`)
  }
  return ctx
}

function lastSeen(): I18nContextValue {
  return seenAt(seenContexts.length - 1)
}

beforeEach(() => {
  seenContexts = []
  tDependentEffectRuns = 0
  valueDependentEffectRuns = 0
  T.storage.clear()
  T.requestCalls.length = 0
})

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop()
    if (root) {
      await act(async () => {
        root.unmount()
      })
    }
  }
})

describe('miniapp-taro I18nProvider:context value 与 t/tList 的身份必须跨渲染稳定', () => {
  it('父级重渲染一次:value / t / tList / setLocale 引用不变,依赖 t 与依赖 value 的 effect 都不重跑', async () => {
    const { rerender } = await mount()
    await rerender()

    // 判据①:重渲染确实传导到了订阅者(枚举到 0/1 个样本 ⇒ 下面两条是空的)
    expect(seenContexts.length).toBeGreaterThanOrEqual(2)

    const first = seenAt(0)
    const last = lastSeen()

    // 判据②:四条身份逐一钉住(缺陷形态下第一锤就红:value 是渲染期新建的字面量)
    expect(last, 'context value 必须跨渲染同身份(母型缺陷:Provider 内联 value 字面量)').toBe(first)
    expect(last.t, 't 身份漂移 ⇒ 任何把 t 写进 effect 依赖的页面都会重跑').toBe(first.t)
    expect(last.tList).toBe(first.tList)
    expect(last.setLocale).toBe(first.setLocale)

    // 判据②之果:两条 effect 都只跑挂载那一次,不跟着渲染次数走
    expect(tDependentEffectRuns, '依赖 t 的 effect 不得随父级重渲染重跑').toBe(1)
    expect(valueDependentEffectRuns, '依赖整个 value 的 effect 不得随父级重渲染重跑').toBe(1)
  })

  it('切语言不是冻词典:locale 变化必须真的换词典、换 t/tList 身份,并让 effect 重跑', async () => {
    // 前提:两语言文案确实不同,否则"切换生效"无从观察(不满足就是判据失效,当场点名)
    expect(typeof ZH_TEXT).toBe('string')
    expect(typeof EN_TEXT).toBe('string')
    expect(EN_TEXT).not.toBe(ZH_TEXT)

    // en 包预置进 storage:readCachedPack 同步命中 ⇒ 切 en 后词典真的换(而不是回落中文)
    T.storage.set(EN_PACK_STORAGE_KEY, EN_PAYLOAD)

    const { rerender } = await mount()
    const first = seenAt(0)
    expect(first.locale).toBe('zh-CN')
    expect(first.t(KEY)).toBe(ZH_TEXT)

    await act(async () => {
      first.setLocale('en')
    })
    await rerender()

    const last = lastSeen()
    // 取词真的换成 en(不是回落 zh-CN,也不是把中文冻在 memo 里)
    expect(last.t(KEY)).toBe(EN_TEXT)
    expect(last.locale).toBe('en')
    // 词典换了 ⇒ t/tList 的身份**必须**变;恒等就是过度 memo(语言切不动)
    expect(last.t).not.toBe(first.t)
    expect(last.tList).not.toBe(first.tList)
    // 且消费方两条 effect 都必须感知到这一次真实变化
    expect(tDependentEffectRuns).toBe(2)
    expect(valueDependentEffectRuns).toBe(2)
    // 词典来自 storage 同步命中,整轮不得打网络(判据③不靠 CDN)
    expect(T.requestCalls).toEqual([])
    // 切换也真的落盘了(真机冷启靠它恢复语言)
    expect(T.storage.get(LOCALE_KEY)).toBe('en')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
