// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockWithdraw, mockToast } = vi.hoisted(() => {
  const mockWithdraw = vi.fn()
  const mockToast = Object.assign(vi.fn(), {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  })
  return { mockWithdraw, mockToast }
})

// next-intl:按命名空间分派(撤回按钮 tq('undo') / 拒因 tn('queue.denied.undo') / 标题 t(...))
vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string, params?: { count?: number }): string => {
      if (ns === 'ai.pane.queueOps' && key === 'undo') return '撤回'
      if (ns === 'ai.pane.inputNotices' && key === 'queue.denied.undo') return '无法撤回排队消息'
      if (key === 'steerNoticeBar.title') return `已引导 ${params?.count ?? 0} 次`
      if (key === 'steerNoticeBar.moreItems') return `等 ${params?.count ?? 0} 条`
      return `${ns}.${key}`
    },
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, withdrawSteer: mockWithdraw }
})

vi.mock('@/components/common', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, toast: mockToast }
})

import { SteerNoticeBar } from '../steer-notice-bar'
import { useChatStore, type SteerNotice } from '@/stores/chat'

const QUEUED: SteerNotice = { text: '换一个思路', phase: 'queued', queuedAt: 't1' }

/**
 * 差距③(2026-10-30 立)撤回按钮端到端呈现层守门:
 * withdrawSteer 信封解包三档(withdrawn/already_injected/not_found)+ 失败档 toast,
 * 落库动作(removeSteerNotice/markSteerInjected)按 store 真实状态断言。
 */
describe('SteerNoticeBar — 差距③撤回三态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChatStore.setState({
      conversationId: 'conv-1',
      draftInput: null,
      steerNoticesByMessageId: { 'msg-1': [QUEUED] },
    })
  })
  afterEach(() => cleanup())

  it('queued 条目渲染撤回按钮;injected/存量条目不渲染', () => {
    render(<SteerNoticeBar notices={[QUEUED]} messageId="msg-1" />)
    expect(screen.getByTestId('steer-notice-withdraw-0').textContent).toBe('撤回')
    cleanup()
    render(
      <SteerNoticeBar
        notices={[
          { text: '已注入', timestamp: 't2' },
          { text: '存量', phase: 'injected' },
        ]}
        messageId="msg-1"
      />,
    )
    expect(screen.queryByTestId('steer-notice-withdraw-0')).toBeNull()
  })

  it('withdrawn 回执:按三元组调 withdrawSteer 并移除本地 queued 条目(无 toast)', async () => {
    mockWithdraw.mockResolvedValue({ success: true, data: { ok: true, status: 'withdrawn' } })
    render(<SteerNoticeBar notices={[QUEUED]} messageId="msg-1" />)
    fireEvent.click(screen.getByTestId('steer-notice-withdraw-0'))
    await waitFor(() =>
      expect(mockWithdraw).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        messageId: 'msg-1',
        queuedAt: 't1',
      }),
    )
    await waitFor(() =>
      expect(useChatStore.getState().steerNoticesByMessageId['msg-1']).toEqual([]),
    )
    expect(mockToast.warning).not.toHaveBeenCalled()
    expect(mockToast.info).not.toHaveBeenCalled()
  })

  it('withdrawn 回执:该条文本回填输入框草稿(差距③ withdraw→draft,走既有 draftInput 通道)', async () => {
    mockWithdraw.mockResolvedValue({ success: true, data: { ok: true, status: 'withdrawn' } })
    render(<SteerNoticeBar notices={[QUEUED]} messageId="msg-1" />)
    fireEvent.click(screen.getByTestId('steer-notice-withdraw-0'))
    await waitFor(() => expect(useChatStore.getState().draftInput).toBe('换一个思路'))
    // 只回填文本,不触发自动发送通道
    expect(useChatStore.getState().draftAutoSend).toBe(false)
  })

  it('already_injected 回执:就地提升 injected + toast.info 已生效提示', async () => {
    mockWithdraw.mockResolvedValue({
      success: true,
      data: { ok: true, status: 'already_injected' },
    })
    render(<SteerNoticeBar notices={[QUEUED]} messageId="msg-1" />)
    fireEvent.click(screen.getByTestId('steer-notice-withdraw-0'))
    await waitFor(() =>
      expect(useChatStore.getState().steerNoticesByMessageId['msg-1']![0]!.phase).toBe('injected'),
    )
    expect(mockToast.info).toHaveBeenCalledWith('已引导 1 次')
    expect(mockToast.warning).not.toHaveBeenCalled()
  })

  it('not_found 回执:静默移除本地排队条目', async () => {
    mockWithdraw.mockResolvedValue({ success: true, data: { ok: true, status: 'not_found' } })
    render(<SteerNoticeBar notices={[QUEUED]} messageId="msg-1" />)
    fireEvent.click(screen.getByTestId('steer-notice-withdraw-0'))
    await waitFor(() =>
      expect(useChatStore.getState().steerNoticesByMessageId['msg-1']).toEqual([]),
    )
    expect(mockToast.warning).not.toHaveBeenCalled()
    // 差距③:not_found 不回填草稿(服务端从未有此条,不冒充"撤回了输入")
    expect(useChatStore.getState().draftInput).toBeNull()
  })

  it('信封 !success(4xx 拒撤):toast 报拒因,本地条目保留', async () => {
    mockWithdraw.mockResolvedValue({ success: false, errorCode: 'STEER_WITHDRAW_DENIED' })
    render(<SteerNoticeBar notices={[QUEUED]} messageId="msg-1" />)
    fireEvent.click(screen.getByTestId('steer-notice-withdraw-0'))
    await waitFor(() => expect(mockToast.warning).toHaveBeenCalledWith('无法撤回排队消息'))
    expect(useChatStore.getState().steerNoticesByMessageId['msg-1']).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
