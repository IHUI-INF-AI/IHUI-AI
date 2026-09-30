// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D193 决策收件箱装车证明(2026-09-30 用户拍板,小切口):
// ① NotificationCenter「待我决策」区:有条目渲染(摘要/类型/时间)、空态、未传隐藏;
// ② SidebarUserRow 装车链:打开站内消息 → 取数 → 点击条目跳会话
//    (setConversationId + openPanel + 关弹窗 + 收起移动端侧栏,与 sidebar-chat-history
//    handleSelect 同一机制)。
// 断言一律用裸 DOM 匹配器(本仓 apps/web 未装 @testing-library/jest-dom)。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => ({
  listPendingDecisions: vi.fn(),
  setConversationId: vi.fn(),
  openPanel: vi.fn(),
  onCloseMobile: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations:
    (_ns: string) =>
    (key: string) =>
      key,
}))

vi.mock('@ihui/api-client', () => ({ listPendingDecisions: h.listPendingDecisions }))

// ---------------------------------------------------------------------------
// NotificationCenter(展示层,props 驱动)
// ---------------------------------------------------------------------------
import { NotificationCenter, type PendingDecisionView } from '../NotificationCenter'

afterEach(cleanup)

const DECISIONS: PendingDecisionView[] = [
  {
    id: 'appr_1',
    threadId: 'thr_conv1',
    type: 'tool_approval',
    summary: 'run_command: {"cmd": "git push"}',
    createdAt: '2026-09-30T08:00:00Z',
  },
  {
    id: 'eli_1',
    threadId: 'thr_conv2',
    type: 'elicitation',
    summary: '',
    createdAt: null,
  },
]

describe('D193 NotificationCenter 待我决策区', () => {
  it('有条目时渲染摘要/线程/类型与计数徽章;点击回调带回原条目', () => {
    const onItemClick = vi.fn()
    render(
      <NotificationCenter
        items={[]}
        pendingDecisions={DECISIONS}
        onDecisionItemClick={onItemClick}
      />,
    )
    const section = screen.getByTestId('decision-inbox-section')
    expect(section.textContent).toContain('myPendingDecisions')
    expect(section.textContent).toContain('2')
    expect(section.textContent).toContain('run_command: {"cmd": "git push"}')
    expect(section.textContent).toContain('thr_conv1')
    // 空摘要条目落类型标签(elicitation)
    expect(section.textContent).toContain('decisionTypeElicitation')
    const items = screen.getAllByTestId('decision-inbox-item')
    expect(items).toHaveLength(2)
    const first = items[0]!
    expect(first.getAttribute('data-thread-id')).toBe('thr_conv1')
    fireEvent.click(first)
    expect(onItemClick).toHaveBeenCalledTimes(1)
    expect(onItemClick).toHaveBeenCalledWith(DECISIONS[0])
  })

  it('空数组渲染空态文案', () => {
    render(<NotificationCenter items={[]} pendingDecisions={[]} />)
    expect(screen.getByTestId('decision-inbox-empty').textContent).toBe('pendingDecisionsEmpty')
    expect(screen.queryByTestId('decision-inbox-item')).toBeNull()
  })

  it('不传 pendingDecisions(未取数/游客)整区隐藏', () => {
    render(<NotificationCenter items={[]} />)
    expect(screen.queryByTestId('decision-inbox-section')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// SidebarUserRow 装车链(弹窗打开 → 取数 → 点击跳会话)
// ---------------------------------------------------------------------------

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}))
vi.mock('@/stores/navigation', () => ({
  useNavigateWithProgress: () => vi.fn(),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      user: { nickname: 'Alice', avatar: null, phone: '' },
      isAuthenticated: true,
      logout: vi.fn(),
    }),
}))
vi.mock('@/stores/login-dialog', () => ({
  useLoginDialogStore: { getState: () => ({ open: vi.fn() }) },
}))
vi.mock('@/hooks/use-mounted', () => ({ useMounted: () => true }))
vi.mock('@/stores/language', () => ({
  // SidebarUserRow 无 selector 整体解构:sel 缺省时返回全量 state
  useLanguageStore: (sel?: (s: Record<string, unknown>) => unknown) => {
    const state = { locale: 'zh-CN', setLocale: vi.fn() }
    return sel ? sel(state) : state
  },
}))
vi.mock('@/stores/notification', () => ({
  useNotificationStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ notifications: [], unreadCount: 0, markAllAsRead: vi.fn() }),
}))
vi.mock('@/stores/chat', () => {
  const state = { conversationId: null as string | null, setConversationId: h.setConversationId }
  const useChatStore = (sel: (s: typeof state) => unknown) => sel(state)
  Object.assign(useChatStore, { getState: () => state })
  return { useChatStore }
})
vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: (sel: (s: { openPanel: () => void }) => unknown) =>
    sel({ openPanel: h.openPanel }),
}))
vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ trackClick: vi.fn() }),
}))
vi.mock('@ihui/shared/hooks', () => ({ useDownloadTrack: () => vi.fn() }))
vi.mock('@/lib/downloads', () => ({
  DOWNLOADS: [],
  isDownloadAvailable: () => false,
  isExternalDownloadHref: () => false,
}))
vi.mock('@/components/data/Avatar', () => ({ Avatar: () => null }))
vi.mock('@/components/sidebar/nav-data', () => ({ LANGUAGES: [] }))
// Dropdown 渲染成可点的按钮(跳过 divider 项),Modal 透传 open 态 —— 挂载级走真实弹窗开关。
vi.mock('@/components/feedback', () => ({
  Dropdown: ({
    items,
  }: {
    items: Array<{ key: string; divider?: boolean; label?: unknown; onSelect?: () => void }>
  }) => (
    <div>
      {items
        .filter((it) => !it.divider && typeof it.onSelect === 'function')
        .map((it) => (
          <button key={it.key} data-testid={`dd-${it.key}`} onClick={it.onSelect}>
            {it.key}
          </button>
        ))}
    </div>
  ),
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="d193-modal">{children}</div> : null,
}))

import { SidebarUserRow } from '../../sidebar/SidebarUserRow'

describe('D193 SidebarUserRow 决策收件箱装车链', () => {
  beforeEach(() => {
    h.listPendingDecisions.mockReset()
    h.setConversationId.mockReset()
    h.openPanel.mockReset()
    h.onCloseMobile.mockReset()
  })

  it('打开站内消息弹窗即取数并渲染;点击条目切会话 + 开面板 + 关弹窗', async () => {
    h.listPendingDecisions.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'appr_1',
            threadId: 'conv-1',
            type: 'tool_approval',
            summary: 'run_command: git push',
            createdAt: '2026-09-30T08:00:00Z',
          },
        ],
        total: 1,
      },
    })
    render(<SidebarUserRow collapsed={false} onCloseMobile={h.onCloseMobile} />)
    fireEvent.click(screen.getByTestId('dd-messages'))
    const modal = await screen.findByTestId('d193-modal')
    await waitFor(() => expect(screen.getByTestId('decision-inbox-item')).toBeTruthy())
    expect(h.listPendingDecisions).toHaveBeenCalledTimes(1)
    expect(modal.textContent).toContain('run_command: git push')
    fireEvent.click(screen.getByTestId('decision-inbox-item'))
    expect(h.setConversationId).toHaveBeenCalledWith('conv-1')
    expect(h.openPanel).toHaveBeenCalledTimes(1)
    // 弹窗关闭(真实 Modal mock 不再渲染)+ 移动端侧栏收起
    expect(h.onCloseMobile).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByTestId('d193-modal')).toBeNull())
  })

  it('取数失败静默落空态(只读查询不打扰)', async () => {
    h.listPendingDecisions.mockRejectedValue(new Error('502'))
    render(<SidebarUserRow collapsed={false} onCloseMobile={h.onCloseMobile} />)
    fireEvent.click(screen.getByTestId('dd-messages'))
    await screen.findByTestId('d193-modal')
    await waitFor(() => expect(screen.getByTestId('decision-inbox-empty')).toBeTruthy())
    expect(screen.getByTestId('decision-inbox-empty').textContent).toBe('pendingDecisionsEmpty')
  })

  it('无 threadId 的条目仍可点击:开面板、不切会话', async () => {
    h.listPendingDecisions.mockResolvedValue({
      success: true,
      data: {
        items: [
          { id: 'eli_x', threadId: null, type: 'elicitation', summary: '', createdAt: null },
        ],
        total: 1,
      },
    })
    render(<SidebarUserRow collapsed={false} onCloseMobile={h.onCloseMobile} />)
    fireEvent.click(screen.getByTestId('dd-messages'))
    await waitFor(() => expect(screen.getByTestId('decision-inbox-item')).toBeTruthy())
    fireEvent.click(screen.getByTestId('decision-inbox-item'))
    expect(h.setConversationId).not.toHaveBeenCalled()
    expect(h.openPanel).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
