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

import { PendingCommandHint } from '../pending-command-hint'

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

describe('PendingCommandHint', () => {
  afterEach(() => {
    cleanup()
  })

  it('账本为空时不占位', () => {
    listed.mockReturnValue([])
    const { container } = render(<PendingCommandHint conversationId="conv-1" revision={false} />)
    expect(container.querySelector('[data-testid="pending-command-hint"]')).toBeNull()
  })

  it('列出当前会话尚未对账的预览,不提供第二条发送按钮', () => {
    listed.mockReturnValue([
      record({ commandId: 'a', preview: '/diff' }),
      record({ commandId: 'b', preview: '继续修登录' }),
    ])
    render(<PendingCommandHint conversationId="conv-1" revision={false} />)
    expect(screen.getByTestId('pending-command-hint')).toBeTruthy()
    expect(screen.getByText('duplicatePendingTitle')).toBeTruthy()
    expect(screen.getByText('duplicatePendingDesc')).toBeTruthy()
    const previews = screen
      .getAllByTestId('pending-command-preview')
      .map((node) => node.textContent)
    expect(previews).toEqual(['/diff', '继续修登录'])
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('revision 翻转后重读账本', () => {
    listed.mockReturnValue([record({ commandId: 'a', preview: '还在' })])
    const view = render(<PendingCommandHint conversationId="conv-1" revision />)
    expect(view.getByText('还在')).toBeTruthy()
    listed.mockReturnValue([])
    view.rerender(<PendingCommandHint conversationId="conv-1" revision={false} />)
    expect(view.queryByTestId('pending-command-hint')).toBeNull()
  })

  it('无会话时不读账本', () => {
    listed.mockClear()
    render(<PendingCommandHint conversationId={null} revision={false} />)
    expect(listed).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
