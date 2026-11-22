// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * W-03 退款详情页:失败不许静默降级,成功不许丢订单/审核记录。
 *
 * 立因:详情接口非成功时一律拿列表前 100 条模糊匹配,命中就返回 `order: null,
 * auditRecords: []` 的残缺数据、未命中就报「未找到」;后续只收紧到「仅 404 降级」,
 * 但 `queryFn` 仍无条件返回空 `order` / `auditRecords`,详情成功时审核记录照样被静默吞掉。
 *
 * 反向判据:成功用例直接断言详情接口给的审核记录出现在页面上;失败用例断言
 * 请求面只有详情这一个 URL —— 实现若回退到列表兜底,URL 断言就地红。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

import PageClient from '../PageClient'

const { fetchApiMock } = vi.hoisted(() => ({ fetchApiMock: vi.fn() }))

vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'rf-1' }) }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
// 词条键名直出:断言落在具体键上(notFound / auditRecords / auditAction.approve)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))
vi.mock('@/hooks/use-auth-gate', () => ({ useAuthGate: () => ({ ready: true, allow: true }) }))
vi.mock('@/components/common', () => ({
  AuthGatePrompt: ({ message }: { message: string }) => <div>{message}</div>,
}))
vi.mock('@ihui/ui-react', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('lucide-react', () => {
  const Icon = () => <span />
  return {
    Loader2: Icon,
    ArrowLeft: Icon,
    RotateCcw: Icon,
    Clock: Icon,
    CheckCircle: Icon,
    XCircle: Icon,
    Wallet: Icon,
  }
})

const REFUND = {
  id: 'rf-1',
  orderId: 'o-1',
  orderType: 'learn',
  orderNo: 'NO-1',
  userId: 'u-1',
  reason: null,
  refundAmount: '12.00',
  refundType: 'original',
  status: 'pending',
  applyTime: null,
  processTime: null,
  completeTime: null,
  processMessage: null,
  handleMessage: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

const AUDIT = {
  id: 'a-1',
  refundId: 'rf-1',
  auditorId: 'admin-1',
  action: 'approve',
  reason: '同意退款',
  createdAt: '2026-11-02T00:00:00.000Z',
}

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PageClient />
    </QueryClientProvider>,
  )
}

function requestedUrls(): string[] {
  return fetchApiMock.mock.calls.map((call) => String(call[0]))
}

describe('退款详情页 · W-03 不许丢数据', () => {
  beforeEach(() => {
    fetchApiMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('详情成功:订单与审核记录随详情一起呈现,不显示降级提示', async () => {
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: { refund: REFUND, order: { id: 'o-1' }, auditRecords: [AUDIT] },
    })
    mount()

    await waitFor(() => expect(screen.getByText('auditRecords')).toBeTruthy())
    expect(screen.getByText('auditAction.approve')).toBeTruthy()
    expect(screen.getByText('同意退款')).toBeTruthy()
    expect(screen.queryByText(/数据降级/)).toBeNull()
    expect(requestedUrls()).toEqual(['/api/refunds/rf-1'])
  })

  it('详情 5xx:显示真实错误,绝不拿列表模糊匹配兜底', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: false, status: 500, error: 'boom' })
    mount()

    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy())
    expect(screen.queryByText('auditRecords')).toBeNull()
    // 请求面只有详情端点:回退到 /api/refunds/me 就地红
    expect(requestedUrls()).toEqual(['/api/refunds/rf-1'])
  })

  it('详情 404:降级到列表但显式标注数据不完整', async () => {
    fetchApiMock.mockImplementation(async (url: string) => {
      if (url === '/api/refunds/rf-1') return { success: false, status: 404, error: 'not found' }
      return { success: true, data: { list: [REFUND], total: 1 } }
    })
    mount()

    await waitFor(() => expect(screen.getByText(/数据降级/)).toBeTruthy())
    expect(screen.getAllByText('NO-1').length).toBeGreaterThan(0)
    expect(screen.queryByText('auditRecords')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
