// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D60 发送可靠性状态族单元测试(2026-09-23 立):
 * persistMessageSafe 四态归一化 + store 草稿保全。
 * 每态断言"失败后输入框内容仍在"(store.failedDraft),非只测 toast。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useChatStore } from '@/stores/chat'
import { persistMessageSafe } from '../persistence'

const { mockSendMessage, mockToast } = vi.hoisted(() => {
  const mockSendMessage = vi.fn()
  const mockToast = Object.assign(vi.fn(), {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  })
  return { mockSendMessage, mockToast }
})

// persistence 模块级 import 的外部依赖全部 mock,单测聚焦四态分类与草稿保全
vi.mock('@ihui/api-client', () => ({
  sendMessage: mockSendMessage,
  persistQuestion: vi.fn(),
}))
vi.mock('@/components/common', () => ({ toast: mockToast }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

interface ToastPayload {
  description: string
  action?: { label: string; onClick: () => void }
}

type ToastErrorMock = ReturnType<typeof vi.fn>

function lastErrorCall(): [string, ToastPayload] {
  expect(mockToast.error).toHaveBeenCalledTimes(1)
  return (mockToast.error as unknown as ToastErrorMock).mock.calls[0] as [string, ToastPayload]
}

function lastWarningCall(): [string, ToastPayload] {
  expect(mockToast.warning).toHaveBeenCalledTimes(1)
  return (mockToast.warning as unknown as ToastErrorMock).mock.calls[0] as [string, ToastPayload]
}

describe('D60 发送可靠性状态族', () => {
  beforeEach(() => {
    // 用 clearAllMocks 而非 restoreAllMocks:后者会把 vi.mock 工厂一并还原
    vi.clearAllMocks()
    useChatStore.getState().clearFailedDraft()
  })

  it('① 发送失败→草稿保留 + 可重发(明示草稿已保留)', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: false, error: 'Network error' })
    const input = '今晚的待办清单不要丢'
    const retry = vi.fn()
    const outcome = await persistMessageSafe('conv-1', input, 'user', undefined, undefined, {
      retry,
    })

    expect(outcome.status).toBe('failed_retryable')
    expect(outcome.retryable).toBe(true)
    expect(outcome.draftPreserved).toBe(true)
    // 失败后输入框内容仍在:store 草稿保全(非只测 toast)
    expect(useChatStore.getState().failedDraft).toBe(input)
    expect(useChatStore.getState().failedDraftStatus).toBe('failed_retryable')
    // 明示"draft preserved" + 配重发按钮(TRANSITIONAL English until D60 vocab lands)
    const [title, payload] = lastErrorCall()
    expect(title).toContain('draft preserved')
    expect(payload.description).toContain('Draft preserved')
    expect(payload.action?.label).toBe('Retry')
    payload.action?.onClick()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('② 幂等冲突→提示作为新消息发送,草稿保留', async () => {
    mockSendMessage.mockResolvedValueOnce({
      success: false,
      status: 409,
      errorCode: 'IDEMPOTENT_CONFLICT',
      error: '幂等键已存在，与原输入不一致',
    })
    const input = '改过的第二版内容'
    const outcome = await persistMessageSafe('conv-1', input, 'user')

    expect(outcome.status).toBe('idempotent_conflict')
    expect(outcome.retryable).toBe(true)
    // 失败后输入框内容仍在
    expect(useChatStore.getState().failedDraft).toBe(input)
    expect(useChatStore.getState().failedDraftStatus).toBe('idempotent_conflict')
    const [title, payload] = lastWarningCall()
    expect(title).toContain('as new message')
    expect(payload.description).toContain('Draft preserved')
  })

  it('③ 归档态→无法继续发送,草稿保留且无重发按钮', async () => {
    mockSendMessage.mockResolvedValueOnce({
      success: false,
      status: 403,
      errorCode: 'CONVERSATION_ARCHIVED',
      error: '会话已归档，无法写入',
    })
    const input = '归档会话里没发出去的话'
    const retry = vi.fn()
    const outcome = await persistMessageSafe('conv-1', input, 'user', undefined, undefined, {
      retry,
    })

    expect(outcome.status).toBe('archived')
    expect(outcome.retryable).toBe(false)
    // 失败后输入框内容仍在
    expect(useChatStore.getState().failedDraft).toBe(input)
    expect(useChatStore.getState().failedDraftStatus).toBe('archived')
    const [title, payload] = lastWarningCall()
    expect(title).toContain('archived')
    // 终态不配重发按钮(即使调用方传了 retry,也不误导用户可重发)
    expect(payload.action).toBeUndefined()
    expect(retry).not.toHaveBeenCalled()
  })

  it('④ 删除态→任务已归档或删除无法继续发送,草稿保留', async () => {
    mockSendMessage.mockResolvedValueOnce({
      success: false,
      status: 404,
      error: '对话不存在',
    })
    const input = '被删会话里没发出去的话'
    const outcome = await persistMessageSafe('conv-1', input, 'user')

    expect(outcome.status).toBe('deleted')
    expect(outcome.retryable).toBe(false)
    // 失败后输入框内容仍在
    expect(useChatStore.getState().failedDraft).toBe(input)
    expect(useChatStore.getState().failedDraftStatus).toBe('deleted')
    const [title, payload] = lastWarningCall()
    expect(title).toContain('archived or deleted')
    expect(payload.description).toContain('Draft preserved')
  })

  it('归档判定兼容 HTTP 410 与错误码大小写', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: false, status: 410, error: 'Gone' })
    const first = await persistMessageSafe('conv-1', '第一句', 'user')
    expect(first.status).toBe('archived')

    mockSendMessage.mockResolvedValueOnce({
      success: false,
      errorCode: 'conversation_archived',
      error: 'archived',
    })
    const second = await persistMessageSafe('conv-1', '第二句', 'user')
    expect(second.status).toBe('archived')
    // 后一次失败覆盖草稿为最新输入
    expect(useChatStore.getState().failedDraft).toBe('第二句')
  })

  it('过渡态声明:纯中文文案无码无状态→可重发兜底(中文兜底已删,词表落地后恢复精确分类)', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: false, error: '会话已归档，无法写入' })
    const archivedZh = await persistMessageSafe('conv-1', '中文归档文案', 'user')
    expect(archivedZh.status).toBe('failed_retryable')
    expect(archivedZh.retryable).toBe(true)

    mockSendMessage.mockResolvedValueOnce({ success: false, error: '对话不存在' })
    const deletedZh = await persistMessageSafe('conv-1', '中文删除文案', 'user')
    expect(deletedZh.status).toBe('failed_retryable')
    expect(deletedZh.retryable).toBe(true)

    mockSendMessage.mockResolvedValueOnce({ success: false, error: '内容不一致，请作为新消息发送' })
    const conflictZh = await persistMessageSafe('conv-1', '中文冲突文案', 'user')
    expect(conflictZh.status).toBe('failed_retryable')
    expect(conflictZh.retryable).toBe(true)
  })

  it('成功时同文草稿被清理,他文草稿不动(回归)', async () => {
    useChatStore.getState().setFailedDraft('已保存的内容', 'failed_retryable')
    mockSendMessage.mockResolvedValueOnce({ success: true, data: {} })
    const ok = await persistMessageSafe('conv-1', '已保存的内容', 'user')
    expect(ok.status).toBe('ok')
    expect(useChatStore.getState().failedDraft).toBeNull()

    useChatStore.getState().setFailedDraft('另一次失败的保留', 'failed_retryable')
    mockSendMessage.mockResolvedValueOnce({ success: true, data: {} })
    await persistMessageSafe('conv-1', '全新的内容', 'user')
    expect(useChatStore.getState().failedDraft).toBe('另一次失败的保留')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
