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
import { render, screen, waitFor, within } from '@testing-library/react'
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
      { url: '/', platform: 'web', scope: 'public', pv: 84, uv: 73 },
      { url: '/sso/login', platform: 'web', scope: 'auth', pv: 51, uv: 37 },
      { url: '/admin/users', platform: 'web', scope: 'admin', pv: 7, uv: 3 },
      { url: '/rn/Home', platform: 'rn', scope: 'public', pv: 9, uv: 4 },
    ],
    daily: [
      { date: '2026-10-20', pv: 30, uv: 20 },
      { date: '2026-10-21', pv: 33, uv: 27 },
      { date: '2026-10-22', pv: 0, uv: 0 },
    ],
  },
  stays: [
    { page: '/admin/bi-dashboard', platform: 'web', scope: 'admin', avgSec: 1840.2, samples: 2 },
    { page: '/chat', platform: 'web', scope: 'public', avgSec: 120.4, samples: 5 },
    { page: '/rn/Home', platform: 'rn', scope: 'public', avgSec: 63.5, samples: 12 },
  ],
  audience: { newUv: 31, returningUv: 14, activeUv: 45, returningRate: 0.3111 },
  platforms: [
    { platform: 'web', pv: 120, uv: 45 },
    { platform: 'rn', pv: 8, uv: 3 },
    { platform: 'mp', pv: 5, uv: 2 },
    { platform: 'ex', pv: 2, uv: 1 },
  ],
  faces: [
    { scope: 'public', pv: 120, uv: 44 },
    { scope: 'admin', pv: 12, uv: 3 },
    { scope: 'auth', pv: 3, uv: 3 },
  ],
  cities: [
    { city: '杭州市', pv: 96, uv: 30 },
    { city: '(未知)', pv: 39, uv: 20 },
  ],
  browsers: [
    { family: 'chrome', pv: 42, uv: 30 },
    { family: 'wechat', pv: 1, uv: 1 },
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

  it('各端使用量四行齐备,且排行行按接口 platform 字段标端', async () => {
    const { container } = renderPage()
    // 全部查询都限定在本次 container 内:前一例的 DOM 还挂在 body 上,
    // 用 screen/body 全局查会拿旧渲染当证据(waitFor 会当场通过而读到空态)。
    await waitFor(() =>
      expect(within(container).getAllByText('各端使用量').length).toBeGreaterThan(0),
    )
    // 标题是静态文案,必须等读数出现再断言(否则读到的是"暂无分端数据"空态)
    // '网站'会在分端卡与页面排行徽章里各出现一次 ⇒ 一律用 getAllByText
    await waitFor(() => expect(within(container).getAllByText('网站').length).toBeGreaterThan(0))
    for (const label of ['移动端', '小程序', '浏览器插件']) {
      expect(within(container).getAllByText(label).length).toBeGreaterThan(0)
    }
    await waitFor(() =>
      expect(within(container).getAllByText('/rn/Home').length).toBeGreaterThan(0),
    )
    // '/rn/Home' 同时出现在「页面访问排行」与「页面停留 TOP」两行 —— 两处都必须挂移动端徽章
    const rnRows = within(container)
      .getAllByText('/rn/Home')
      .map((el) => el.parentElement?.textContent ?? '')
    expect(rnRows.length).toBeGreaterThanOrEqual(2)
    for (const row of rnRows) expect(row).toContain('移动端')
    expect(within(container).getByText('浏览器插件').parentElement?.textContent).toContain('2 / 1')
  })

  it('访问面占比与地域 TOP 按接口字段渲染(后台/登录页被用了多少次看得见)', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(within(container).getAllByText('杭州市').length).toBeGreaterThan(0))
    const rows = within(container)
      .getAllByText('后台')
      .map((el) => el.parentElement?.textContent ?? '')
    expect(rows.some((r) => r.includes('12'))).toBe(true)
    expect(within(container).getAllByText('登录页').length).toBeGreaterThan(0)
    // 反查不到地域时诚实写 (未知),不编一个城市名
    expect(within(container).getAllByText('(未知)').length).toBeGreaterThan(0)
  })

  it('页面排行与停留 TOP 按接口 scope 标出后台/登录页(前台行不挂徽章)', async () => {
    const { container } = renderPage()
    await waitFor(() =>
      expect(within(container).getAllByText('/admin/bi-dashboard').length).toBeGreaterThan(0),
    )
    const rowTexts = (t: string) =>
      within(container)
        .getAllByText(t)
        .map((el) => el.parentElement?.textContent ?? '')
    // 后台页是「页面访问排行」里的常客:不标出来就没法区分"后台被刷"和"前台热页"
    for (const t of ['/admin/users', '/admin/bi-dashboard']) {
      expect(rowTexts(t).some((r) => r.includes('后台'))).toBe(true)
    }
    expect(rowTexts('/sso/login').some((r) => r.includes('登录页'))).toBe(true)
    // 前台是默认形态 ⇒ 不挂徽章(两枚徽章会把路径挤到截断);未标即前台
    for (const r of rowTexts('/rn/Home')) {
      expect(r).not.toContain('后台')
      expect(r).not.toContain('登录页')
      expect(r).not.toContain('前台')
    }
  })

  it('访客构成与浏览器分布按接口字段渲染(回访率取整、UA 家族有中文档)', async () => {
    renderPage()
    await waitFor(() => expect(screen.getAllByText('访客构成').length).toBeGreaterThan(0))
    expect(screen.getAllByText('新访客').length).toBeGreaterThan(0)
    expect(screen.getAllByText('回访').length).toBeGreaterThan(0)
    // 14 / 45 = 31.11% ⇒ 界面读 31%;这一档漂了说明字段名或算式被动过
    expect(document.body.textContent).toContain('31%')
    expect(screen.getAllByText('浏览器分布').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Chrome').length).toBeGreaterThan(0)
    expect(screen.getAllByText('微信内置浏览器').length).toBeGreaterThan(0)
  })

  it('访客构成/浏览器两块取不到时给"暂无法统计",不塌成 0 也不白屏', async () => {
    vi.mocked(fetchApi).mockImplementation((async () => ({
      success: true,
      data: { ...payload, audience: null, browsers: null },
    })) as never)
    renderPage()
    // 标题是静态文案,数据未到就先渲染 ⇒ 必须等读数本身出现
    await waitFor(() => expect(screen.getAllByText('暂无法统计').length).toBeGreaterThanOrEqual(2))
    // 其余块照常出:两腿为 null 不得把访问卡一起打死
    expect(screen.getAllByText('近 7 日访客数').length).toBeGreaterThan(0)
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
