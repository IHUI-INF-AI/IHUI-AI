// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockReorder, mockToast } = vi.hoisted(() => {
  const mockReorder = vi.fn()
  const mockToast = Object.assign(vi.fn(), {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  })
  return { mockReorder, mockToast }
})

// next-intl:按命名空间分派(上移/下移 aria-label 复用既有键 playground.moveUp/moveDown,
// 拒因 toast 复用既有键 inputNotices.queue.denied.reorder;撤回按钮 tq('undo'))
vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string, params?: { count?: number }): string => {
      if (ns === 'playground' && key === 'moveUp') return '上移'
      if (ns === 'playground' && key === 'moveDown') return '下移'
      if (ns === 'ai.pane.queueOps' && key === 'undo') return '撤回'
      if (ns === 'ai.pane.inputNotices' && key === 'queue.denied.reorder') {
        return '无法调整排队顺序'
      }
      if (key === 'steerNoticeBar.title') return `已引导 ${params?.count ?? 0} 次`
      if (key === 'steerNoticeBar.moreItems') return `等 ${params?.count ?? 0} 条`
      return `${ns}.${key}`
    },
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, reorderSteerQueue: mockReorder }
})

vi.mock('@/components/common', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, toast: mockToast }
})

import { SteerNoticeBar } from '../steer-notice-bar'
import { useChatStore, type SteerNotice } from '@/stores/chat'

const Q1: SteerNotice = { text: '先改测试', phase: 'queued', queuedAt: 't1' }
const Q2: SteerNotice = { text: '再改实现', phase: 'queued', queuedAt: 't2' }

const queuedOrder = () =>
  (useChatStore.getState().steerNoticesByMessageId['msg-1'] ?? [])
    .filter((n) => n.phase === 'queued')
    .map((n) => n.queuedAt)

/**
 * 差距③ mutateQueue(2026-10-30 立)呈现层守门:queued 条目的上移/下移按钮 ——
 * 本地乐观重排 + reorderSteerQueue 上报;被拒/异常回滚 + toast 报拒因;
 * 单条 queued 不渲染按钮;injected 条目不可动。
 */
describe('SteerNoticeBar — 差距③ mutateQueue 重排', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChatStore.setState({
      conversationId: 'conv-1',
      draftInput: null,
      steerNoticesByMessageId: { 'msg-1': [Q1, Q2] },
    })
  })
  afterEach(() => cleanup())

  it('≥2 条 queued 渲染上移/下移;队首禁上移、队尾禁下移;单条 queued 不渲染', () => {
    render(<SteerNoticeBar notices={[Q1, Q2]} messageId="msg-1" />)
    expect((screen.getByTestId('steer-notice-moveup-0') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('steer-notice-movedown-0') as HTMLButtonElement).disabled).toBe(
      false,
    )
    expect(screen.getByTestId('steer-notice-moveup-0').getAttribute('aria-label')).toBe('上移')
    expect(screen.getByTestId('steer-notice-movedown-1').getAttribute('aria-label')).toBe('下移')
    expect((screen.getByTestId('steer-notice-movedown-1') as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    render(<SteerNoticeBar notices={[Q1]} messageId="msg-1" />)
    expect(screen.queryByTestId('steer-notice-moveup-0')).toBeNull()
  })

  it('injected/存量条目不渲染移动按钮', () => {
    render(
      <SteerNoticeBar
        notices={[
          { text: '已注入', timestamp: 't9' },
          { text: '存量', phase: 'injected' },
        ]}
        messageId="msg-1"
      />,
    )
    expect(screen.queryByTestId('steer-notice-moveup-0')).toBeNull()
    expect(screen.queryByTestId('steer-notice-movedown-0')).toBeNull()
  })

  it('点下移:本地乐观重排先落,再按新 order 调 reorderSteerQueue', async () => {
    mockReorder.mockResolvedValue({
      success: true,
      data: { ok: true, queued: 2, orderApplied: ['t2', 't1'] },
    })
    render(<SteerNoticeBar notices={[Q1, Q2]} messageId="msg-1" />)
    fireEvent.click(screen.getByTestId('steer-notice-movedown-0'))
    await waitFor(() =>
      expect(mockReorder).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        messageId: 'msg-1',
        order: ['t2', 't1'],
      }),
    )
    await waitFor(() => expect(queuedOrder()).toEqual(['t2', 't1']))
    expect(mockToast.warning).not.toHaveBeenCalled()
  })

  it('被拒(422 覆盖不符)⇒ 本地回滚旧 order + toast 报拒因', async () => {
    mockReorder.mockResolvedValue({ success: false, errorCode: 'STEER_REORDER_DENIED' })
    render(<SteerNoticeBar notices={[Q1, Q2]} messageId="msg-1" />)
    fireEvent.click(screen.getByTestId('steer-notice-movedown-0'))
    await waitFor(() => expect(mockToast.warning).toHaveBeenCalledWith('无法调整排队顺序'))
    expect(queuedOrder()).toEqual(['t1', 't2'])
  })

  it('异常(网络失败)⇒ 同样回滚 + toast', async () => {
    mockReorder.mockRejectedValue(new Error('network down'))
    render(<SteerNoticeBar notices={[Q1, Q2]} messageId="msg-1" />)
    fireEvent.click(screen.getByTestId('steer-notice-moveup-1'))
    await waitFor(() => expect(mockToast.warning).toHaveBeenCalledWith('无法调整排队顺序'))
    expect(queuedOrder()).toEqual(['t1', 't2'])
  })

  it('竞态豁免回报:orderApplied 比本地排队集合少(条目刚被 drain)⇒ 本地不强改,不 toast', async () => {
    mockReorder.mockResolvedValue({
      success: true,
      data: { ok: true, queued: 1, orderApplied: ['t1'] },
    })
    render(<SteerNoticeBar notices={[Q1, Q2]} messageId="msg-1" />)
    fireEvent.click(screen.getByTestId('steer-notice-movedown-0'))
    await waitFor(() => expect(mockReorder).toHaveBeenCalled())
    // 乐观序 ['t2','t1'] 保留(orderApplied 与本地集合不齐 ⇒ 放弃,等 SSE injected 回执收敛)
    expect(queuedOrder()).toEqual(['t2', 't1'])
    expect(mockToast.warning).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
