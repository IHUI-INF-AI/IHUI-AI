// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 片3(2026-10-21):resume-stream 全面 store 化 —— 续接的读面/写面/收尾全部落在被注入的 store。
// 成对留证(缺一条用例就没有牙):
//  ① 正向 = 把窗格 store 传进去时,候选捕获、消息补回、增量追加、streamCompleted 收尾、
//     本轮态回收全部只写该实例,根单例快照零变化;
//  ② 反证 = 摘掉注入(缺省不传)必须逐字复现今天"全部落到根单例"的行为 —— 那正是本票
//     要消灭的"非根窗格续接写进根窗格"串窗格错账。

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createChatStore, useChatStore } from '@/stores/chat'
import type { ChatStore } from '@/stores/chat-pane-context'
import { matchesPaneEvent } from '@/stores/chat-pane-context'
import type { PendingResume } from '../resume-stream'
import { autoResumeAfterHistory, findPendingResume, resumePendingMessage } from '../resume-stream'

vi.mock('@ihui/api-client', () => ({
  getModelContextCapacity: () => 128_000,
  refreshAccessTokenOnce: vi.fn(async () => null),
  parseStreamLine: (line: string): string | null => {
    if (!line.startsWith('data:')) return null
    try {
      const json = JSON.parse(line.slice(5).trim()) as { content?: unknown }
      return typeof json.content === 'string' ? json.content : null
    } catch {
      return null
    }
  },
}))

vi.mock('@/lib/api', () => ({
  // status 恒报"未落库" ⇒ 走 POST /api/chat/resume 的直接续生成分支(增量/收尾都在目标 store 上)
  fetchApi: vi.fn(async () => ({
    success: true,
    data: { exists: false, completed: false, content: '', updatedAt: null },
  })),
  getToken: vi.fn(() => 'test-token'),
  getStreamBaseUrl: vi.fn(() => ''),
  isAbortError: (e: unknown) => e instanceof Error && e.name === 'AbortError',
}))

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('@/components/common', () => ({
  toast: { error: toastError, warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}))

const LABELS = { title: '续接失败', action: '重新生成', noProgress: '无新内容' }
const CONV = 'conv-resume-1'
const MSG = 'assistant-half'

const PENDING: PendingResume = {
  conversationId: CONV,
  messageId: MSG,
  content: '已生成的前半段',
}

/** SSE 响应体:一条增量后正常收尾(与既有 resume-stream.test.ts 同构造) */
function sseResponse(lines: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const line of lines) controller.enqueue(enc.encode(`${line}\n`))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

/**
 * 被注入的窗格实例:同会话 + 半截助手消息(streamCompleted=false)。
 * persist 键用测试专用名,与真实窗格键不撞。
 */
function makePaneStore(name: string): ChatStore {
  const pane = createChatStore(`ihui-chat-resume-test-${name}`)
  pane.setState({
    conversationId: CONV,
    messages: [
      { id: 'u1', role: 'user', content: '问题', createdAt: 1 },
      {
        id: MSG,
        role: 'assistant',
        content: PENDING.content,
        createdAt: 2,
        streamCompleted: false,
      },
    ],
    isStreaming: false,
  })
  return pane
}

/** 根单例先落一份"可区分的"状态:续接若错落到这里,快照断言立刻点名 */
function seedRoot(): void {
  useChatStore.setState({
    conversationId: 'root-other-conv',
    messages: [{ id: 'root-1', role: 'user', content: '根窗格的消息', createdAt: 1 }],
    isStreaming: false,
    error: null,
  })
}

function rootSnapshot(): { conversationId: string | null; ids: string[]; isStreaming: boolean } {
  const s = useChatStore.getState()
  return {
    conversationId: s.conversationId,
    ids: s.messages.map((m) => m.id),
    isStreaming: s.isStreaming,
  }
}

describe('resume-stream 按窗格 store 读写(片3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastError.mockClear()
    seedRoot()
    global.fetch = vi.fn(async () =>
      sseResponse(['data: {"content":"后半段"}']),
    ) as unknown as typeof fetch
  })

  describe('① 正向:注入窗格 store ⇒ 续接只写该实例,根单例零变化', () => {
    it('findPendingResume 的扫描面 = 被注入的 store(根单例里有同形候选也不读)', () => {
      // 根单例换成"同会话 + 半截消息"—— 若扫描面回落根单例,它会先命中根那份
      useChatStore.setState({
        conversationId: CONV,
        messages: [
          {
            id: 'root-half',
            role: 'assistant',
            content: '根的那半截',
            createdAt: 1,
            streamCompleted: false,
          },
        ],
      })
      const pane = makePaneStore('scan')
      const fromPane = findPendingResume(CONV, pane)
      expect(fromPane?.messageId).toBe(MSG)
      // 空 store 注入 ⇒ 什么都找不到(证明读面确实跟着注入走,而不是恒读单例)
      const empty = createChatStore('ihui-chat-resume-test-empty')
      empty.setState({ conversationId: CONV, messages: [] })
      expect(findPendingResume(CONV, empty)).toBeNull()
    })

    it('resumePendingMessage:补回/追加/streamCompleted/本轮态回收全落窗格实例', async () => {
      const pane = makePaneStore('write')
      const before = rootSnapshot()

      await resumePendingMessage(PENDING, {
        signal: new AbortController().signal,
        labels: LABELS,
        paneId: 'pane-write',
        chatStore: pane,
      })

      const messages = pane.getState().messages
      const target = messages.find((m) => m.id === MSG)
      expect(target?.content).toBe('已生成的前半段后半段')
      expect(target?.streamCompleted).toBe(true)
      // G-703 收尾:仍在同一会话 ⇒ 本轮态在该实例上被回收
      expect(pane.getState().isStreaming).toBe(false)
      // 根单例快照零变化(逐字段)
      expect(rootSnapshot()).toEqual(before)
    })

    it('autoResumeAfterHistory 第 6 参透传:守卫读窗格实例,续接也写窗格实例', async () => {
      const pane = makePaneStore('auto')
      // 守卫用根单例的话会因 conversationId 不等而直接放弃 ⇒ 能续成即证明守卫也换面了
      expect(useChatStore.getState().conversationId).not.toBe(CONV)
      const pendingRef = { current: findPendingResume(CONV, pane) }
      expect(pendingRef.current).not.toBeNull()
      const before = rootSnapshot()

      await autoResumeAfterHistory(
        pendingRef,
        CONV,
        new AbortController().signal,
        LABELS,
        'pane-auto',
        pane,
      )

      expect(pane.getState().messages.find((m) => m.id === MSG)?.content).toBe(
        '已生成的前半段后半段',
      )
      expect(rootSnapshot()).toEqual(before)
    })

    it('降级路径:失败收尾写窗格实例,重生成派发带着该窗格身份', async () => {
      global.fetch = vi.fn(
        async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
      ) as unknown as typeof fetch
      const pane = makePaneStore('fail')
      const before = rootSnapshot()

      await resumePendingMessage(PENDING, {
        signal: new AbortController().signal,
        labels: LABELS,
        paneId: 'pane-fail',
        chatStore: pane,
      })

      // notifyResumeFailed 的 streamCompleted=true 收尾落在窗格实例
      expect(pane.getState().messages.find((m) => m.id === MSG)?.streamCompleted).toBe(true)
      expect(rootSnapshot()).toEqual(before)
      // 降级 toast 的「重新生成」派发仍带窗格身份(片1 口径不回潮)
      expect(toastError).toHaveBeenCalledTimes(1)
      const options = (
        toastError.mock.calls[0] as unknown as [string, { action?: { onClick?: () => void } }]
      )[1]
      const events: Array<{ messageId?: string; paneId?: string | null }> = []
      const listener = (e: Event): void => {
        events.push((e as CustomEvent).detail)
      }
      window.addEventListener('ihui:regenerate-message', listener)
      options?.action?.onClick?.()
      window.removeEventListener('ihui:regenerate-message', listener)
      expect(events[0]?.paneId).toBe('pane-fail')
      expect(matchesPaneEvent(events[0]?.paneId, 'pane-fail')).toBe(true)
      expect(matchesPaneEvent(events[0]?.paneId, null)).toBe(false)
    })
  })

  describe('② 反证:摘掉注入 ⇒ 逐字复现今天"落到根单例"的行为', () => {
    it('findPendingResume 不传第二参 ⇒ 读的是根单例(窗格实例里有候选也看不见)', () => {
      const pane = makePaneStore('omit-scan')
      useChatStore.setState({ conversationId: 'root-other-conv', messages: [] })
      expect(findPendingResume(CONV)).toBeNull()
      // 同一份数据搬到根单例 ⇒ 立刻找得到(旧行为,一条没改)
      useChatStore.setState({ conversationId: CONV, messages: pane.getState().messages })
      expect(findPendingResume(CONV)?.messageId).toBe(MSG)
    })

    it('resumePendingMessage 不传 chatStore ⇒ 补回/追加/streamCompleted 全写根单例,窗格实例零变化', async () => {
      const pane = makePaneStore('omit-write')
      useChatStore.setState({
        conversationId: CONV,
        messages: [
          { id: 'u1', role: 'user', content: '问题', createdAt: 1 },
          {
            id: MSG,
            role: 'assistant',
            content: PENDING.content,
            createdAt: 2,
            streamCompleted: false,
          },
        ],
        isStreaming: false,
      })
      const paneBefore = pane.getState().messages

      await resumePendingMessage(PENDING, {
        signal: new AbortController().signal,
        labels: LABELS,
      })

      // 旧行为:续接正文进的是根单例
      expect(useChatStore.getState().messages.find((m) => m.id === MSG)?.content).toBe(
        '已生成的前半段后半段',
      )
      expect(useChatStore.getState().messages.find((m) => m.id === MSG)?.streamCompleted).toBe(true)
      // 窗格实例一个字没被写(这就是"非根窗格的续接落在根窗格"的缺陷本体)
      expect(pane.getState().messages).toBe(paneBefore)
      expect(pane.getState().messages.find((m) => m.id === MSG)?.content).toBe(PENDING.content)
    })

    it('autoResumeAfterHistory 不传第 6 参 ⇒ 守卫与续接都按根单例判(今天同形)', async () => {
      useChatStore.setState({
        conversationId: CONV,
        messages: [
          {
            id: MSG,
            role: 'assistant',
            content: PENDING.content,
            createdAt: 2,
            streamCompleted: false,
          },
        ],
        isStreaming: false,
      })
      const pane = makePaneStore('omit-auto')
      const paneBefore = pane.getState().messages
      const pendingRef = { current: findPendingResume(CONV) }
      expect(pendingRef.current).not.toBeNull()

      await autoResumeAfterHistory(pendingRef, CONV, new AbortController().signal, LABELS)

      expect(useChatStore.getState().messages.find((m) => m.id === MSG)?.content).toBe(
        '已生成的前半段后半段',
      )
      expect(pane.getState().messages).toBe(paneBefore)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
