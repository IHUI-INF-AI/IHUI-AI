// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
//
// 2026-10-28 线上事故回归锁:/admin/statistics 首屏必崩(错误边界「管理后台发生错误」)。
// 成因:2026-08-06 `a2ecdb806a3 消除 mock 数据冒充` 把 `const d = data ?? MOCK` 改成
// `const d = data!` —— `!` 只是编译期断言,运行时 `data` 首帧是 undefined,
// 组件体里 `d.overview` / `d.userGrowth` 当场抛 TypeError,渲染期即被 admin error.tsx 接住。
// 本档钉的是「取数未完成时必须渲染加载态」,而不是「崩溃文案长什么样」。
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

const fetchApiMock = vi.hoisted(() => vi.fn())
const apiOrThrowMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({
  fetchApi: fetchApiMock,
  apiOrThrow: apiOrThrowMock,
}))

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

vi.mock('@/components/charts/EChart', () => ({
  EChart: () => <div data-testid="echart" />,
}))

vi.mock('@/components/common', () => ({ BackButton: () => null }))

vi.mock('../../app/(main)/admin/statistics/StatisticsFilter', () => ({
  StatisticsFilter: () => null,
}))

vi.mock('../../app/(main)/admin/statistics/StatisticsTable', () => ({
  StatisticsTable: () => null,
}))

import StatisticsPage from '../../app/(main)/admin/statistics/page'

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <StatisticsPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('/admin/statistics 取数态渲染', () => {
  it('取数未完成 → 渲染加载态,不得在渲染期崩溃', () => {
    // 永不 resolve:模拟首帧(data === undefined)
    fetchApiMock.mockReturnValue(new Promise(() => {}))
    apiOrThrowMock.mockReturnValue(new Promise(() => {}))

    expect(() => wrap()).not.toThrow()
    expect(screen.getByText('statistics.loading')).toBeTruthy()
  })

  it('取数完成 → 渲染概览卡片真实数值', async () => {
    fetchApiMock.mockResolvedValue({
      success: true,
      data: {
        overview: {
          memberTotal: 1234,
          lessonTotal: 2,
          examTotal: 3,
          signupTotal: 4,
          examRecordTotal: 5,
          postTotal: 6,
          announcementTotal: 7,
          articleTotal: 8,
        },
        userGrowth: [{ date: '2026-10-27', total: 1234, newCount: 12 }],
        sources: [{ name: '自然流量', value: 100 }],
      },
    })
    apiOrThrowMock.mockResolvedValue({ list: [] })

    wrap()
    await waitFor(() => expect(screen.getByText('statistics.members')).toBeTruthy())
    expect(screen.getByText('1,234')).toBeTruthy()
  })

  it('取数失败 → 展示错误行,同样不得崩溃', async () => {
    fetchApiMock.mockResolvedValue({ success: false, error: '用户不存在' })
    apiOrThrowMock.mockReturnValue(new Promise(() => {}))

    expect(() => wrap()).not.toThrow()
    await waitFor(() => expect(screen.getByText(/统计加载失败/)).toBeTruthy())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
