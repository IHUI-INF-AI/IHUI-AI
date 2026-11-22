// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 侧栏任务列表卡片的登录态三态判定(2026-10-26)——与 src/tests/auth-ready-gate-pages.test.tsx 同族。
//
// 缺陷形态:sidebar-chat-history 原写 `if (!ready || !isAuthenticated)` 直接把「还没查完」
// 渲染成「请先登录」行;冷启动静默续期期间,凭据有效的用户看到侧栏"请登录"→ 以为被踢出。
// 修复口径对齐 admin/layout:!ready ⇒ 同形加载占位;ready && !isAuthenticated ⇒ 才给登录引导。
//
// 摘掉 `!ready` 那一支 ⇒ 第 1 例当场翻红(「请先登录」出现在校验中)。
import { render, cleanup, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ ready: false, fetchApi: vi.fn() }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'loginRequired' ? '请先登录' : key),
  useLocale: () => 'zh-CN',
}))
vi.mock('@/hooks/use-auth-bootstrap', () => ({
  useAuthBootstrap: () => ({ ready: h.ready, isAuthenticated: false, error: null }),
}))
vi.mock('@/lib/api', () => ({ fetchApi: h.fetchApi, apiOrThrow: vi.fn() }))
// 早退分支不渲染列表 UI,以下重型子模块只需存在(避免把导出/对话框整套拉进测试面)
vi.mock('@/components/chat/conversation-list', () => ({
  ConversationAttentionBadges: () => null,
  ConversationList: () => null,
}))
vi.mock('@/components/chat/conversation-export', () => ({
  downloadConversationJson: vi.fn(),
  downloadConversationSnapshot: vi.fn(),
  downloadConversationShareCard: vi.fn(),
  copyConversationShareLink: vi.fn(),
  printConversationPdf: vi.fn(),
}))
vi.mock('@/components/chat/issue-bind-dialog', () => ({
  IssueBindDialog: () => null,
  LinkedIssueBadge: () => null,
  resolveIssueBinding: () => null,
}))
vi.mock('@/components/chat/conversation-org-dialog', () => ({
  ConversationOrgDialog: () => null,
}))
vi.mock('@/components/sidebar/move-to-group-dialog', () => ({
  MoveToGroupDialog: () => null,
}))
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children?: unknown }) => children ?? null,
}))

import { SidebarChatHistory } from '@/components/sidebar-chat-history'
import { useAuthStore } from '@/stores/auth'

function renderSidebar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SidebarChatHistory collapsed={false} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  h.ready = false
  h.fetchApi.mockReset()
  useAuthStore.setState({ isAuthenticated: false })
})

afterEach(() => {
  cleanup()
})

describe('侧栏任务列表登录态三态', () => {
  it('ready=false ⇒ 卡片不得出现「请先登录」(校验中只给加载行)', () => {
    h.ready = false
    renderSidebar()
    expect(screen.queryByText('请先登录')).toBeNull()
    // 同形占位在 loading 分支(t('loading') 键透传断言)
    expect(screen.getByText('loading')).toBeTruthy()
  })

  it('ready=true 且未登录 ⇒ 「请先登录」必须仍在(正向对照,判据未放宽)', () => {
    h.ready = true
    renderSidebar()
    expect(screen.getByText('请先登录')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
