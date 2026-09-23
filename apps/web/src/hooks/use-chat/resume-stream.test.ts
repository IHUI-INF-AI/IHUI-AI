// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useChatStore } from '@/stores/chat'
import { findPendingResume, autoResumeAfterHistory } from './resume-stream'

// parseStreamLine 只保留测试需要的语义:从 `data: {"content":"..."}` 取文本块
vi.mock('@ihui/api-client', () => ({
  // @/lib/model-context-capacity 只是本包的一层 re-export,必须一并给出
  getModelContextCapacity: () => 128_000,
  parseStreamLine: (line: string): string | null => {
    if (!line.startsWith('data:')) return null
    try {
      const json = JSON.parse(line.slice(5).trim())
      return typeof json?.content === 'string' ? json.content : null
    } catch {
      return null
    }
  },
}))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({
    success: true,
    data: { exists: false, completed: false, content: '', updatedAt: null },
  })),
  getToken: vi.fn(() => 'test-token'),
  getStreamBaseUrl: vi.fn(() => ''),
  isAbortError: (e: unknown) => e instanceof Error && e.name === 'AbortError',
}))

vi.mock('@/components/common', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}))

/** 构造 SSE 响应体 */
function sseResponse(lines: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const line of lines) controller.enqueue(enc.encode(line + '\n'))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

const LABELS = { title: '续接失败', action: '重新生成', noProgress: '无新内容' }

function seedMessages(overrides: Partial<{ streamCompleted: boolean }> = {}): string {
  const assistantId = 'assistant-1'
  useChatStore.setState({
    conversationId: 'conv-1',
    messages: [
      { id: 'u1', role: 'user', content: '问题', createdAt: 1 },
      {
        id: assistantId,
        role: 'assistant',
        content: '已生成的前半段',
        createdAt: 2,
        ...overrides,
      },
    ],
    isStreaming: false,
  })
  return assistantId
}

describe('P1-6 断点续传', () => {
  beforeEach(() => {
    // 用 clearAllMocks 而非 restoreAllMocks:后者会把 vi.mock 工厂里的实现一并抹掉
    vi.clearAllMocks()
    global.fetch = vi.fn(async () => sseResponse(['data: {"content":"后半段"}'])) as never
  })

  it('识别被中断的助手消息', () => {
    const id = seedMessages({ streamCompleted: false })
    const pending = findPendingResume('conv-1')
    expect(pending?.messageId).toBe(id)
    expect(pending?.content).toBe('已生成的前半段')
  })

  it('已完成(或无标记)的助手消息不触发续接', () => {
    seedMessages({ streamCompleted: true })
    expect(findPendingResume('conv-1')).toBeNull()
    seedMessages()
    expect(findPendingResume('conv-1')).toBeNull()
  })

  it('会话不匹配时返回 null', () => {
    seedMessages({ streamCompleted: false })
    expect(findPendingResume('conv-other')).toBeNull()
  })

  it('历史结算后立即续接:同一微任务链内发出请求,无额外等待', async () => {
    const id = seedMessages({ streamCompleted: false })
    // 真实时序:先捕获候选(会话 effect 内),再被服务端快照覆盖
    const pendingRef = { current: findPendingResume('conv-1') }
    useChatStore.setState({
      messages: [{ id: 'u1', role: 'user', content: '问题', createdAt: 1 }],
    })
    const controller = new AbortController()

    const started = Date.now()
    await autoResumeAfterHistory(pendingRef, 'conv-1', controller.signal, LABELS)
    const elapsed = Date.now() - started

    // 3 秒红线:续接必须在历史结算回调里就地发起(不含任何 setTimeout 等待)
    expect(elapsed).toBeLessThan(3000)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    expect(url).toContain('/api/chat/resume')

    // 未落库的消息被补回,且续接内容追加到原文之后
    const target = useChatStore.getState().messages.find((m) => m.id === id)
    expect(target).toBeDefined()
    expect(target?.content).toBe('已生成的前半段后半段')
    expect(target?.streamCompleted).toBe(true)
    expect(pendingRef.current).toBeNull()
  })

  it('已被新消息取代时放弃续接,不重复消耗一次生成', async () => {
    seedMessages({ streamCompleted: false })
    useChatStore.setState({
      messages: [
        { id: 'u1', role: 'user', content: '问题', createdAt: 1 },
        { id: 'assistant-2', role: 'assistant', content: '新的回复', createdAt: 3 },
      ],
    })
    const pendingRef = { current: findPendingResume('conv-1') }
    await autoResumeAfterHistory(pendingRef, 'conv-1', new AbortController().signal, LABELS)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
