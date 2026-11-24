// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 登录态三态判定(2026-10-26):「auth 还没查完(ready=false)」与「确认未登录」不得画成同一件事。
//
// 立因:一批页面写 `!ready || !isAuthenticated` 直接渲染「请先登录」,而冷启动 bootstrap 是
// 异步的(httpOnly refresh cookie 静默续期),凭据有效的用户在这一格被画成"被踢出"→ 手动重登。
// 口径对齐已修好的 app/(main)/admin/layout.tsx:校验中只给加载态,终态才给登录引导。
//
// 每页钉两条:①ready=false ⇒ 页面上不得出现「请先登录」;②ready=true 且未登录 ⇒ 必须仍出现
// (正向对照,判据没有被放宽)。摘掉源码里 `!ready` 那一支 ⇒ ①当场翻红(旧缺陷形态即①)。
import * as React from 'react'
import { render, cleanup, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  ready: false,
  fetchApi: vi.fn(),
  apiOrThrow: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('next-intl', () => ({
  // loginRequired 映射成真实文案,断言直接盯「请先登录」;其余键透传,断言用键名
  useTranslations: () => (key: string) => (key === 'loginRequired' ? '请先登录' : key),
  useLocale: () => 'zh-CN',
}))
vi.mock('@/hooks/use-auth-bootstrap', () => ({
  useAuthBootstrap: () => ({ ready: h.ready, isAuthenticated: false, error: null }),
}))
vi.mock('@/lib/api', () => ({ fetchApi: h.fetchApi, apiOrThrow: h.apiOrThrow }))
vi.mock('@/components/common', () => ({ BackButton: () => null }))
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Alert: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
}))
vi.mock('@/components/chat/conversation-list', () => ({
  ConversationList: () => <div>会话列表</div>,
}))
vi.mock('@/lib/login-dialog-trigger', () => ({ openLoginDialogOnce: vi.fn() }))

import ChatHistoryPage from '../../app/(main)/chat/history/page'
import ChatFavoritesPage from '../../app/(main)/chat/favorites/page'
import MemberHistoryPage from '../../app/(main)/member/history/page'
import { useAuthStore } from '@/stores/auth'

function renderPage(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  h.ready = false
  h.fetchApi.mockReset()
  h.apiOrThrow.mockReset()
  useAuthStore.setState({ isAuthenticated: false })
})

afterEach(() => {
  cleanup()
})

describe('/chat/history 登录态三态', () => {
  it('ready=false ⇒ 不得出现「请先登录」(校验中只给加载态)', () => {
    h.ready = false
    renderPage(<ChatHistoryPage />)
    expect(screen.queryByText('请先登录')).toBeNull()
    // 加载态在场(该分支渲染的是既有 t('loading') 同形骨架)
    expect(screen.getByText('loading')).toBeTruthy()
  })

  it('ready=true 且未登录 ⇒ 「请先登录」必须仍在(正向对照,判据未放宽)', () => {
    h.ready = true
    renderPage(<ChatHistoryPage />)
    expect(screen.getAllByText('请先登录').length).toBeGreaterThanOrEqual(1)
  })
})

describe('/chat/favorites 登录态三态', () => {
  it('ready=false ⇒ 不得出现「请先登录」(校验中只给加载态)', () => {
    h.ready = false
    renderPage(<ChatFavoritesPage />)
    expect(screen.queryByText('请先登录')).toBeNull()
    expect(screen.getByText('loading')).toBeTruthy()
  })

  it('ready=true 且未登录 ⇒ 「请先登录」必须仍在(正向对照,判据未放宽)', () => {
    h.ready = true
    renderPage(<ChatFavoritesPage />)
    expect(screen.getAllByText('请先登录').length).toBeGreaterThanOrEqual(1)
  })
})

describe('/member/history 登录态三态', () => {
  it('ready=false ⇒ 不得出现「请先登录」(校验中只给"正在校验…"同形占位)', () => {
    h.ready = false
    renderPage(<MemberHistoryPage />)
    expect(screen.queryByText('请先登录后查看浏览历史')).toBeNull()
    expect(screen.getByText('正在校验登录状态...')).toBeTruthy()
  })

  it('ready=true 且未登录 ⇒ 「请先登录后查看浏览历史」必须仍在(正向对照)', () => {
    h.ready = true
    renderPage(<MemberHistoryPage />)
    expect(screen.getByText('请先登录后查看浏览历史')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
