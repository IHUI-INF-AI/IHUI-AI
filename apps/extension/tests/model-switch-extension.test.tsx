// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

/**
 * 票 68 / G-53 扩展腿:「流式中切换模型 → 终止」。
 *
 * 机主定档(2026-10-21):本端票面只取「换档 ⇒ 终止在途流」这一半。终止后**不**自动用新模型重发
 * 这一轮(那是 web/RN 的 resolveRoundModel 语义,本端不接),下一条消息自然走新档位。
 * 故这里钉的是"终止这个动作真的发生了 / 没有终止时一个副作用都不许多做",不是"payload 跟到新档"。
 *
 * 四组判据,每组都对应一个「容易悄悄坏掉」的点:
 *  ① 流式中换档 ⇒ 真的 abort 了交给 streamChat 的那条 signal(副作用可观测),在途旗回收、
 *     理由上屏、且**不**弹错误条(主动取消不是请求失败)。
 *  ② 反例:流式中但没换档 ⇒ 一个副作用都不许多做(signal 未 aborted、无提示、无第二次请求)。
 *  ③ await 窗内换档 ⇒ 终止那一轮,且不得抢发新请求(请求要么还没发出,发出也必须带已 aborted 的 signal);
 *     另:根本没有在途流时换档 ⇒ 零副作用(不该打扰用户)。
 *  ④ 装车证明(源级反查):ChatPage 必须真接上判据、必须摘掉 `disabled={streaming}`、
 *     且**不得**接 `resolveRoundModel`(接了就是"静默跟到新档",与定档的终止语义冲突)。
 *
 * 判据实现一律 import 端内腿(`src/lib/model-switch`),测试里不复制第二份(AGENTS §22c)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { LlmModel } from '@ihui/api-client'

const { streamChat, fetchModels, createConversation, persistMessage, realIsAbortError } =
  vi.hoisted(() => ({
    streamChat: vi.fn(),
    fetchModels: vi.fn(),
    createConversation: vi.fn(),
    persistMessage: vi.fn(),
    /** 真 isAbortError 由 importActual 注入;测试自己不再判一次 name */
    realIsAbortError: {
      fn: (err: unknown): boolean => err instanceof Error && err.name === 'AbortError',
    },
  }))

// 只接管"会真发请求/真读远端"的四条出口;isAbortError / formatSSEError / getModelContextCapacity
// 用真实现(判据复制禁令 §22c,且本组用例要的正是"真 AbortError 走真判据")。
vi.mock('@ihui/api-client', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@ihui/api-client')
  realIsAbortError.fn = actual.isAbortError as (err: unknown) => boolean
  return {
    ...actual,
    streamChat,
    fetchModels,
    createConversation,
    sendMessage: persistMessage,
  }
})

// 真词表 oracle:与端内 src/i18n 完全同一条 mergeMessages + translate 链
// (queue-bar-ext.test.tsx 同口径)—— 取不到键时屏幕上就是原始键名,这条用例必须当场变红。
vi.mock('../src/i18n', async () => {
  const { mergeMessages, translate } = await import('@ihui/i18n/loader')
  type Messages = Record<string, unknown>
  const shared = (await import('@ihui/i18n/messages/shared/zh-CN.json'))
    .default as unknown as Messages
  const ext = (await import('@ihui/i18n/messages/extension/zh-CN.json'))
    .default as unknown as Messages
  const messages = mergeMessages(shared, ext)
  return {
    useI18n: () => ({
      t: (key: string, params?: Record<string, string | number>) =>
        translate(messages, key, { fallback: messages, params }),
      locale: 'zh-CN' as const,
      setLocale: () => {},
    }),
  }
})

vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({ onLogout: () => {} }),
}))

// 侧栏其余挂件与执行面不参与本票判据,桩掉以免把 mock 面写大(它们各自另有专项用例)
vi.mock('../entrypoints/sidepanel/components/WorkspacePicker', () => ({
  WorkspacePicker: () => null,
}))
vi.mock('../entrypoints/sidepanel/components/ToolApprovalBanner', () => ({
  ToolApprovalBanner: () => null,
}))
vi.mock('../entrypoints/sidepanel/components/VoiceInput', () => ({ VoiceInput: () => null }))
vi.mock('../entrypoints/sidepanel/components/MessageContent', () => ({
  MessageContent: () => null,
}))
vi.mock('../entrypoints/sidepanel/components/QueueBar', () => ({ default: () => null }))
vi.mock('../entrypoints/sidepanel/components/TaskStatusBar', () => ({ TaskStatusBar: () => null }))
vi.mock('../lib/ui-control-tools', () => ({ toolsForChatRequest: () => [] }))
vi.mock('../lib/workspace-store', () => ({ getActiveWorkspace: () => null }))
vi.mock('@ihui/shared/chat/workspace-context-loader', () => ({
  loadWorkspaceContextCached: async () => undefined,
}))
vi.mock('@ihui/shared/chat/workspace-tool-executor', () => ({
  executeWorkspaceTool: async () => ({}),
}))

import ChatPage from '../entrypoints/sidepanel/pages/ChatPage'
import {
  resolveRoundModel,
  shouldTerminateForModelSwitch,
  terminateActiveStream,
} from '../src/lib/model-switch'

const MODEL_A = 'ihui-test-model-a'
const MODEL_B = 'ihui-test-model-b'
/** 本端终止理由复用的既有键 chat.partialDoneTitle 的真译文(zh-CN) */
const NOTICE_TEXT = '回答被中断,以下内容可能不完整'

function model(id: string): LlmModel {
  return { id, name: id, provider: 'test', context_length: 8192, input_price: 0 }
}

/** 挂起的 streamChat:交出去时若 signal 已 aborted ⇒ 立即按 AbortError 失败(照真 client 的短路) */
const sentRequests: Array<{ model: string; signal: AbortSignal }> = []
const pendingRejects: Array<(err: unknown) => void> = []

function abortError(): Error {
  const err = new Error('Aborted')
  err.name = 'AbortError'
  return err
}

function installHangingStreamChat(): void {
  streamChat.mockImplementation((opts: { model: string; signal: AbortSignal }) => {
    sentRequests.push(opts)
    if (opts.signal.aborted) return Promise.reject(abortError())
    return new Promise((_resolve, reject) => {
      pendingRejects.push(reject)
      opts.signal.addEventListener('abort', () => reject(abortError()))
    })
  })
  fetchModels.mockResolvedValue({ models: [model(MODEL_A), model(MODEL_B)], default: MODEL_A })
  createConversation.mockResolvedValue({
    success: true,
    data: { conversation: { id: 'c-test' } },
  })
  persistMessage.mockResolvedValue({ success: true, data: { message: { id: 'm-test' } } })
}

let container: HTMLDivElement
let root: Root

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

async function mount(): Promise<void> {
  await act(async () => {
    root.render(<ChatPage />)
  })
  await flush() // fetchModels 回填
}

/** React 在实例上覆盖了 value 描述器;顺着原型链取原生 setter,才能让 onChange 真的收到变更 */
function setNativeValue(el: HTMLElement | Element, value: string): void {
  let proto: object | null = Object.getPrototypeOf(el)
  let desc: PropertyDescriptor | undefined
  while (proto && !desc) {
    desc = Object.getOwnPropertyDescriptor(proto, 'value')
    proto = Object.getPrototypeOf(proto)
  }
  const setter = desc?.set
  if (setter) setter.call(el, value)
  else (el as unknown as { value: string }).value = value
}

function selectEl(): HTMLSelectElement {
  const el = container.querySelector('select')
  if (!el) throw new Error('档位 select 未渲染')
  return el as HTMLSelectElement
}

async function switchModel(id: string): Promise<void> {
  const el = selectEl()
  await act(async () => {
    setNativeValue(el, id)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await flush()
}

/** 打字后提交表单(ChatPage 的 onSubmit 里 streaming 为真时是入队,为假时才是发送) */
async function typeAndSubmit(text: string): Promise<void> {
  const input = container.querySelector('input[type="text"]')
  const form = container.querySelector('form')
  if (!input || !form) throw new Error('输入区未渲染')
  await act(async () => {
    setNativeValue(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await flush()
}

/** 让已被 abort 的那轮把 catch 走完(错误条/在途旗的回收都发生在那之后) */
async function settleAbortedRound(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  sentRequests.length = 0
  pendingRejects.length = 0
  installHangingStreamChat()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  // 与 conversation-import-page / use-auth 同口径:不设则 React 19 对 act() 警告
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true })
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

describe('shouldTerminateForModelSwitch — 判据表与四端逐条同值', () => {
  it('模型没变 ⇒ 不终止(挂载首帧与 fetchModels 回填都走这一支)', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: MODEL_A,
        currentModel: MODEL_A,
        hasLiveStream: true,
      }),
    ).toBe(false)
  })

  it('模型变了但没有在途流 ⇒ 不终止(纯换档不该打断,也不该打扰用户)', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: MODEL_A,
        currentModel: MODEL_B,
        hasLiveStream: false,
      }),
    ).toBe(false)
  })

  it('模型变了且有在途流 ⇒ 终止(票面要的那一格)', () => {
    expect(
      shouldTerminateForModelSwitch({
        previousModel: MODEL_A,
        currentModel: MODEL_B,
        hasLiveStream: true,
      }),
    ).toBe(true)
  })
})

describe('terminateActiveStream — 终止动作只允许有一份实现', () => {
  it('没有控制器 ⇒ false,且一个出口都不调(不得凭空回收在途旗/凭空出提示)', () => {
    const reclaimed = vi.fn()
    const printed = vi.fn()
    const ok = terminateActiveStream({
      abortRef: { current: null },
      reclaimStreaming: reclaimed,
      notice: NOTICE_TEXT,
      showNotice: printed,
    })
    expect(ok).toBe(false)
    expect(reclaimed).not.toHaveBeenCalled()
    expect(printed).not.toHaveBeenCalled()
  })

  it('有控制器 ⇒ abort + 回收在途旗 + 交出理由,并返回 true', () => {
    const controller = new AbortController()
    const spy = vi.spyOn(controller, 'abort')
    const reclaimed = vi.fn()
    const printed = vi.fn()
    expect(
      terminateActiveStream({
        abortRef: { current: controller },
        reclaimStreaming: reclaimed,
        notice: NOTICE_TEXT,
        showNotice: printed,
      }),
    ).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(reclaimed).toHaveBeenCalledTimes(1)
    expect(printed).toHaveBeenCalledWith(NOTICE_TEXT)
  })

  it('缺省不带 notice ⇒ 静默(用户自己点「停止」那条路径不解释)', () => {
    const printed = vi.fn()
    expect(
      terminateActiveStream({
        abortRef: { current: new AbortController() },
        reclaimStreaming: vi.fn(),
        showNotice: printed,
      }),
    ).toBe(true)
    expect(printed).not.toHaveBeenCalled()
  })

  it('刻意不置空 abortRef:控制器归该流自己的 finally(代际守卫)回收', () => {
    const controller = new AbortController()
    const ref = { current: controller as AbortController | null }
    terminateActiveStream({ abortRef: ref, reclaimStreaming: vi.fn() })
    expect(ref.current).toBe(controller)
  })
})

describe('resolveRoundModel — 四端同值的纯函数(本端不接,见 ChatPage 装车锁)', () => {
  it('最新档非空 ⇒ 跟到新档', () => {
    expect(resolveRoundModel(MODEL_A, MODEL_B)).toBe(MODEL_B)
  })

  it('最新档为空(回填中间态)⇒ 退回入口档,不把空串送进 provider', () => {
    expect(resolveRoundModel(MODEL_A, '')).toBe(MODEL_A)
  })
})

describe('① 流式中换档 ⇒ 真的终止(副作用可观测,不看返回值)', () => {
  it('abort 落在交给 streamChat 的那条 signal 上,在途旗回收、理由上屏、不弹错误条', async () => {
    await mount()
    await typeAndSubmit('第一条')
    expect(streamChat).toHaveBeenCalledTimes(1)
    const inflight = sentRequests[0]
    expect(inflight?.model).toBe(MODEL_A)
    expect(inflight?.signal.aborted).toBe(false)

    await switchModel(MODEL_B)

    // 副作用真发生:那条交出去的 signal 已被 abort(不是只改了 state)
    expect(inflight?.signal.aborted).toBe(true)
    // 理由走本端既有键的真译文,且屏幕上不得出现原始键名(破窗)
    expect(container.textContent).toContain(NOTICE_TEXT)
    expect(container.textContent).not.toContain('chat.partialDoneTitle')
    // 主动取消不是请求失败:错误条与「重试上一条」都不该出现
    await settleAbortedRound()
    expect(container.querySelector('[data-testid="retry-last-turn"]')).toBeNull()
    expect(container.textContent).not.toContain('请求已取消')
    // 新档位就在选择框上 —— 下一条消息自然走它(不靠本轮自动重发)
    expect(selectEl().value).toBe(MODEL_B)
  })

  it('终止后用户再发一条 ⇒ 这一条的请求体走新档位,且终止没有凭空多抢发一次', async () => {
    await mount()
    await typeAndSubmit('第一条')
    await switchModel(MODEL_B)
    await settleAbortedRound()
    expect(streamChat).toHaveBeenCalledTimes(1) // 终止 = 只停,不自动重发

    await typeAndSubmit('第二条')
    expect(streamChat).toHaveBeenCalledTimes(2)
    expect(sentRequests[1]?.model).toBe(MODEL_B)
  })
})

describe('② 反例:未换模型不得误终止', () => {
  it('流式中反复重渲染(打字)⇒ signal 未 aborted、无提示、无第二次请求', async () => {
    await mount()
    await typeAndSubmit('第一条')
    const inflight = sentRequests[0]
    expect(inflight?.signal.aborted).toBe(false)

    for (const text of ['a', 'ab', 'abc']) {
      const input = container.querySelector('input[type="text"]')!
      await act(async () => {
        setNativeValue(input, text)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await flush()
    }

    expect(inflight?.signal.aborted).toBe(false)
    expect(container.textContent).not.toContain(NOTICE_TEXT)
    expect(streamChat).toHaveBeenCalledTimes(1)
  })

  it('挂载首帧与 fetchModels 回填(档位确实变过)⇒ 没有流就不终止、也不出声', async () => {
    // 回填档位刻意与兜底档不同,让"模型变了"这一条真的成立,只剩"有没有在途流"在判
    fetchModels.mockResolvedValue({ models: [model(MODEL_B)], default: MODEL_B })
    await mount()
    expect(selectEl().value).toBe(MODEL_B)
    expect(streamChat).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain(NOTICE_TEXT)
    expect(container.textContent).not.toContain('chat.partialDoneTitle')
  })

  it('空闲时换档 ⇒ 零副作用(纯换档不该打断任何东西,也不该打扰用户)', async () => {
    await mount()
    await switchModel(MODEL_B)
    expect(streamChat).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain(NOTICE_TEXT)
    expect(container.querySelector('[data-testid="retry-last-turn"]')).toBeNull()
  })
})

describe('③ await 窗内换档 ⇒ 终止在途轮,不抢发新请求', () => {
  it('ensureConversation 还没回来时换档:那一轮被终止,且请求带着已 aborted 的 signal 才被交出', async () => {
    let releaseConversation: ((v: unknown) => void) | null = null
    createConversation.mockImplementation(
      () =>
        new Promise((res) => {
          releaseConversation = res
        }),
    )

    await mount()
    const input = container.querySelector('input[type="text"]')!
    await act(async () => {
      setNativeValue(input, '第一条')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // 只把提交这一步放进 act:随后要换档,不能让 act 去 flush 一个仍挂在 await 上的发送
    input.parentElement?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(streamChat).not.toHaveBeenCalled() // 还在 await 窗内

    await switchModel(MODEL_B)
    // 终止确实发生(换档 effect 走的是同一出口:理由上屏 = abort 已被执行过)
    expect(container.textContent).toContain(NOTICE_TEXT)

    await act(async () => {
      releaseConversation?.({ success: true, data: { conversation: { id: 'c-test' } } })
      await Promise.resolve()
      await Promise.resolve()
    })

    // 不得抢发:整场只有一条请求,而且是"已取消"的那一条 —— 真 client 对 aborted signal 有短路,
    // 它不会触达网关;被终止的轮也绝不换成新档位悄悄发出去
    expect(streamChat).toHaveBeenCalledTimes(1)
    expect(sentRequests[0]?.signal.aborted).toBe(true)
    expect(container.querySelector('[data-testid="retry-last-turn"]')).toBeNull()
  })

  it('await 窗内换档时档位选择器必须可点(旧 disabled={streaming} 会让这一切无从发生)', async () => {
    await mount()
    await typeAndSubmit('第一条')
    expect(selectEl().disabled).toBe(false)
  })
})

describe('④ 装车锁(判据在位 ≠ 链路可用;本端定档只取终止)', () => {
  const chatPage = readFileSync(
    resolve(__dirname, '../entrypoints/sidepanel/pages/ChatPage.tsx'),
    'utf8',
  )

  it('ChatPage 必须 import 端内腿并按判据表派发终止', () => {
    expect(chatPage).toContain("from '../../../src/lib/model-switch'")
    expect(chatPage).toContain('shouldTerminateForModelSwitch({')
    expect(chatPage).toContain('terminateActiveStream({')
    expect(chatPage).toContain('hasLiveStream: Boolean(abortRef.current)')
    expect(chatPage).toContain('previousModelRef.current = model')
  })

  it('档位选择器不得再被 streaming 禁用', () => {
    expect(chatPage).not.toMatch(/disabled=\{streaming\}/)
  })

  it('本端**不得**接 resolveRoundModel(接了就是静默跟到新档,与定档的终止语义冲突)', () => {
    expect(chatPage).not.toMatch(/resolveRoundModel\s*\(/)
    // 也不得留 web/RN 那个只为它服务的"最新档" ref
    expect(chatPage).not.toMatch(/modelRef\s*\.\s*current\s*=\s*model/)
  })

  it('终止动作与既有 stop 路径同源:接的是同一个 abortRef,不新建第二条 abort 通道', () => {
    expect(chatPage).toMatch(/terminateActiveStream\(\{\s*\n\s*abortRef,/)
    // 换档 effect 之外不得再多造一份 AbortController 生命周期
    expect(chatPage.match(/new AbortController\(\)/g) ?? []).toHaveLength(1)
  })

  it('主动 abort 不得被演成"请求失败"(中止事实双判:错误形态 ∧ 本地 controller)', () => {
    // 只认错误形态不够 —— `isAbortError` 在有 DOMException 的宿主里要求 instanceof DOMException,
    // 而 `createAbortError()` 的 weapp 兜底与 await 窗内嵌套请求交出来的都是普通 Error + name=AbortError,
    // 那一轮就会被写成「网络连接失败」并附赠一个必然撞同一轮的「重试上一条」(2026-10-21 实测的两条真红)。
    // 因此锁死两条:①中止判据必须同时问 `controller.signal.aborted`;②超时仍必须如实交代。
    expect(chatPage).toMatch(
      /const terminatedLocally = isAbortError\(err\) \|\| controller\.signal\.aborted/,
    )
    expect(chatPage).toMatch(/if \(!terminatedLocally \|\| abortedByTimeout\) \{/)
  })
})

describe('⑤ 反证:真请求失败仍必须出「重试上一条」(防把静默分支扩到真失败上)', () => {
  /** 网络错误 ⇒ 重试按钮出现。两条真失败通道各钉一枚:
   *  ⑴ streamChat 直接 reject(fetch 层网络失败,signal 未被本地 abort);
   *  ⑵ SSE error 帧走 onError(ChatPage 的 :510 那条 setError)—— 换档终止绝不许顺带把这条也哑掉。 */
  it('reject 型网络错误 ⇒ 错误条 + 重试按钮都在,且重试真的把用户原文再发一次', async () => {
    /** 重试按钮的文案就是「重试」(chat.retryMessage),要证的不是文案而是它带的载荷 */
    const sentMessages: Array<Array<{ role: string; content: string }>> = []
    streamChat.mockImplementation(
      async (opts: {
        model: string
        signal: AbortSignal
        messages: Array<{ role: string; content: string }>
      }) => {
        sentRequests.push(opts)
        sentMessages.push(opts.messages)
        throw new TypeError('Failed to fetch')
      },
    )

    await mount()
    await typeAndSubmit('发一条会失败的消息')
    await settleAbortedRound()

    // 失败没被本地中止判据误吞:signal 始终没有被 abort
    expect(sentRequests[0]?.signal.aborted).toBe(false)
    const retry = container.querySelector('[data-testid="retry-last-turn"]')
    expect(retry).not.toBeNull()
    // 错误条如实交代网络失败(不是换档那句理由)
    expect(container.textContent).toContain('网络连接失败')
    expect(container.textContent).not.toContain(NOTICE_TEXT)

    // 正向对照:点「重试」确实带着用户原文重发(证明 retryText 这条链没被我的静默分支拆掉)
    await act(async () => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flush()
    expect(streamChat).toHaveBeenCalledTimes(2)
    expect(sentMessages[1]?.some((m) => m.content === '发一条会失败的消息')).toBe(true)
  })

  it('SSE error 帧(onError 通道)⇒ 重试按钮照旧出现,不受终止静默分支影响', async () => {
    streamChat.mockImplementation(
      async (opts: {
        model: string
        signal: AbortSignal
        onError?: (message: string, info?: Record<string, unknown>) => void
      }) => {
        sentRequests.push(opts)
        opts.onError?.('厂商账号额度耗尽', { code: 402 })
        return undefined
      },
    )

    await mount()
    await typeAndSubmit('撞上额度错误的一条')
    await settleAbortedRound()

    expect(container.querySelector('[data-testid="retry-last-turn"]')).not.toBeNull()
    // 真失败出的是错误条,不是换档终止那句理由 —— 两条通道不许互相冒充
    expect(container.textContent).not.toContain(NOTICE_TEXT)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
