// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号代理管理页(2026-10-27 立)契约取证。
 *
 * 钉两件事:
 * 1. 列表只渲染后端脱敏值 —— 页面代码里不存在把明文回显的旁路;
 * 2. 保存只提交 `proxyUrl` 一个字段(防止像编辑弹窗那样连带覆盖名称/权重),
 *    且协议校验不通过时不发请求。
 */
// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (k: string) => k,
}))
vi.mock('@/components/common', () => ({ BackButton: () => null }))
vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { fetchApi } from '@/lib/api'
import { toast } from 'sonner'
import AccountProxyPage from '../page'

const rows = [
  {
    id: 'acc-1',
    providerCode: 'trae',
    uid: 'uid-alpha-123456789',
    name: '账号甲',
    isEnabled: true,
    healthStatus: 'healthy',
    hasProxy: true,
    proxyUrlMasked: 'http://***@127.0.0.1:7897',
    lastUsedAt: null,
  },
  {
    id: 'acc-2',
    providerCode: 'workbuddy',
    uid: 'uid-beta',
    name: '账号乙',
    isEnabled: false,
    healthStatus: 'unknown',
    hasProxy: false,
    proxyUrlMasked: null,
    lastUsedAt: null,
  },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AccountProxyPage />
    </QueryClientProvider>,
  )
}

function mockList() {
  vi.mocked(fetchApi).mockImplementation((async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return { success: true, data: { id: 'acc-2' } }
    return { success: true, data: { list: rows, total: 2, page: 1, pageSize: 20 } }
  }) as never)
}

describe('账号代理管理页', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.mocked(fetchApi).mockReset()
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
    mockList()
  })

  it('列表只展示脱敏代理或"直连",并请求运营池账号', async () => {
    renderPage()

    await screen.findByText('账号甲')
    expect(screen.getByText('http://***@127.0.0.1:7897')).toBeTruthy()
    expect(screen.getAllByText('直连').length).toBeGreaterThan(0)
    const firstUrl = vi.mocked(fetchApi).mock.calls[0]?.[0] as string
    expect(firstUrl).toContain('/api/admin/relay/accounts?page=1&pageSize=20')
    expect(firstUrl).not.toContain('hasProxy')
  })

  it('设置代理只提交 proxyUrl 一个字段', async () => {
    renderPage()
    await screen.findByText('账号乙')

    fireEvent.click(screen.getByRole('button', { name: '设置代理' }))
    fireEvent.change(screen.getByLabelText('代理地址'), {
      target: { value: 'socks5://127.0.0.1:1080' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      const put = vi
        .mocked(fetchApi)
        .mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')
      expect(put).toBeTruthy()
      expect(put![0]).toBe('/api/admin/relay/accounts/acc-2')
      expect(JSON.parse((put![1] as RequestInit).body as string)).toEqual({
        proxyUrl: 'socks5://127.0.0.1:1080',
      })
    })
  })

  it('协议不受支持时不发请求并提示', async () => {
    renderPage()
    await screen.findByText('账号乙')

    fireEvent.click(screen.getByRole('button', { name: '设置代理' }))
    fireEvent.change(screen.getByLabelText('代理地址'), {
      target: { value: 'ftp://127.0.0.1:21' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled())
    expect(
      vi
        .mocked(fetchApi)
        .mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'PUT'),
    ).toBe(false)
  })
})
