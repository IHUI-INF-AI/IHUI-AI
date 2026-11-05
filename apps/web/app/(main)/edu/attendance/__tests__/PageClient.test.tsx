// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 学生本人考勤页「按整月取数」用例(票 B72 残留的 web 腿)。
 *
 * 立因(现读):旧实现只发 `GET attendance/me?date=<今日>`,后端该端点其实早就支持
 * `startDate/endDate` 区间(edu-ai-management.ts `myAttendanceQuerySchema` 分支)⇒
 * 学生只能看到"今天"那一天,自己的考勤历史在页面上不存在。本组钉死整月区间与随之而来的
 * 多日呈现。
 *
 * 反向判据(防"把实现输出抄进断言"):区间末日用闰年 2 月(29 日)、1 月(31 日)、
 * 12 月跨年(2023-12-31)三枚字面常量 —— 实现若硬编码 28/30/31 或年份不借位,就地红。
 *
 * 自签 affordance 只在"视图含今日"时存在:翻到历史月还摆一枚会签今天的按钮是骗人,
 * 故 T4/T5 同时钉"历史月无自签按钮 / 回本月自签按钮回来了"。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'

import PageClient from '../PageClient'

const { apiOrThrowMock } = vi.hoisted(() => ({ apiOrThrowMock: vi.fn() }))

vi.mock('@/lib/api', () => ({ apiOrThrow: apiOrThrowMock }))

// 取词键名直出:断言落在具体词条上(prevMonth / selfCheckIn / thisMonth)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'stu-1' }, isAuthenticated: true }),
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return { Calendar: Icon, ChevronLeft: Icon, ChevronRight: Icon, Loader2: Icon, UserCheck: Icon }
})

vi.mock('@/components/feedback', () => ({
  Alert: ({ description }: { description: string }) => <div>{description}</div>,
}))

/** 同月两日(其中一日就是"今日"):旧实现只能渲染当日那一行 */
const ROWS = [
  {
    id: 'r-29',
    classId: 'c-1',
    date: '2024-02-29',
    checkInTime: '2024-02-29T00:10:00.000Z',
    status: 'present',
    checkInMethod: 'self',
    remark: null,
  },
  {
    id: 'r-28',
    classId: 'c-1',
    date: '2024-02-28',
    checkInTime: '2024-02-28T00:20:00.000Z',
    status: 'late',
    checkInMethod: 'qrcode',
    remark: null,
  },
]

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PageClient />
    </QueryClientProvider>,
  )
}

/** 只取本人考勤读路径的 URL(自签是 POST,URL 不含 /attendance/me) */
function selfReadUrls(): string[] {
  return apiOrThrowMock.mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.includes('/attendance/me'))
}

describe('学生本人考勤页 · 整月区间', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 本地 2024-02-29 12:00 ⇒ "今日"= 2024-02-29,当月末日 = 29(闰年)
    vi.setSystemTime(new Date(2024, 1, 29, 12, 0, 0))
    apiOrThrowMock.mockReset()
    apiOrThrowMock.mockResolvedValue({ list: ROWS })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('T1 首屏按整月区间问数,不再只传 date=当日', async () => {
    mount()
    await waitFor(() => expect(selfReadUrls().length).toBeGreaterThan(0))
    expect(selfReadUrls()[0]).toBe(
      '/api/edu-ai-management/attendance/me?startDate=2024-02-01&endDate=2024-02-29',
    )
  })

  it('T2 同月多日记录整表呈现(历史就在眼前)', async () => {
    mount()
    await waitFor(() => expect(screen.getByText('2024-02-29')).toBeTruthy())
    expect(screen.getByText('2024-02-28')).toBeTruthy()
  })

  it('T3 上一月:区间随月推进到大月末日,且历史月不摆自签按钮', async () => {
    mount()
    await waitFor(() => expect(selfReadUrls().length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: 'prevMonth' }))
    await waitFor(() =>
      expect(
        selfReadUrls().some((u) => u.endsWith('startDate=2024-01-01&endDate=2024-01-31')),
      ).toBe(true),
    )
    expect(screen.queryByRole('button', { name: 'selfCheckIn' })).toBeNull()
  })

  it('T4 跨年回退:年份借位由 Date 现算(2023-12-31)', async () => {
    mount()
    await waitFor(() => expect(selfReadUrls().length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: 'prevMonth' }))
    await waitFor(() => expect(selfReadUrls().length).toBeGreaterThan(1))
    fireEvent.click(screen.getByRole('button', { name: 'prevMonth' }))
    await waitFor(() =>
      expect(
        selfReadUrls().some((u) => u.endsWith('startDate=2023-12-01&endDate=2023-12-31')),
      ).toBe(true),
    )
  })

  it('T5 回本月:自签入口随视图回来,载荷仍签今日', async () => {
    mount()
    await waitFor(() => expect(selfReadUrls().length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: 'prevMonth' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'selfCheckIn' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'thisMonth' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'selfCheckIn' })).toBeTruthy())
    // 视图里 2024-02-29 已有 checkInTime ⇒ 自签按钮必须落在"今日已签"禁用态,不给重复签
    await waitFor(() => expect(screen.getByRole('button', { name: 'selfCheckIn' })).toBeDisabled())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
