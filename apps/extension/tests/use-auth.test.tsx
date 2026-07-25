// @vitest-environment node
/**
 * useAuth 跨端共享 hook 集成测试 — extension 端
 *
 * 验证 @ihui/shared/hooks/useAuth + @ihui/shared/auth/createInMemoryTokenStore
 * 在 extension 端消费的真实可用性,以及 extension 端真实 tokenStore(lib/token.ts)
 * 与 useAuth hook 的组合契约。
 *
 * 覆盖场景(1-15 与 mobile-rn 模板一致;16 为 extension 端特色):
 * 1.  挂载后 ready=true,初始 token=null,isAuthenticated=false
 * 2.  autoBind=true 时挂载后调用 bindTransport(store)
 * 3.  autoBind=false 时不调 bindTransport,ready 仍变 true
 * 4.  login 传 newUser:写 token + setUser,不调 fetchProfile
 * 5.  login 不传 newUser:写 token + 调 fetchProfile 拉取 user
 * 6.  login 不传 newUser 且 fetchProfile 失败:user 保持 null,token 仍写入
 * 7.  login 不传 refreshToken:不调 setRefreshToken,refreshToken 保持 null
 * 8.  logout:调 logoutApi(refreshToken) + clearAll + 清 user
 * 9.  logoutApi 抛异常:本地清理仍执行,token/user 都清空
 * 10. logout 无 refreshToken:不调 logoutApi
 * 11. logout 不传 logoutApi:跳过后端调用,直接清本地
 * 12. refresh 默认实现返回 false
 * 13. setUser:直接更新 user state
 * 14. store 已有 initial token:hook 读取到 isAuthenticated=true
 * 15. login + logout + login 序列:状态正确转换
 * 16. extension 端真实 tokenStore(lib/token.ts)+ chrome.storage.local mock,
 *     验证真实 store 与 useAuth 的 login/logout/chrome.storage 组合契约
 *
 * 测试策略说明:
 * - extension 端 vitest 默认 environment=node,且未安装 jsdom / @testing-library/react
 *   (pnpm isolated + 未声明 devDependency)。本文件自包含:提供最小 DOM shim +
 *   renderHook/act/waitFor,仅依赖 react + react-dom(已安装),真实挂载 React
 *   组件跑 useEffect/useState,忠实于"集成测试"语义。
 * - 场景 1-15 用 createInMemoryTokenStore 作为 mock store(与 mobile-rn 一致)。
 * - 场景 16 用 extension 端真实 tokenStore(从 lib/token 导入)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useAuth } from '@ihui/shared/hooks'
import { createInMemoryTokenStore } from '@ihui/shared/auth'
import type { TokenStore } from '@ihui/shared/auth'
import { tokenStore as extTokenStore, clearAllTokens as extClearAllTokens } from '../lib/token'

// === Mock @ihui/api-client(lib/token.ts 静态导入;token-store.ts 也导入,均无真实副作用)===
vi.mock('@ihui/api-client', () => ({
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

// === Mock ../lib/token-utils(clearAllTokens 动态 import stopAutoRefresh;避免真实 alarm 副作用)===
vi.mock('../lib/token-utils', () => ({
  stopAutoRefresh: vi.fn(),
  startAutoRefresh: vi.fn(),
  doRefresh: vi.fn(async () => false),
  scheduleRefreshAlarm: vi.fn(),
  readExp: vi.fn(() => null),
  REFRESH_ALARM_NAME: 'ihui-refresh-token',
}))

// === 最小 DOM shim ===
// extension 端无 jsdom;react-dom/client 的 createRoot 需要一个 DOM container 与
// document/window 全局。本 shim 提供 Element/Text/Document/DocumentFragment 的最小实现,
// 足以让 createRoot 挂载一个返回 null 的测试 Harness 并跑通 useEffect/useState。
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
      c.previousSibling = i > 0 ? this.childNodes[i - 1] : null
      c.nextSibling = i < this.childNodes.length - 1 ? this.childNodes[i + 1] : null
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
  classList = { add() {}, remove() {}, contains() { return false } }
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
    return name in this.attributes ? this.attributes[name] : null
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
  // react-dom 19 getActiveElementDeep 做 `element instanceof containerInfo.HTMLIFrameElement`,
  // 若 HTMLIFrameElement 缺失会抛 "Right-hand side of 'instanceof' is not an object"。
  // 提供一个空 class 让 instanceof 返回 false 即可。
  HTMLIFrameElement = class HTMLIFrameElement {}
  HTMLInputElement = ShimElement
  HTMLTextAreaElement = ShimElement
  HTMLSelectElement = ShimElement
  HTMLElement = ShimElement
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
    return { getPropertyValue() { return '' } }
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
defineGlobal('MutationObserver', class MutationObserverShim {
  observe(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] {
    return []
  }
})
defineGlobal('IS_REACT_ACT_ENVIRONMENT', true)

// === renderHook / act / waitFor 自包含实现(仅依赖 react + react-dom)===
const roots: Root[] = []

async function renderHook<T>(hookFn: () => T): Promise<{
  result: { current: T }
  rerender: () => Promise<void>
  unmount: () => Promise<void>
}> {
  const result: { current: T } = { current: undefined as unknown as T }
  function Harness(): null {
    result.current = hookFn()
    return null
  }
  const container = shimDoc.createElement('div')
  const root = createRoot(container as unknown as HTMLElement)
  roots.push(root)
  await act(async () => {
    root.render(createElement(Harness))
  })
  return {
    result,
    rerender: async () => {
      await act(async () => {
        root.render(createElement(Harness))
      })
    },
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
    },
  }
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

// === chrome.storage.local mock(场景 16 用真实 tokenStore,依赖 chrome.storage)===
const chromeStorage: Record<string, unknown> = {}
const chromeStorageLocalGet = vi.fn(async (keys: string | string[]) => {
  const keyArr = Array.isArray(keys) ? keys : [keys]
  const result: Record<string, unknown> = {}
  for (const k of keyArr) if (k in chromeStorage) result[k] = chromeStorage[k]
  return result
})
const chromeStorageLocalSet = vi.fn(async (obj: Record<string, unknown>) => {
  Object.assign(chromeStorage, obj)
})
const chromeStorageLocalRemove = vi.fn(async (keys: string | string[]) => {
  const keyArr = Array.isArray(keys) ? keys : [keys]
  for (const k of keyArr) delete chromeStorage[k]
})
defineGlobal('chrome', {
  storage: {
    local: {
      get: chromeStorageLocalGet,
      set: chromeStorageLocalSet,
      remove: chromeStorageLocalRemove,
      onChanged: { addListener: vi.fn() },
    },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(async () => true),
    onAlarm: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: { onInstalled: { addListener: vi.fn() } },
})

// === mock user 类型 ===
interface TestUser {
  id: string
  nickname: string
}
const mockUser: TestUser = { id: 'u-1', nickname: 'tester' }

describe('useAuth 跨端共享 hook — extension 端集成测试', () => {
  let store: TokenStore
  let bindTransport: ReturnType<typeof vi.fn>
  let fetchProfile: ReturnType<typeof vi.fn>
  let logoutApi: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = createInMemoryTokenStore()
    bindTransport = vi.fn()
    fetchProfile = vi.fn()
    logoutApi = vi.fn()
  })

  afterEach(async () => {
    while (roots.length) {
      const r = roots.pop() as Root
      await act(async () => {
        r.unmount()
      })
    }
  })

  it('1. 挂载后 ready=true,初始 token 为 null,isAuthenticated=false', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.token).toBeNull()
    expect(result.current.refreshToken).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('2. autoBind=true 时挂载后调用 bindTransport(store)', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi, autoBind: true }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(bindTransport).toHaveBeenCalledTimes(1)
    expect(bindTransport).toHaveBeenCalledWith(store)
  })

  it('3. autoBind=false 时不调 bindTransport,ready 仍变 true', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi, autoBind: false }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(bindTransport).not.toHaveBeenCalled()
  })

  it('4. login 传 newUser 时:写 token + setUser,不调 fetchProfile', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.login('at-001', 'rt-001', mockUser)
    })
    expect(store.getToken()).toBe('at-001')
    expect(store.getRefreshToken()).toBe('rt-001')
    expect(result.current.token).toBe('at-001')
    expect(result.current.refreshToken).toBe('rt-001')
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
    expect(fetchProfile).not.toHaveBeenCalled()
  })

  it('5. login 不传 newUser 时:写 token + 调 fetchProfile 拉取 user', async () => {
    fetchProfile.mockResolvedValue({ success: true, data: mockUser })
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.login('at-002', 'rt-002')
    })
    expect(store.getToken()).toBe('at-002')
    expect(fetchProfile).toHaveBeenCalledTimes(1)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('6. login 不传 newUser 且 fetchProfile 失败时:user 保持 null,token 仍写入', async () => {
    fetchProfile.mockResolvedValue({ success: false, error: 'profile fetch failed' })
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.login('at-003')
    })
    expect(store.getToken()).toBe('at-003')
    expect(fetchProfile).toHaveBeenCalledTimes(1)
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('7. login 不传 refreshToken 时:不调 setRefreshToken,refreshToken 保持 null', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.login('at-004', undefined, mockUser)
    })
    expect(store.getToken()).toBe('at-004')
    expect(store.getRefreshToken()).toBeNull()
    expect(result.current.token).toBe('at-004')
    expect(result.current.refreshToken).toBeNull()
  })

  it('8. logout:调 logoutApi(refreshToken) + clearAll + 清 user', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.login('at-005', 'rt-005', mockUser)
    })
    expect(result.current.isAuthenticated).toBe(true)
    await act(async () => {
      await result.current.logout()
    })
    expect(logoutApi).toHaveBeenCalledTimes(1)
    expect(logoutApi).toHaveBeenCalledWith('rt-005')
    expect(store.getToken()).toBeNull()
    expect(store.getRefreshToken()).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('9. logoutApi 抛异常:本地清理仍执行,token/user 都清空', async () => {
    logoutApi.mockRejectedValue(new Error('network error'))
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.login('at-006', 'rt-006', mockUser)
    })
    await act(async () => {
      await result.current.logout()
    })
    expect(logoutApi).toHaveBeenCalledTimes(1)
    expect(store.getToken()).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('10. logout 无 refreshToken 时:不调 logoutApi', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.login('at-007', undefined, mockUser)
    })
    await act(async () => {
      await result.current.logout()
    })
    expect(logoutApi).not.toHaveBeenCalled()
    expect(store.getToken()).toBeNull()
    expect(result.current.user).toBeNull()
  })

  it('11. logout 不传 logoutApi 时:跳过后端调用,直接清本地', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile }), // 不传 logoutApi
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.login('at-008', 'rt-008', mockUser)
    })
    await act(async () => {
      await result.current.logout()
    })
    expect(store.getToken()).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('12. refresh 默认实现返回 false', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    let refreshResult: boolean | undefined
    await act(async () => {
      refreshResult = await result.current.refresh()
    })
    expect(refreshResult).toBe(false)
  })

  it('13. setUser:直接更新 user state', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.user).toBeNull()
    await act(async () => {
      result.current.setUser(mockUser)
    })
    expect(result.current.user).toEqual(mockUser)
    await act(async () => {
      result.current.setUser(null)
    })
    expect(result.current.user).toBeNull()
  })

  it('14. store 已有 initial token 时:hook 读取到 isAuthenticated=true', async () => {
    store = createInMemoryTokenStore({
      initial: { token: 'preloaded-at', refreshToken: 'preloaded-rt' },
    })
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.token).toBe('preloaded-at')
    expect(result.current.refreshToken).toBe('preloaded-rt')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('15. login + logout + login 序列:状态正确转换', async () => {
    const { result } = await renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.login('at-1', 'rt-1', mockUser)
    })
    expect(result.current.token).toBe('at-1')
    expect(result.current.user).toEqual(mockUser)
    await act(async () => {
      await result.current.logout()
    })
    expect(result.current.token).toBeNull()
    expect(result.current.user).toBeNull()
    await act(async () => {
      await result.current.login('at-2', 'rt-2', { id: 'u-2', nickname: 'tester2' })
    })
    expect(result.current.token).toBe('at-2')
    expect(result.current.refreshToken).toBe('rt-2')
    expect(result.current.user).toEqual({ id: 'u-2', nickname: 'tester2' })
  })

  describe('16. extension 端真实 tokenStore 组合契约', () => {
    beforeEach(async () => {
      // 重置 chrome.storage.local 缓存 + mock 调用记录
      for (const k of Object.keys(chromeStorage)) delete chromeStorage[k]
      chromeStorageLocalGet.mockClear()
      chromeStorageLocalSet.mockClear()
      chromeStorageLocalRemove.mockClear()
      // 重置 lib/token 模块级 cachedToken/cachedRefreshToken
      await extClearAllTokens()
    })

    it('login/logout 与 chrome.storage.local 的组合契约', async () => {
      const { result } = await renderHook(() =>
        useAuth<TestUser>({ store: extTokenStore, bindTransport, fetchProfile, logoutApi }),
      )
      await waitFor(() => expect(result.current.ready).toBe(true))

      // login:写 chrome.storage.local + 更新 cachedToken,hook 同步读取
      await act(async () => {
        await result.current.login('ext-at', 'ext-rt', mockUser)
      })
      expect(result.current.token).toBe('ext-at')
      expect(result.current.refreshToken).toBe('ext-rt')
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(mockUser)
      expect(chromeStorageLocalSet).toHaveBeenCalled()
      expect(chromeStorage['ihui_token']).toBe('ext-at')
      expect(chromeStorage['ihui_refresh_token']).toBe('ext-rt')

      // logout:清 chrome.storage.local + 缓存,hook 读取 isAuthenticated=false
      await act(async () => {
        await result.current.logout()
      })
      expect(result.current.token).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(chromeStorage['ihui_token']).toBeUndefined()
    })
  })
})
