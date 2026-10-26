// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 数据大屏(BI)与访问埋点的绑定取证(2026-10-26 立)。
 *
 * 立因:该页此前后端缺 `trend/categories/sources` 三块 ⇒ 打开即白屏;修好后又把访问埋点
 * (`visits`)接进来。本用例钉的是「这些块真的绑上了数据」:访问卡、近 7 日趋势、页面排行
 * 都必须按接口字段渲染 —— 任一字段名再漂一次,这里先红,而不是等用户看到白屏。
 */
// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/components/charts/EChart', () => ({ EChart: () => null }))
vi.mock('@/components/common', () => ({ BackButton: () => null }))
vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))

import { fetchApi } from '@/lib/api'
import BiDashboardPage from '../page'

const payload = {
  totalUsers: 15,
  newUsers: 5,
  totalOrders: 20,
  totalRevenue: 123400,
  activeUsers: 7,
  trend: [{ date: '2026-10-25', revenue: 9900, orders: 2 }],
  categories: [{ name: '类型 0', value: 9900 }],
  sources: [{ name: '(direct)', value: 12 }],
  visits: {
    pv: 120,
    uv: 45,
    pages: [
      { url: '/', pv: 84, uv: 73 },
      { url: '/sso/login', pv: 51, uv: 37 },
    ],
    daily: [
      { date: '2026-10-20', pv: 30, uv: 20 },
      { date: '2026-10-21', pv: 33, uv: 27 },
      { date: '2026-10-22', pv: 0, uv: 0 },
    ],
  },
  stays: [
    { page: '/chat', avgSec: 120.4, samples: 5 },
    { page: '/', avgSec: 63.5, samples: 12 },
  ],
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <BiDashboardPage />
    </QueryClientProvider>,
  )
}

describe('BI 数据大屏', () => {
  beforeEach(() => {
    vi.mocked(fetchApi).mockImplementation((async () => ({
      success: true,
      data: payload,
    })) as never)
  })

  it('访问卡与近 7 日趋势卡按接口字段渲染', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByText('近 7 日访问趋势').length).toBeGreaterThan(0))
    expect(screen.getAllByText('近 7 日浏览量').length).toBeGreaterThan(0)
    expect(screen.getAllByText('近 7 日访客数').length).toBeGreaterThan(0)
    // 卡片主值 120(PV) / 副值 UV 45 —— 证明确实读的是 visits,不是 0 默认值
    await waitFor(() => expect(document.body.textContent).toContain('120'))
    expect(document.body.textContent).toContain('45')
  })

  it('页面访问排行渲染真实 URL 与 UV', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByText('页面访问排行').length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.getAllByText('/sso/login').length).toBeGreaterThan(0))
    expect(document.body.textContent).toContain('UV 73')
  })

  it('页面停留 TOP 按接口字段渲染(均值 + 样本数)', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByText('页面停留时长 TOP').length).toBeGreaterThan(0))
    await waitFor(() => expect(document.body.textContent).toContain('120.4s'))
    expect(document.body.textContent).toContain('n=12')
  })

  it('接口失败时给诚实错误态而不是白屏', async () => {
    vi.mocked(fetchApi).mockImplementation((async () => ({
      success: false,
      error: '用户不存在',
    })) as never)
    renderPage()
    await waitFor(() => expect(screen.getByText(/BI 数据加载失败/)).toBeTruthy())
    // 页面主体仍在(没有掉进错误边界)
    expect(screen.getAllByText('页面访问排行').length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
