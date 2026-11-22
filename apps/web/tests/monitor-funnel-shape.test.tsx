// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
//
// /admin/monitor/funnel 的本地投影与三态渲染锁(2026-11-01 立)。
//
// 钉的是四件事,全是这个页面**今天真实坏掉**的地方:
//  ① 端点改读真漏斗 GET /api/earnings/funnel(返回 [{stage,count}] 序列)后,页面要的
//     stages/totalUsers/convertedUsers/conversionRate 必须由本地投影单源算出;
//  ② 空数组走空态而不是崩;
//  ③ 分母为 0 时读数走「未判定」,页面上不得出现字面量 NaN(NaN.toFixed(2) → "NaN"
//     是这张页原来的第二枚假读数;摘掉守卫这条必翻红 ⇒ 阳性对照);
//  ④ 接口失败如实显示「数据源不可达」,不得静默回落成空态(空态 = "没有数据",
//     与"取不到数据"是两件事)。
//
// 原先它请求 /api/admin/monitor/funnel/signup —— 后端要求 :id 是 UUID,四档字面量一律 404,
// data 恒 undefined,页面永远停在「暂无漏斗数据」。那条假路由已整条摘除。
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

const apiOrThrowMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
  apiOrThrow: apiOrThrowMock,
}))

vi.mock('@/components/common', () => ({ BackButton: () => null }))

import FunnelPage from '../app/(main)/admin/monitor/funnel/page'

/** GET /api/earnings/funnel 的真实返回形状(4 档,顺序即漏斗顺序)。 */
const FUNNEL_STATS = [
  { stage: 'register', count: 23 },
  { stage: 'active', count: 2 },
  { stage: 'byok', count: 1 },
  { stage: 'vip', count: 0 },
]

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <FunnelPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('/admin/monitor/funnel 本地投影与三态', () => {
  it('① 真漏斗四档 → 汇总卡出齐,conversionRate 读数 = 0.00%(末档 0 / 首档 23)', async () => {
    apiOrThrowMock.mockResolvedValue(FUNNEL_STATS)

    const { container } = wrap()

    // 首档 23 ⇒ 分母存在 ⇒ 转化率是有定义的读数
    await waitFor(() => expect(screen.getByText('0.00%')).toBeTruthy())

    expect(screen.getByText('总用户')).toBeTruthy()
    expect(screen.getByText('转化用户')).toBeTruthy()
    expect(screen.getByText('转化率')).toBeTruthy()

    // totalUsers = stats[0].count,convertedUsers = stats.at(-1).count
    expect(apiOrThrowMock).toHaveBeenCalledWith('/api/earnings/funnel')
    expect(container.textContent).toContain('23')
    expect(container.textContent).not.toContain('NaN')

    // 档位码 → 显示名由本地投影补(端点只给 register/active/byok/vip)
    expect(screen.getByText('注册')).toBeTruthy()
    expect(screen.getByText('活跃')).toBeTruthy()
    expect(screen.getByText('自带 Key')).toBeTruthy()
    expect(screen.getByText('会员')).toBeTruthy()
    // 首档占比 100%
    expect(screen.getByText('(100.0%)')).toBeTruthy()
  })

  it('② 空数组 → 走「暂无漏斗数据」空态,不崩、不弹汇总卡', async () => {
    apiOrThrowMock.mockResolvedValue([])

    const { container } = wrap()

    await waitFor(() => expect(screen.getByText('暂无漏斗数据')).toBeTruthy())
    // 没有档位 ⇒ 连分母都不存在,汇总卡不得凭空立三张(那会是三个假读数)
    expect(screen.queryByText('总用户')).toBeNull()
    expect(screen.queryByText('转化率')).toBeNull()
    expect(container.textContent).not.toContain('NaN')
  })

  it('③ totalUsers=0 → 读数「未判定」,页面上不出现 NaN(阳性对照:摘掉分母守卫即翻红)', async () => {
    apiOrThrowMock.mockResolvedValue([
      { stage: 'register', count: 0 },
      { stage: 'active', count: 0 },
      { stage: 'byok', count: 0 },
      { stage: 'vip', count: 0 },
    ])

    const { container } = wrap()

    await waitFor(() => expect(screen.getAllByText('未判定').length).toBeGreaterThan(0))
    // NaN 的任何形态都不许出现在页面上(0/0 → NaN → toFixed() → "NaN")
    expect(container.textContent).not.toMatch(/NaN/)
    expect(container.textContent).not.toMatch(/Infinity/)
    // 未判定 ≠ 空态:数据源给回了四档,只是分母缺失
    expect(screen.queryByText('暂无漏斗数据')).toBeNull()
  })

  it('④ 接口失败 → 如实「数据源不可达」,不得静默回落成空态', async () => {
    apiOrThrowMock.mockRejectedValue(new Error('connect ECONNREFUSED'))

    wrap()

    await waitFor(() => expect(screen.getByText(/数据源不可达/)).toBeTruthy())
    expect(screen.queryByText('暂无漏斗数据')).toBeNull()
    expect(screen.queryByText(/NaN/)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
