// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ext_ui 执行器 + 转发层单元测试(2026-09-21 立)。
 *
 * vitest environment=node(见 vitest.config.ts),无 jsdom —— 按 tests/agent-control.test.ts
 * 的做法自建最小 document mock。ui-action-registry.ts 的 DOM 访问全部走结构化 duck
 * typing(无 instanceof HTMLInputElement),保证 mock 与真实 sidepanel 行为一致。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { executeExtUiAction, isAllowedExtUiRoute, EXT_UI_COMMANDS } from '../lib/ui-action-registry'
import {
  dispatchAgentActionRequest,
  forwardExtUiToSidepanel,
  isExtUiRequest,
  EXT_UI_FORWARD_MESSAGE_TYPE,
} from '../lib/ext-ui-forwarder'
import { EXT_UI_CONTROL_TOOLS } from '../lib/ui-control-tools'
import { EXT_UI_ROUTES } from '../lib/ext-ui-routes.generated'
import { PENDING_ROUTE_STORAGE_KEY } from '@ihui/shared/constants'
import type { AgentActionRequest } from '@ihui/types'

// ===== 最小 document mock =====

interface FakeElement {
  tagName: string
  attrs: Record<string, string>
  textContent: string
  value?: string
  checked?: boolean
  disabled?: boolean
  type?: string
  options?: { value: string; text: string }[]
  isConnected: boolean
  events: string[]
  clicks: number
  getAttribute(name: string): string | null
  click(): void
  dispatchEvent(event: { type?: string }): boolean
}

function makeEl(overrides: Partial<FakeElement> & { tagName: string }): FakeElement {
  const el: FakeElement = {
    attrs: {},
    textContent: '',
    isConnected: true,
    events: [],
    clicks: 0,
    getAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name]! : null
    },
    click() {
      this.clicks++
    },
    dispatchEvent(event: { type?: string }) {
      this.events.push(event?.type ?? '')
      return true
    },
    ...overrides,
  }
  return el
}

interface FakeDoc {
  title: string
  body: { innerText?: string; textContent?: string } | null
  elements: FakeElement[]
  forms: FakeElement[]
  querySelectorAll(selector: string): FakeElement[]
  querySelector(selector: string): FakeElement | null
}

function makeDoc(
  parts: { elements?: FakeElement[]; forms?: FakeElement[]; title?: string } = {},
): FakeDoc {
  return {
    title: parts.title ?? '智汇AI 侧边栏',
    body: { innerText: '面板正文内容' },
    elements: parts.elements ?? [],
    forms: parts.forms ?? [],
    querySelectorAll(selector: string) {
      if (selector === 'form') return [...this.forms]
      return [...this.elements]
    },
    querySelector(selector: string) {
      // 支持 '#id' 形式(敏感字段被 collectInteractive 剔除,只能经 CSS 选择器定位 —— 与真实行为一致)
      if (selector.startsWith('#')) {
        const id = selector.slice(1)
        return [...this.elements, ...this.forms].find((el) => el.attrs['id'] === id) ?? null
      }
      return null
    },
  }
}

function setDocument(doc: FakeDoc | null): void {
  ;(globalThis as unknown as { document: unknown }).document = doc
}

function setChrome(chrome: unknown): void {
  ;(globalThis as unknown as { chrome: unknown }).chrome = chrome
}

/** 执行 describe 并断言 ok,返回 registry */
async function describeRegistry(): Promise<Record<string, unknown>> {
  const res = await executeExtUiAction('describe', {})
  expect(res.ok).toBe(true)
  return res.data?.registry as Record<string, unknown>
}

function makeExtUiRequest(overrides: Partial<AgentActionRequest>): AgentActionRequest {
  return {
    requestId: 'req-1',
    category: 'ext_ui',
    action: 'describe',
    params: {},
    ...overrides,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  setDocument(null)
  setChrome(undefined)
  delete (globalThis as unknown as { HTMLInputElement?: unknown }).HTMLInputElement
  delete (globalThis as unknown as { location?: unknown }).location
})

afterEach(() => {
  setDocument(null)
  setChrome(undefined)
})

// ===== 七动词:describe =====

describe('ext_ui describe', () => {
  it('采集注入的假 DOM 元素,含 kind/label/writable/pressable', async () => {
    const input = makeEl({ tagName: 'INPUT', attrs: { placeholder: '搜索' }, value: '' })
    const button = makeEl({ tagName: 'BUTTON', textContent: '发送' })
    const link = makeEl({ tagName: 'A', textContent: '帮助' })
    setDocument(makeDoc({ elements: [input, button, link] }))

    const registry = await describeRegistry()
    const elements = registry.elements as Array<Record<string, unknown>>
    expect(elements).toHaveLength(3)
    expect(elements.map((e) => e.kind)).toEqual(['input', 'button', 'link'])
    expect(elements.map((e) => e.label)).toEqual(['搜索', '发送', '帮助'])
    const byLabel = Object.fromEntries(elements.map((e) => [e.label, e]))
    expect(byLabel['搜索']).toMatchObject({ writable: true, pressable: false })
    expect(byLabel['发送']).toMatchObject({ writable: false, pressable: true })
  })

  it('同一会话内元素 id 稳定(两次 describe 同节点同 id)', async () => {
    const button = makeEl({ tagName: 'BUTTON', textContent: '发送' })
    setDocument(makeDoc({ elements: [button] }))
    const r1 = await describeRegistry()
    const r2 = await describeRegistry()
    const id1 = (r1.elements as Array<Record<string, unknown>>)[0]?.id
    const id2 = (r2.elements as Array<Record<string, unknown>>)[0]?.id
    expect(id1).toBe(id2)
    expect(String(id1)).toMatch(/^el:button#\d+$/)
  })

  it('敏感字段(密码)不入 elements 且计入 suppressed', async () => {
    const pwd = makeEl({ tagName: 'INPUT', attrs: { type: 'password', name: 'pwd' } })
    const normal = makeEl({ tagName: 'INPUT', attrs: { name: 'nickname' }, value: '' })
    setDocument(makeDoc({ elements: [pwd, normal] }))
    const registry = await describeRegistry()
    const elements = registry.elements as Array<Record<string, unknown>>
    expect(elements).toHaveLength(1)
    expect(elements[0]?.label).toBe('nickname')
    expect(registry.suppressed).toBe(1)
  })

  it('元素超过 60 条上限时截断并记 suppressed', async () => {
    const many = Array.from({ length: 65 }, (_, i) =>
      makeEl({ tagName: 'BUTTON', textContent: `按钮${i}` }),
    )
    setDocument(makeDoc({ elements: many }))
    const registry = await describeRegistry()
    expect(registry.elements as unknown[]).toHaveLength(60)
    expect(registry.suppressed).toBe(5)
  })
})

// ===== 七动词:fill =====

describe('ext_ui fill', () => {
  it('input 走原型原生 value setter 且派发 input/change 事件', async () => {
    const setterCalls: string[] = []
    const store = new WeakMap<object, string>()
    class FakeInputProto {}
    Object.defineProperty(FakeInputProto.prototype, 'value', {
      set(this: object, v: string) {
        setterCalls.push(v)
        store.set(this, v)
      },
      get(this: object) {
        return store.get(this) ?? ''
      },
      configurable: true,
    })
    ;(globalThis as unknown as { HTMLInputElement: unknown }).HTMLInputElement = {
      prototype: FakeInputProto.prototype,
    }

    const input = makeEl({ tagName: 'INPUT', attrs: { name: 'nickname' } })
    // mock 元素挂上带 value 访问器的原型,模拟真实 DOM 的 HTMLInputElement 原型链
    Object.setPrototypeOf(input, FakeInputProto.prototype)
    setDocument(makeDoc({ elements: [input] }))
    const res = await executeExtUiAction('fill', { target: 'nickname', value: '小明' })
    expect(res.ok).toBe(true)
    expect(setterCalls).toEqual(['小明'])
    expect(input.value).toBe('小明')
    expect(input.events).toEqual(['input', 'change'])
  })

  it('密码字段拒填 PERMISSION_DENIED', async () => {
    const pwd = makeEl({ tagName: 'INPUT', attrs: { type: 'password', id: 'pwd' } })
    setDocument(makeDoc({ elements: [pwd] }))
    // 敏感字段被 collectInteractive 剔除,模型只能经 CSS 选择器(或旧 id)触达 —— 照样拒
    const res = await executeExtUiAction('fill', { target: '#pwd', value: 'x' })
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('PERMISSION_DENIED')
    expect(pwd.value).toBeUndefined()
    expect(pwd.events).toHaveLength(0)
  })

  it('目标不存在回 SELECTOR_NOT_FOUND', async () => {
    setDocument(makeDoc({ elements: [] }))
    const res = await executeExtUiAction('fill', { target: '不存在', value: 'x' })
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('SELECTOR_NOT_FOUND')
  })
})

// ===== 七动词:click =====

describe('ext_ui click', () => {
  it('普通按钮点击成功', async () => {
    const button = makeEl({ tagName: 'BUTTON', textContent: '设置' })
    setDocument(makeDoc({ elements: [button] }))
    const res = await executeExtUiAction('click', { target: '设置' })
    expect(res.ok).toBe(true)
    expect(button.clicks).toBe(1)
  })

  it('删除类目标 DESTRUCTIVE_BLOCKED 且不点击', async () => {
    const button = makeEl({ tagName: 'BUTTON', textContent: '删除记录' })
    setDocument(makeDoc({ elements: [button] }))
    const res = await executeExtUiAction('click', { target: '删除记录' })
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('DESTRUCTIVE_BLOCKED')
    expect(button.clicks).toBe(0)
  })

  it('disabled 目标 EXECUTION_FAILED', async () => {
    const button = makeEl({ tagName: 'BUTTON', textContent: '提交', disabled: true })
    setDocument(makeDoc({ elements: [button] }))
    const res = await executeExtUiAction('click', { target: '提交' })
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('EXECUTION_FAILED')
  })
})

// ===== 七动词:navigate =====

describe('ext_ui navigate', () => {
  it('白名单外路由拒绝 ROUTE_NOT_ALLOWED(不需要 chrome)', async () => {
    const res = await executeExtUiAction('navigate', { path: '/not-exist/page' })
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('ROUTE_NOT_ALLOWED')
    expect(isAllowedExtUiRoute('/me/wallet').ok).toBe(true)
    expect(isAllowedExtUiRoute('/ai/agents/abc').ok).toBe(true) // :id 参数路由
    expect(isAllowedExtUiRoute('javascript:alert(1)').ok).toBe(false)
  })

  it('白名单内路由经 chrome.storage.session pending route 通道执行', async () => {
    const sessionSet = vi.fn().mockResolvedValue(undefined)
    setChrome({ storage: { session: { set: sessionSet } } })
    const res = await executeExtUiAction('navigate', { path: '/chat/history' })
    expect(res.ok).toBe(true)
    expect(sessionSet).toHaveBeenCalledWith({ [PENDING_ROUTE_STORAGE_KEY]: '/chat/history' })
  })

  it('白名单 = SidepanelApp 路由表清点(50 条,含 5 条兼容重定向)', () => {
    expect(EXT_UI_ROUTES).toHaveLength(50)
    expect(EXT_UI_ROUTES).toContain('/chat')
    expect(EXT_UI_ROUTES).toContain('/ai/agents/:id')
    expect(EXT_UI_ROUTES).not.toContain('*')
  })
})

// ===== 七动词:read / invoke =====

describe('ext_ui read / invoke', () => {
  it('read 返回 page/正文截断/表单当前值', async () => {
    ;(globalThis as unknown as { location: unknown }).location = {
      pathname: '/chat',
      href: 'chrome-extension://abc/index.html#/chat',
    }
    const input = makeEl({ tagName: 'INPUT', attrs: { name: 'nickname' }, value: '小明' })
    setDocument(makeDoc({ elements: [input], title: '智汇AI' }))
    const res = await executeExtUiAction('read', {})
    expect(res.ok).toBe(true)
    const data = res.data as {
      page: Record<string, string>
      text: string
      values: Record<string, string>
    }
    expect(data.page).toMatchObject({ path: '/chat', title: '智汇AI' })
    expect(data.text).toBe('面板正文内容')
    expect(data.values['nickname']).toBe('小明')
  })

  it('invoke 未登记命令回 UNSUPPORTED_ACTION(不伪造)', async () => {
    expect(EXT_UI_COMMANDS).toHaveLength(0)
    const res = await executeExtUiAction('invoke', { name: 'open-settings' })
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
  })

  it('未知动词回 UNSUPPORTED_ACTION', async () => {
    const res = await executeExtUiAction('unknown' as never, {})
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
  })
})

// ===== background 转发层:sidepanel 未打开 → TARGET_NOT_CONNECTED =====

describe('ext_ui forwarder (background 转发层)', () => {
  it('isExtUiRequest 按 category 判定', () => {
    expect(isExtUiRequest(makeExtUiRequest({}))).toBe(true)
    expect(isExtUiRequest(makeExtUiRequest({ category: 'browser' }))).toBe(false)
    expect(isExtUiRequest(null)).toBe(false)
  })

  it('sidepanel 未打开(sendMessage reject)回 TARGET_NOT_CONNECTED', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('Could not establish connection'))
    setChrome({ runtime: { sendMessage } })
    const result = await forwardExtUiToSidepanel(makeExtUiRequest({}), 500)
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('TARGET_NOT_CONNECTED')
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: EXT_UI_FORWARD_MESSAGE_TYPE }),
    )
  })

  it('sendMessage 无监听者返回 undefined → EXECUTION_FAILED', async () => {
    setChrome({ runtime: { sendMessage: vi.fn().mockResolvedValue(undefined) } })
    const result = await forwardExtUiToSidepanel(makeExtUiRequest({}), 500)
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('EXECUTION_FAILED')
  })

  it('chrome.runtime 不可用 → TARGET_NOT_CONNECTED', async () => {
    setChrome(undefined)
    const result = await forwardExtUiToSidepanel(makeExtUiRequest({}), 500)
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('TARGET_NOT_CONNECTED')
  })

  it('sidepanel 正常回执时透传结果,dispatch 包装为 AgentActionResponse', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true, data: { clicked: '发送' } })
    setChrome({ runtime: { sendMessage } })
    const res = await dispatchAgentActionRequest(
      makeExtUiRequest({ action: 'click', params: { target: '发送' } }),
    )
    expect(res.requestId).toBe('req-1')
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ clicked: '发送' })
    expect(res.executedBy).toBe('extension')
    expect(res.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('非 ext_ui category 走既有 browser 执行器(未知 action → UNSUPPORTED_ACTION)', async () => {
    const res = await dispatchAgentActionRequest(
      makeExtUiRequest({ category: 'browser', action: 'not-a-browser-action' as never }),
    )
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
  })

  it('契约清单七项工具名完整(与 ai-service 注册面双向对照的端内侧)', () => {
    expect(EXT_UI_CONTROL_TOOLS).toEqual([
      'ext_ui_describe',
      'ext_ui_read',
      'ext_ui_navigate',
      'ext_ui_invoke',
      'ext_ui_click',
      'ext_ui_fill',
      'ext_ui_submit',
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
