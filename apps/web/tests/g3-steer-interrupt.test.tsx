// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 差距③(2026-10-30 立)useMessageSend 行为面守门:
 * - steer() 入队成功 ⇒ 乐观写入 queued 条目(queuedAt=ACK 回显;无回显回落本地 ISO)
 * - steer() 信封 !success ⇒ 保留输入 + toast,不写条目
 * - interruptAndSend() 组合语义 ⇒ W27 入队 + 清输入/引用/草稿 + onStop,不直调 onSend
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type React from 'react'
import { renderHook, act } from '@testing-library/react'

const { mockSteer, mockToast, mockT, mockClearDraft, chatStoreState } = vi.hoisted(() => {
  const map: Record<string, string> = { steerFailed: '引导发送失败' }
  const mockT = (key: string) => map[key] ?? key
  const mockSteer = vi.fn()
  const mockToast = Object.assign(vi.fn(), {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  })
  const mockClearDraft = vi.fn()
  const chatStoreState = {
    conversationId: 'conv-9' as string | null,
    streamingAssistantId: 'msg-9' as string | null,
    runtimeInterjection: undefined as boolean | null | undefined,
    followUpQueueMode: 'queue' as 'queue' | 'steer',
    appendSteerNotice: vi.fn(),
    enqueueSideQuestion: vi.fn(),
  }
  return { mockSteer, mockToast, mockT, mockClearDraft, chatStoreState }
})

vi.mock('next-intl', () => ({ useTranslations: () => mockT }))

// chat store mock(getState 静态方法为 zustand 真实 store 自带,mock 必须提供)
vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (selector: (s: typeof chatStoreState) => unknown) =>
      selector ? selector(chatStoreState) : chatStoreState,
    { getState: () => chatStoreState },
  ),
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, steerChatStream: mockSteer }
})

vi.mock('@/hooks/use-chat/slash-commands', () => ({
  answerSideQuestion: vi.fn(),
  tryHandleSideSlash: () => ({ handled: false }),
}))
vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}))
vi.mock('@/lib/chat-draft-storage', () => ({ clearDraft: mockClearDraft }))
vi.mock('@/components/common', () => ({ toast: mockToast }))

import { useMessageSend } from '../src/hooks/use-message-send'

function renderSendHook(params: {
  isStreaming: boolean
  initial: string
  onStop?: () => void
  detachReferences?: () => void
  awaitingApproval?: boolean
}) {
  let currentValue = params.initial
  const setValueMock = vi.fn((v: React.SetStateAction<string>) => {
    currentValue = typeof v === 'function' ? (v as (p: string) => string)(currentValue) : v
  })
  const inputCoreRef = {
    current: { resize: () => {}, focus: () => {}, setSelectionRange: () => {} },
  }
  const onSendMock = vi.fn().mockResolvedValue(true)
  const { result } = renderHook(() =>
    useMessageSend({
      value: currentValue,
      setValue: setValueMock,
      isStreaming: params.isStreaming,
      isHighRisk: false,
      references: [],
      resetReferences: () => {},
      detachReferences: params.detachReferences ?? (() => {}),
      addFileReference: () => {},
      addTextReference: () => {},
      onSend: onSendMock,
      inputCoreRef,
      draftKey: 'chat:draft',
      onStop: params.onStop,
      awaitingApproval: params.awaitingApproval,
    }),
  )
  return { result, getValue: () => currentValue, setValueMock, onSendMock }
}

describe('useMessageSend — 差距③ steer 乐观写入', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatStoreState.conversationId = 'conv-9'
    chatStoreState.streamingAssistantId = 'msg-9'
    chatStoreState.runtimeInterjection = undefined
    chatStoreState.followUpQueueMode = 'queue'
  })

  it('入队成功:以 ACK 回显 queuedAt 写 queued 条目 + 清空输入 + 清草稿', async () => {
    mockSteer.mockResolvedValue({
      success: true,
      data: { ok: true, queued: 1, queuedAt: '2026-10-30T10:00:00.000Z' },
    })
    const { result, getValue } = renderSendHook({ isStreaming: true, initial: ' 换一个思路 ' })
    await act(async () => {
      await result.current.steer()
    })
    expect(chatStoreState.appendSteerNotice).toHaveBeenCalledWith('msg-9', {
      text: '换一个思路',
      phase: 'queued',
      queuedAt: '2026-10-30T10:00:00.000Z',
    })
    expect(getValue()).toBe('')
    expect(mockClearDraft).toHaveBeenCalledWith('chat:draft')
  })

  it('旧服务端无 queuedAt 回显:回落本地 ISO 串(撤回键不缺位)', async () => {
    mockSteer.mockResolvedValue({ success: true, data: { ok: true, queued: 1 } })
    const { result } = renderSendHook({ isStreaming: true, initial: '本地钟兜底' })
    await act(async () => {
      await result.current.steer()
    })
    const notice = chatStoreState.appendSteerNotice.mock.calls[0]![1]
    expect(notice.phase).toBe('queued')
    expect(typeof notice.queuedAt).toBe('string')
    expect(notice.queuedAt.endsWith('Z')).toBe(true)
  })

  it('信封 !success:不写条目、保留输入供重试 + toast.warning', async () => {
    mockSteer.mockResolvedValue({ success: false, errorCode: 'QUEUE_FULL' })
    const { result, getValue } = renderSendHook({ isStreaming: true, initial: '队列超限' })
    await act(async () => {
      await result.current.steer()
    })
    expect(chatStoreState.appendSteerNotice).not.toHaveBeenCalled()
    expect(getValue()).toBe('队列超限')
    expect(mockToast.warning).toHaveBeenCalledWith('引导发送失败')
  })

  it('Runtime 显式不支持插话:不打 steer 请求,正文转入待发队列并点名拒因', async () => {
    chatStoreState.runtimeInterjection = false
    const { result, getValue } = renderSendHook({ isStreaming: true, initial: ' 先排队 ' })
    await act(async () => {
      await result.current.steer()
    })
    expect(mockSteer).not.toHaveBeenCalled()
    expect(chatStoreState.appendSteerNotice).not.toHaveBeenCalled()
    expect(result.current.pendingMessages.map((item) => item.text)).toEqual(['先排队'])
    expect(getValue()).toBe('')
    expect(mockToast.warning).toHaveBeenCalledWith('queue.blocked.runtimeNoInterject')
  })

  it('等用户审批:正文留在输入框,不注入、不入队', async () => {
    const { result, getValue } = renderSendHook({
      isStreaming: true,
      initial: '等你点头',
      awaitingApproval: true,
    })
    await act(async () => {
      await result.current.steer()
    })
    expect(mockSteer).not.toHaveBeenCalled()
    expect(result.current.pendingMessages).toHaveLength(0)
    expect(getValue()).toBe('等你点头')
    expect(mockToast.warning).toHaveBeenCalledWith('queue.denied.cause.awaitingApproval')
  })

  it('没有运行中的 Turn:正文转入待发队列并点名 inactive', async () => {
    chatStoreState.streamingAssistantId = null
    const { result, getValue } = renderSendHook({ isStreaming: true, initial: '落点没了' })
    await act(async () => {
      await result.current.steer()
    })
    expect(mockSteer).not.toHaveBeenCalled()
    expect(result.current.pendingMessages.map((item) => item.text)).toEqual(['落点没了'])
    expect(getValue()).toBe('')
    expect(mockToast.warning).toHaveBeenCalledWith('queue.blocked.noRunningTurn')
  })

  it('插话优先 + 能力在位:Enter 走 steer 请求,不进待发队列', async () => {
    chatStoreState.followUpQueueMode = 'steer'
    chatStoreState.runtimeInterjection = true
    mockSteer.mockResolvedValue({
      success: true,
      data: { ok: true, queued: 1, queuedAt: '2026-11-07T02:00:00.000Z' },
    })
    const { result, getValue } = renderSendHook({ isStreaming: true, initial: '插进去' })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockSteer).toHaveBeenCalledTimes(1)
    expect(result.current.pendingMessages).toHaveLength(0)
    expect(getValue()).toBe('')
    expect(chatStoreState.appendSteerNotice).toHaveBeenCalledWith('msg-9', {
      text: '插进去',
      phase: 'queued',
      queuedAt: '2026-11-07T02:00:00.000Z',
    })
  })

  it('排队优先:流式中 Enter 仍进待发队列,不打 steer 请求', async () => {
    chatStoreState.followUpQueueMode = 'queue'
    chatStoreState.runtimeInterjection = true
    const { result, getValue } = renderSendHook({ isStreaming: true, initial: '按顺序' })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockSteer).not.toHaveBeenCalled()
    expect(result.current.pendingMessages.map((item) => item.text)).toEqual(['按顺序'])
    expect(getValue()).toBe('')
  })
})

describe('useMessageSend — 差距③ interruptAndSend 组合语义', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('流式中有文本:入队 + 清输入 + detachReferences + onStop,不直调 onSend', async () => {
    const onStopMock = vi.fn()
    const detachMock = vi.fn()
    const { result, getValue, onSendMock } = renderSendHook({
      isStreaming: true,
      initial: ' 后续指令 ',
      onStop: onStopMock,
      detachReferences: detachMock,
    })
    await act(async () => {
      await result.current.interruptAndSend()
    })
    expect(result.current.pendingMessages).toEqual([{ text: '后续指令', refs: [] }])
    expect(getValue()).toBe('')
    expect(detachMock).toHaveBeenCalled()
    expect(onStopMock).toHaveBeenCalledTimes(1)
    // 发送由既有"流结束自动出队"effect 承担,hook 内不直调 onSend(零新状态机)
    expect(onSendMock).not.toHaveBeenCalled()
  })

  it('空输入:静默不动作(不入队、不停流)', async () => {
    const onStopMock = vi.fn()
    const { result } = renderSendHook({ isStreaming: true, initial: '   ', onStop: onStopMock })
    await act(async () => {
      await result.current.interruptAndSend()
    })
    expect(result.current.pendingMessages).toHaveLength(0)
    expect(onStopMock).not.toHaveBeenCalled()
  })
})

describe('useMessageSend — 待发队列重排', () => {
  it('先入队两条再把队尾移到队首;越界不动', async () => {
    chatStoreState.followUpQueueMode = 'queue'
    let currentValue = '甲'
    const setValue = vi.fn((v: React.SetStateAction<string>) => {
      currentValue = typeof v === 'function' ? v(currentValue) : v
    })
    const inputCoreRef = {
      current: { resize: () => {}, focus: () => {}, setSelectionRange: () => {} },
    }
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) =>
        useMessageSend({
          value: text,
          setValue,
          isStreaming: true,
          isHighRisk: false,
          references: [],
          resetReferences: () => {},
          detachReferences: () => {},
          addFileReference: () => {},
          addTextReference: () => {},
          onSend: vi.fn().mockResolvedValue(true),
          inputCoreRef,
          draftKey: 'chat:draft',
        }),
      { initialProps: { text: currentValue } },
    )
    await act(async () => {
      await result.current.submit()
    })
    currentValue = '乙'
    rerender({ text: '乙' })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.pendingMessages.map((item) => item.text)).toEqual(['甲', '乙'])
    act(() => {
      result.current.reorderPendingMessage(1, 0)
    })
    expect(result.current.pendingMessages.map((item) => item.text)).toEqual(['乙', '甲'])
    act(() => {
      result.current.reorderPendingMessage(0, 9)
    })
    expect(result.current.pendingMessages.map((item) => item.text)).toEqual(['乙', '甲'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
