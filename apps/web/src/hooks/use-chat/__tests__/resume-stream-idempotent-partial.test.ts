// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// X1/X2(2026-11-13)断线续接幂等与早退持久化。
//  X1:服务端 resume 是"重生非真续传"(前缀塞回让模型重生尾段),同一轮重复 resume / SSE 重放
//      可能把已 append 的头部再发一遍 → 降级为前端幂等,append 前做前缀匹配截掉重叠段。
//  X2:早退(错误/中止)路径此前只 markStreamError/toast/收尾,已 append 的部分正文悬空不落库
//      → 把已上屏内容交给 persistMessageSafe 新建持久化记录(metadata.partial 标识别)。

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createChatStore } from '@/stores/chat'
import type { ChatStore } from '@/stores/chat-pane-context'
import type { PendingResume } from '../resume-stream'
import { resumePendingMessage } from '../resume-stream'

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
  // status 恒报"未落库" ⇒ 走 POST /api/chat/resume 的直接续生成分支
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

// X2:persistMessageSafe 换成 spy,断言早退时以 assistant 角色建持久化记录
const { persistMessageSafe } = vi.hoisted(() => ({
  persistMessageSafe: vi.fn<
    (
      conversationId: string,
      content: string,
      role: 'user' | 'assistant',
      metadata?: Record<string, unknown>,
      reasoning?: string,
      options?: unknown,
      chatStore?: unknown,
    ) => Promise<{ status: string }>
  >(async () => ({ status: 'ok' })),
}))
vi.mock('../persistence', () => ({
  persistMessageSafe,
}))

const LABELS = { title: '续接失败', action: '重新生成', noProgress: '无新内容' }
const CONV = 'conv-resume-p1'
const MSG = 'assistant-half-p1'

const PENDING: PendingResume = {
  conversationId: CONV,
  messageId: MSG,
  content: '已生成的前半段',
}

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

function makeStore(): ChatStore {
  const store = createChatStore('ihui-chat-resume-p1-test')
  store.setState({
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
  return store
}

describe('resume-stream X1/X2(2026-11-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    persistMessageSafe.mockClear()
  })

  describe('X1:同一消息的并发 resume 去重锁', () => {
    it('同一消息并发两次 resume → 后到的直接放弃,只有一个流 append', async () => {
      const store = makeStore()
      // 服务端续出"后半段"。两次并发 resume:若不做去重,两条流交错 append 同一消息 → 内容重复乱序。
      global.fetch = vi.fn(async () =>
        sseResponse(['data: {"content":"后半段"}']),
      ) as unknown as typeof fetch

      // 并发触发(React StrictMode dev 双触发 effect 即命中此型)
      await Promise.all([
        resumePendingMessage(PENDING, {
          signal: new AbortController().signal,
          labels: LABELS,
          paneId: null,
          chatStore: store,
        }),
        resumePendingMessage(PENDING, {
          signal: new AbortController().signal,
          labels: LABELS,
          paneId: null,
          chatStore: store,
        }),
      ])

      // 后到的 resume 被在飞锁挡下,只有先到那条流真正 append ⇒ 不叠加重复内容
      const target = store.getState().messages.find((m) => m.id === MSG)
      expect(target?.content).toBe('已生成的前半段后半段')
      expect(target?.streamCompleted).toBe(true)
    })

    it('串行两次 resume(第一次已收尾释放锁)→ 第二次可重新发起,不被锁误挡', async () => {
      const store = makeStore()
      global.fetch = vi.fn(async () =>
        sseResponse(['data: {"content":"A"}']),
      ) as unknown as typeof fetch

      await resumePendingMessage(PENDING, {
        signal: new AbortController().signal,
        labels: LABELS,
        paneId: null,
        chatStore: store,
      })
      // 第一次已收尾(finally 释放锁)⇒ 复位 streamCompleted 后第二次能重新发起
      store.setState((prev) => ({
        messages: prev.messages.map((m) => (m.id === MSG ? { ...m, streamCompleted: false } : m)),
      }))
      await resumePendingMessage(PENDING, {
        signal: new AbortController().signal,
        labels: LABELS,
        paneId: null,
        chatStore: store,
      })

      // 串行不并发 ⇒ 第二次正常续接,不会被锁挡(锁只在并发窗口生效)
      const target = store.getState().messages.find((m) => m.id === MSG)
      expect(target?.content).toBe('已生成的前半段AA')
    })
  })

  describe('X2:早退(错误)路径把已上屏的部分正文交给落库链', () => {
    it('fetch 抛非 Abort 错误 → persistMessageSafe 以 assistant 角色建持久化记录', async () => {
      const store = makeStore()
      // fetch 抛普通 Error(非 Abort)⇒ 走外层 catch 的错误分支
      global.fetch = vi.fn(async () => {
        throw new Error('boom')
      }) as unknown as typeof fetch

      await resumePendingMessage(PENDING, {
        signal: new AbortController().signal,
        labels: LABELS,
        paneId: null,
        chatStore: store,
      })

      // 已上屏的前半段非空 ⇒ 早退时持久化
      expect(persistMessageSafe).toHaveBeenCalledTimes(1)
      const call = persistMessageSafe.mock.calls[0]!
      expect(call[0]).toBe(CONV)
      expect(call[1]).toBe('已生成的前半段')
      expect(call[2]).toBe('assistant')
      // metadata.partial 标识别(反证锚点:摘掉 persistPartial 调用则本用例变红)
      expect((call[3] as { partial?: boolean }).partial).toBe(true)
      // 第 7 个参数是注入的 store(窗格实例,不是根单例)
      expect(call[6]).toBe(store)
      // 降级 toast 照常(早退可见出口未被 X2 改动)
      expect(toastError).toHaveBeenCalled()
    })

    it('正常收尾路径不触发早退持久化(避免与流式正常落库重复)', async () => {
      const store = makeStore()
      global.fetch = vi.fn(async () =>
        sseResponse(['data: {"content":"后半段"}']),
      ) as unknown as typeof fetch

      await resumePendingMessage(PENDING, {
        signal: new AbortController().signal,
        labels: LABELS,
        paneId: null,
        chatStore: store,
      })

      // 正常完成不早退 ⇒ X2 持久化不触发(内容最终落库由服务端 resume status 权威回填负责)
      expect(persistMessageSafe).not.toHaveBeenCalled()
      const target = store.getState().messages.find((m) => m.id === MSG)
      expect(target?.content).toBe('已生成的前半段后半段')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
