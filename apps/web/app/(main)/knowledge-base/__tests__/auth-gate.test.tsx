// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识库列表页 · 登录态门三态测试(G-932 真缺陷格收口)
 *
 * 立因:本页两枚 useQuery 已带 `enabled: allow`(抢跑那一半 HEAD 已闭),
 * 但渲染面写成 `!allow ⇒ AuthGatePrompt(「请先登录」)`,而 `allow = ready && isAuthenticated`
 * 把"登录态确认中(ready=false,冷启动 bootstrap 还在静默刷新)"一并算成未登录:
 * 已登录用户冷启动进知识库先看到登录引导。补 ready 这一维,与签到助手 HEAD 三态同型。
 *
 * react-query 走真实 QueryClientProvider(不 mock useQuery),这样"未就绪不发查询"
 * 判的是 enabled 的生效结果,而不是我对桩的口头保证。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const authGate = vi.hoisted(() => ({ state: { ready: true, allow: true } }))
vi.mock('@/hooks/use-auth-gate', () => ({
  useAuthGate: () => authGate.state,
}))

const apiOrThrow = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', () => ({
  apiOrThrow: apiOrThrow,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <a href="/mock-link">{children}</a>,
}))

vi.mock('@/components/common', () => ({
  AuthGatePrompt: ({ message }: { message: string }) => <div>{message}</div>,
}))

vi.mock('@ihui/ui-react', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Input: (props: Record<string, unknown>) => <input {...(props as object)} />,
}))

vi.mock('lucide-react', () => ({
  BookOpen: () => <svg />,
  Search: () => <svg />,
  FileText: () => <svg />,
  ChevronLeft: () => <svg />,
  ChevronRight: () => <svg />,
  Loader2: () => <svg />,
}))

import KnowledgeBasePageClient from '../PageClient'

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <KnowledgeBasePageClient />
    </QueryClientProvider>,
  )
}

describe('知识库列表页 · 登录态门三态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authGate.state = { ready: true, allow: true }
    apiOrThrow.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('/categories')
          ? { list: [{ id: 'c1', name: 'cat-1' }] }
          : { list: [], total: 0 },
      ),
    )
  })

  afterEach(() => {
    cleanup()
    authGate.state = { ready: true, allow: true }
  })

  it('登录态确认中(ready=false)不误显「请先登录」,显加载态且不发查询', async () => {
    authGate.state = { ready: false, allow: false }
    renderPage()

    await waitFor(() => expect(screen.queryByText('loginRequired')).toBeNull())
    expect(screen.getByText('loading')).toBeTruthy()
    expect(apiOrThrow).not.toHaveBeenCalled()
  })

  it('确未登录(ready=true ∧ allow=false)显登录引导且不发注定 401 的查询', async () => {
    authGate.state = { ready: true, allow: false }
    renderPage()

    await waitFor(() => expect(screen.getByText('loginRequired')).toBeTruthy())
    expect(apiOrThrow).not.toHaveBeenCalled()
  })

  it('门开(allow 由假翻真)后自动补拉分类与列表', async () => {
    authGate.state = { ready: false, allow: false }
    const { rerender } = renderPage()
    expect(apiOrThrow).not.toHaveBeenCalled()

    authGate.state = { ready: true, allow: true }
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <KnowledgeBasePageClient />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(apiOrThrow).toHaveBeenCalled())
    expect(apiOrThrow).toHaveBeenCalledWith('/api/knowledge-base/categories')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
