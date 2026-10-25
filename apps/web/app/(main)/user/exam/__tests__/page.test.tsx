// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「我的考试」页 请求路径 + 字段映射钉桩(2026-10-04 修 `/api/exams` 死路径时立)。
 *
 * 修的前错(每条都写清判据,不是转述):
 *  1. URL:`/api/exams?userId=…` 在后端**没有任何注册**(grep `apps/api/src/routes/`
 *     零命中),页面恒空。正确面是 `GET /api/exam/records`(apps/api/src/routes/exam.ts:636,
 *     `prefix:'/api'` 见 routes/index.ts:584)。T1 钉死字面量。
 *  2. 越权隐患:后端 `exam.ts:648` 用 `request.userId!`(从 JWT 取),查询串里的 userId
 *     被 zod schema 剥掉(只认 page/pageSize/examId)。前端继续传等于把"鉴权当查询参数传"
 *     的坏范式留在代码里。T2 钉死**不带** userId。
 *  3. 字段:`findMyExamRecords` 是裸 `select()`(exam-queries.ts:410),**没有 join
 *     exam_papers** ⇒ 记录无 `title`。页面原来渲染 `e.title` ⇒ 改完 URL 仍渲染空。
 *     T3 钉死标题退回 `paperId` 前 8 位。
 *  4. 字段:`score` 是 PG `numeric`,经 JSON 序列化成**字符串**;原判据
 *     `typeof e.score === 'number'` 恒 false ⇒ 分数整列不渲染。T4 钉死字符串分数被渲染。
 *  5. 字段:`status` 后端取值 `pending|submitted|graded`,原 STATUS_STYLE 写的是
 *     `draft|published|completed|reviewing` ⇒ 恒落 default 灰兜底。T5 钉死三档都有映射。
 *  6. 链接:`/exam/[id]` 的 PageClient 请求 `/api/exam/papers/${id}`(吃**卷 id**),
 *     原来传记录 id ⇒ 点进去必然空卷。T6 钉死链接用 `paperId`。
 *
 * 反向判据(防"测试自己绿"):T3/T6 的期望值都取自后端真实列名
 * (`exam_records.paper_id`),不是把当前实现的输出抄进断言。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import UserExamPage from '../page'

const { fetchApiMock } = vi.hoisted(() => ({ fetchApiMock: vi.fn() }))

vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))

// next-intl:键名直出,便于断言落到具体词条
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return { Loader2: Icon, FileQuestion: Icon }
})

vi.mock('@/components/common', () => ({ BackButton: () => <button>back</button> }))

vi.mock('@/stores/auth', () => {
  const state = { token: 'jwt', user: { id: 'u-1' } }
  const useAuthStore: any = (selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state
  useAuthStore.getState = () => state
  return { useAuthStore }
})

/** 一条 `exam_records` 行(字段名与 packages/database/src/schema/exam.ts:101 一致)。 */
function record(over: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-1111-4111-8111-111111111111',
    paperId: 'bbbbbbbb-2222-4222-8222-222222222222',
    // PG numeric 经 JSON 变字符串,这是真实形态(不是 number)
    score: '87.50',
    status: 'graded',
    createdAt: '2026-10-01T08:00:00.000Z',
    ...over,
  }
}

function respondWith(list: unknown[]) {
  fetchApiMock.mockResolvedValue({
    success: true,
    status: 200,
    data: { list, total: list.length, page: 1, pageSize: 20 },
  })
}

/** react-query 需要 Provider;关 retry 让失败态立刻可断言。 */
function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return render(<UserExamPage />, { wrapper })
}

describe('我的考试页 · 请求路径', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    respondWith([])
  })
  afterEach(() => cleanup())

  // T1
  it('T1 请求打到存在的 /api/exam/records(不是不存在的 /api/exams)', async () => {
    renderPage()
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled())
    const url = String(fetchApiMock.mock.calls[0]?.[0])
    expect(url).toBe('/api/exam/records')
  })

  // T2
  it('T2 不把鉴权当查询参数传(后端走 request.userId!,查询串带 userId 是越权隐患)', async () => {
    renderPage()
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled())
    const url = String(fetchApiMock.mock.calls[0]?.[0])
    expect(url).not.toContain('userId')
    expect(url).not.toContain('?')
  })
})

describe('我的考试页 · 字段映射(后端 exam_records 真实形状)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => cleanup())

  // T3
  it('T3 后端无 title:标题退回 paperId 前 8 位,不渲染空标题', async () => {
    respondWith([record()])
    renderPage()
    // paperId 前 8 位 = 'bbbbbbbb';若仍渲染 e.title 则这里出现的是空标题
    await waitFor(() => expect(screen.getByText('bbbbbbbb')).toBeTruthy())
  })

  // T4
  it('T4 score 是字符串形态(PG numeric)也要渲染出分数', async () => {
    respondWith([record({ score: '87.50' })])
    renderPage()
    await waitFor(() => expect(screen.getByText(/87\.5/)).toBeTruthy())
  })

  // T5
  it('T5 status 三档 pending/submitted/graded 各有词条,不是恒落灰兜底', async () => {
    respondWith([
      record({ id: 'r1', status: 'pending' }),
      record({ id: 'r2', status: 'submitted' }),
      record({ id: 'r3', status: 'graded' }),
    ])
    renderPage()
    // pending→draft 标签、submitted→reviewing 标签、graded→completed 标签
    await waitFor(() => expect(screen.getByText('statusDraft')).toBeTruthy())
    expect(screen.getByText('statusReviewing')).toBeTruthy()
    expect(screen.getByText('statusCompleted')).toBeTruthy()
    // 原实现:这三个值都不在 draft/published/completed/reviewing 里 ⇒ 一律显示裸 status 值
    expect(screen.queryByText('pending')).toBeNull()
    expect(screen.queryByText('graded')).toBeNull()
  })

  // T6
  it('T6 「继续考试」链到 paperId(/exam/[id] 读的是 /api/exam/papers/${id},吃卷 id)', async () => {
    respondWith([record({ status: 'pending' })])
    renderPage()
    await waitFor(() => expect(screen.getByText('continue')).toBeTruthy())
    const link = screen.getByText('continue').closest('a')
    expect(link?.getAttribute('href')).toBe('/exam/bbbbbbbb-2222-4222-8222-222222222222')
  })

  it('终态记录(graded/submitted)不显示「继续考试」', async () => {
    respondWith([record({ status: 'graded' })])
    renderPage()
    await waitFor(() => expect(screen.getByText('statusCompleted')).toBeTruthy())
    expect(screen.queryByText('continue')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
