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
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'

import PageClient from '../PageClient'

// 实现侧已收口到共享出口 `@ihui/api-client`(2026-11 批5),页面只负责"传哪个月区间",
// URL 字面量唯一持有者是 api-client —— 夹具跟着出口走,而不是继续 mock 页面已不走的 apiOrThrow。
const { eduMyAttendanceMock, eduAttendanceSelfCheckOutMock } = vi.hoisted(() => ({
  eduMyAttendanceMock: vi.fn(),
  eduAttendanceSelfCheckOutMock: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  eduMyAttendance: eduMyAttendanceMock,
  eduAttendanceSelfCheckIn: vi.fn(async () => ({ success: true, data: {} })),
  eduAttendanceSelfCheckOut: eduAttendanceSelfCheckOutMock,
}))

// 取词键名直出:断言落在具体词条上(prevMonth / selfCheckIn / thisMonth)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'stu-1' }, isAuthenticated: true }),
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  // 只替换本页与 ui-react 走到的图标出口,其余保持真实模块(避免 mock 漏出口连坐)
  const Icon = () => <span data-testid="icon" />
  return {
    ...actual,
    Calendar: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Loader2: Icon,
    LogOut: Icon,
    UserCheck: Icon,
    CheckCircle2: Icon,
    AlertCircle: Icon,
    Terminal: Icon,
  }
})

vi.mock('@/components/feedback', () => ({
  Alert: ({ description }: { description: string }) => <div>{description}</div>,
}))

// 固定业务日(=2024-02-29,闰年当月末日 29);只替换时钟出口,月推进逻辑仍走真实实现
vi.mock('../month', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, todayStr: () => '2024-02-29' }
})

/** 同月两日(其中一日就是"今日"):旧实现只能渲染当日那一行 */
const ROWS = [
  {
    id: 'r-29',
    classId: 'c-1',
    date: '2024-02-29',
    checkInTime: '2024-02-29T00:10:00.000Z',
    checkOutTime: null,
    status: 'present',
    checkInMethod: 'self',
    remark: null,
  },
  {
    id: 'r-28',
    classId: 'c-1',
    date: '2024-02-28',
    checkInTime: '2024-02-28T00:20:00.000Z',
    checkOutTime: null,
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

const here = dirname(fileURLToPath(import.meta.url))
// here = apps/web/app/(main)/edu/attendance/__tests__ → 上溯 7 级到仓库根
const eduEndpointFile = resolve(
  here, ...Array.from({ length: 7 }, () => '..'),
  'packages', 'api-client', 'src', 'endpoints', 'edu-ai-management.ts',
)

/** 只取本人考勤读路径的入参对象(页面职责 = 算准区间,URL 由共享出口拼) */
function selfReadParams(): Array<Record<string, unknown>> {
  return eduMyAttendanceMock.mock.calls.map((c) => c[0] as Record<string, unknown>)
}

/** 自签退的 POST 入参 */
function selfCheckOutCalls(): unknown[][] {
  return eduAttendanceSelfCheckOutMock.mock.calls
}

describe('学生本人考勤页 · 整月区间', () => {
  beforeEach(() => {
    eduMyAttendanceMock.mockReset()
    eduMyAttendanceMock.mockResolvedValue({ success: true, data: { list: ROWS } })
    eduAttendanceSelfCheckOutMock.mockReset()
    eduAttendanceSelfCheckOutMock.mockResolvedValue({ success: true, data: {} })
  })

  afterEach(() => {
    cleanup()
  })

  it('T1 首屏按整月区间问数,不再只传 date=当日', async () => {
    mount()
    await waitFor(() => expect(selfReadParams().length).toBeGreaterThan(0))
    expect(selfReadParams()[0]).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    })
  })

  it('T1b 共享出口的 URL 契约:打 /attendance/me,区间参数由 withQuery 原样带出', () => {
    const src = readFileSync(eduEndpointFile, 'utf8')
    expect(src).toMatch(
      /export async function eduMyAttendance[\s\S]*?fetchApi<T>\(withQuery\('\/api\/edu-ai-management\/attendance\/me', params\)\)/,
    )
    expect(src).toMatch(
      /export async function eduAttendanceSelfCheckOut[\s\S]*?fetchApi<T>\('\/api\/edu-ai-management\/attendance\/self-check-out'/,
    )
  })

  it('T2 同月多日记录整表呈现(历史就在眼前)', async () => {
    mount()
    await waitFor(() => expect(screen.getByText('2024-02-29')).toBeTruthy())
    expect(screen.getByText('2024-02-28')).toBeTruthy()
  })

  it('T3 上一月:区间随月推进到大月末日,且历史月不摆自签按钮', async () => {
    mount()
    await waitFor(() => expect(selfReadParams().length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: 'prevMonth' }))
    await waitFor(() =>
      expect(
        selfReadParams().some(
          (p) => p.startDate === '2024-01-01' && p.endDate === '2024-01-31',
        ),
      ).toBe(true),
    )
    expect(screen.queryByRole('button', { name: 'selfCheckIn' })).toBeNull()
  })

  it('T4 跨年回退:年份借位由 Date 现算(2023-12-31)', async () => {
    mount()
    await waitFor(() => expect(selfReadParams().length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: 'prevMonth' }))
    await waitFor(() => expect(selfReadParams().length).toBeGreaterThan(1))
    fireEvent.click(screen.getByRole('button', { name: 'prevMonth' }))
    await waitFor(() =>
      expect(
        selfReadParams().some(
          (p) => p.startDate === '2023-12-01' && p.endDate === '2023-12-31',
        ),
      ).toBe(true),
    )
  })

  it('T5 回本月:自签入口随视图回来,载荷仍签今日', async () => {
    mount()
    await waitFor(() => expect(selfReadParams().length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: 'prevMonth' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'selfCheckIn' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'thisMonth' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'selfCheckIn' })).toBeTruthy())
    // 视图里 2024-02-29 已有 checkInTime ⇒ 自签按钮必须落在"今日已签"禁用态,不给重复签
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'selfCheckIn' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    )
  })

  it('T6 签退入口:今日已签到未签退时可点,POST 自签退载荷只带业务日', async () => {
    mount()
    await waitFor(() => expect(screen.getByRole('button', { name: 'checkOut' })).toBeTruthy())
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'checkOut' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'checkOut' }))
    await waitFor(() => expect(selfCheckOutCalls().length).toBe(1))
    const call = selfCheckOutCalls()[0] ?? []
    expect(call[0]).toEqual({ date: '2024-02-29' })
    await waitFor(() => expect(screen.getByText('selfCheckOutSuccess')).toBeTruthy())
  })

  it('T7 今日已签退:签退入口禁用,不给重复提交', async () => {
    eduMyAttendanceMock.mockResolvedValue({
      success: true,
      data: { list: [{ ...ROWS[0], checkOutTime: '2024-02-29T09:00:00.000Z' }] },
    })
    mount()
    await waitFor(() => expect(screen.getByRole('button', { name: 'checkOut' })).toBeTruthy())
    expect((screen.getByRole('button', { name: 'checkOut' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('T8 今日未签到:签退入口禁用(先签到后签退由后端口径裁决)', async () => {
    eduMyAttendanceMock.mockResolvedValue({
      success: true,
      data: { list: [{ ...ROWS[0], checkInTime: null, checkOutTime: null }] },
    })
    mount()
    await waitFor(() => expect(screen.getByRole('button', { name: 'checkOut' })).toBeTruthy())
    expect((screen.getByRole('button', { name: 'checkOut' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
