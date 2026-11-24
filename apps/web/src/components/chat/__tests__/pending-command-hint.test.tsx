// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PendingCommandRecord } from '@ihui/shared/chat/pending-command-registry'

const listed = vi.hoisted(() => vi.fn<(conversationId: string) => PendingCommandRecord[]>())

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/use-chat/pending-send', () => ({
  listPendingSends: (conversationId: string) => listed(conversationId),
}))

import { matchPendingDraft, PendingCommandHint } from '../pending-command-hint'

function record(
  partial: Partial<PendingCommandRecord> & Pick<PendingCommandRecord, 'commandId'>,
): PendingCommandRecord {
  return {
    commandId: partial.commandId,
    conversationId: partial.conversationId ?? 'conv-1',
    preview: partial.preview ?? '/review',
    firstRegisteredAt: partial.firstRegisteredAt ?? 1,
  }
}

describe('matchPendingDraft', () => {
  it('草稿太短不作判,避免每个字都弹提示', () => {
    expect(matchPendingDraft([record({ commandId: 'a', preview: '继续修登录' })], '继续')).toEqual(
      [],
    )
  })

  it('草稿正在打这条(前缀)或草稿比预览更长(粘贴完整)都算可能重复', () => {
    const rows = [
      record({ commandId: 'a', preview: '/review' }),
      record({ commandId: 'b', preview: '继续修登录' }),
    ]
    expect(matchPendingDraft(rows, '/rev').map((r) => r.commandId)).toEqual(['a'])
    expect(matchPendingDraft(rows, '/review --diff').map((r) => r.commandId)).toEqual(['a'])
  })
})

describe('PendingCommandHint', () => {
  afterEach(() => {
    cleanup()
  })

  it('草稿与任何未确认条目都无关时整块零占位', () => {
    listed.mockReturnValue([record({ commandId: 'a', preview: '/diff' })])
    const { container } = render(
      <PendingCommandHint conversationId="conv-1" revision={false} draft="帮我写周报" />,
    )
    expect(container.querySelector('[data-testid="pending-command-hint"]')).toBeNull()
  })

  it('账本为空时不占位', () => {
    listed.mockReturnValue([])
    const { container } = render(
      <PendingCommandHint conversationId="conv-1" revision={false} draft="/diff" />,
    )
    expect(container.querySelector('[data-testid="pending-command-hint"]')).toBeNull()
  })

  it('草稿正要重复那条时才显示:折叠头一行,右侧是那条预览', () => {
    listed.mockReturnValue([record({ commandId: 'a', preview: '/diff --staged' })])
    render(<PendingCommandHint conversationId="conv-1" revision={false} draft="/diff" />)
    expect(screen.getByTestId('pending-command-hint')).toBeTruthy()
    expect(screen.getByText('duplicatePendingTitle')).toBeTruthy()
    expect(screen.getByText('duplicatePendingDesc')).toBeTruthy()
    expect(screen.getByTestId('pending-command-hint-summary').textContent).toBe('/diff --staged')
    // 只有一个交互控件 = 折叠头(默认折叠),不提供重发/放行按钮
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]?.getAttribute('aria-expanded')).toBe('false')
  })

  it('多条同一前缀时标题带条数', () => {
    listed.mockReturnValue([
      record({ commandId: 'a', preview: '/review a' }),
      record({ commandId: 'b', preview: '/review b' }),
    ])
    render(<PendingCommandHint conversationId="conv-1" revision={false} draft="/review" />)
    expect(screen.getByText('duplicatePendingTitle · 2')).toBeTruthy()
    const previews = screen
      .getAllByTestId('pending-command-preview')
      .map((node) => node.textContent)
    expect(previews).toEqual(['/review a', '/review b'])
  })

  it('revision 翻转后重读账本', () => {
    listed.mockReturnValue([record({ commandId: 'a', preview: '本项目是干嘛的' })])
    const view = render(<PendingCommandHint conversationId="conv-1" revision draft="本项目是" />)
    expect(view.getByTestId('pending-command-hint-summary').textContent).toBe('本项目是干嘛的')
    listed.mockReturnValue([])
    view.rerender(<PendingCommandHint conversationId="conv-1" revision={false} draft="本项目是" />)
    expect(view.queryByTestId('pending-command-hint')).toBeNull()
  })

  it('无会话时不读账本', () => {
    listed.mockClear()
    render(<PendingCommandHint conversationId={null} revision={false} draft="/diff" />)
    expect(listed).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
