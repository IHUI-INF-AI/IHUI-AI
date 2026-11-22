// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OAuth 授权页 deny 守卫(2026-10-31 安全强化第 14 批 M2)回归钉。
 *
 * 钉的是「守卫不误杀合法路径」:服务端校验接口成功(info 已加载,redirect_uri
 * 已过 redirectUris 精确白名单)时,点「拒绝」必须放行跳转 —— 不得出现守卫的
 * 阻止文案。守卫分支本身(info=null)在当前渲染结构下不可达(error 提前 return
 * 无按钮),不在此测试射程内。
 */
// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'

vi.mock('next-intl', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const file = path.resolve(process.cwd(), '../../packages/i18n/messages/web/zh-CN.json')
  const messages = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    oauth: Record<string, string>
  }
  const ns = messages.oauth
  return {
    useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
      const raw = ns[key] ?? key
      return vars ? raw.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? '')) : raw
    },
    useLocale: () => 'zh-CN',
  }
})

const searchParams = new Map<string, string>([
  ['client_id', 'client-1'],
  ['redirect_uri', 'https://app.example.com/callback'],
  ['state', 'st-1'],
])

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => ({ get: (k: string) => searchParams.get(k) ?? '' }),
}))

vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))
vi.mock('@/hooks/use-auth-bootstrap', () => ({
  useAuthBootstrap: () => ({ ready: true, token: 'tok' }),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { token: string }) => unknown) => sel({ token: 'tok' }),
}))
vi.mock('@/stores/login-dialog', () => ({
  useLoginDialogStore: { getState: () => ({ open: vi.fn() }) },
}))

import { fetchApi } from '@/lib/api'
import PageClient from '../PageClient'

describe('OAuth authorize deny 守卫(第 14 批 M2)', () => {
  beforeEach(() => {
    vi.mocked(fetchApi).mockReset()
    // deny 放行分支会 window.location.href = 外部回调域,happy-dom 的真实导航
    // 在测试环境报 "Not implemented";用可写 stub 接住赋值,不真导航。
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/' },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('服务端校验通过(info 已加载)时点拒绝 → 放行,不出现阻止文案', async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      success: true,
      data: { app: { name: 'Example App', clientId: 'client-1' }, scopes: [] },
    })
    render(<PageClient />)
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeNull())
    // 服务端校验通过后,deny 按钮可达;点击不出现守卫的阻止文案
    const denyButton = screen.getByRole('button', { name: /拒绝|deny|cancel/i })
    fireEvent.click(denyButton)
    expect(screen.queryByText(/未通过服务端校验/)).toBeNull()
  })

  it('服务端校验失败 → 渲染错误态,deny 按钮不可达(结构性防线)', async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      success: false as const,
      error: 'redirect_uri 不在白名单',
    })
    render(<PageClient />)
    await waitFor(() => expect(screen.getByText('redirect_uri 不在白名单')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /拒绝|deny|cancel/i })).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
