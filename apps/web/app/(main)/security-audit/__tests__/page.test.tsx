// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全审计页 请求路径 + 响应解包 + 字段映射钉桩(2026-10-04 修 `/api/security-audit` 死路径时立)。
 *
 * 修的前错(每条都写清判据,不是转述):
 *  1. URL:`/api/security-audit` 用连字符,后端注册是 `/security/audit`(斜杠)
 *     (apps/api/src/routes/other/audit-routes.ts:42,`otherRoutes` 挂 `prefix:'/api'`
 *     见 routes/index.ts:1046)。T1/T2 钉死字面量与"不再出现连字符形态"。
 *  2. 形状:后端 `reply.send(success({list,total,page,pageSize}))`(audit-routes.ts:46)
 *     —— **不是裸数组**。页面原来 `fetchApi<AuditEvent[]>` 直接 `return r.data`,
 *     拿到对象当数组用 ⇒ 改完 URL 仍渲染空。T3 钉死必须取 `.list`。
 *     (CLI `apps/cli/src/commands/security.ts` 的 AuditListData 独立印证同一形状。)
 *  3. 字段:`security_logs` 表只有 `id/userId/action/ip/userAgent/metadata/createdAt`
 *     (packages/database/src/schema/security-logs.ts:18-26)。**没有 `type`、没有 `description`**。
 *     原页面渲染 `ev.type` / `ev.description` ⇒ 两列都空。T4/T5 钉死改用 `action` 真实列,
 *     不编造后端不存在的字段。
 *  4. `ip` 可为 null ⇒ T6 钉死渲染 `-`(与 CLI `e.ip ?? '-'` 同一口径)。
 *
 * 反向判据(防"测试自己绿"):T4/T5 的期望值取自 schema 真实列名
 * (`security_logs.action`),不是把当前实现输出抄进断言。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import SecurityAuditPage from '../page'

const { fetchApiMock } = vi.hoisted(() => ({ fetchApiMock: vi.fn() }))

vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return { Loader2: Icon, ShieldAlert: Icon, KeyRound: Icon, LogIn: Icon, Settings: Icon }
})

vi.mock('@/lib/date-utils', () => ({ formatDate: (d: Date) => d.toISOString().slice(0, 10) }))

vi.mock('@/components/common', () => ({
  BackButton: () => <button>back</button>,
  AuthGatePrompt: ({ message }: { message: string }) => <p>{message}</p>,
}))

vi.mock('@/hooks/use-auth-gate', () => ({ useAuthGate: () => ({ ready: true, allow: true }) }))

// 表格原语透传(不引入真实 UI 包的重依赖)
vi.mock('@ihui/ui-react', () => {
  const Passthrough =
    (_tag: string) =>
    function Passthrough({ children }: React.PropsWithChildren<Record<string, unknown>>) {
      return <div>{children}</div>
    }
  return {
    Card: Passthrough('card'),
    CardContent: Passthrough('card-content'),
    Table: Passthrough('table'),
    TableHeader: Passthrough('thead'),
    TableBody: Passthrough('tbody'),
    TableRow: Passthrough('tr'),
    TableHead: Passthrough('th'),
    TableCell: Passthrough('td'),
  }
})

/** 一条 `security_logs` 行(列名与 schema/security-logs.ts 一致)。 */
function logRow(over: Record<string, unknown> = {}) {
  return {
    id: 'cccccccc-3333-4333-8333-333333333333',
    userId: 'u-1',
    action: 'user.login',
    ip: '203.0.113.9',
    userAgent: 'Mozilla/5.0',
    metadata: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    ...over,
  }
}

/** 后端真实响应形状:{list,total,page,pageSize} —— 不是裸数组。 */
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
  return render(<SecurityAuditPage />, { wrapper })
}

describe('安全审计页 · 请求路径与响应解包', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    respondWith([])
  })
  afterEach(() => cleanup())

  // T1
  it('T1 请求打到存在的 /api/security/audit(斜杠,不是连字符形态)', async () => {
    renderPage()
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled())
    const url = String(fetchApiMock.mock.calls[0]?.[0])
    expect(url).toBe('/api/security/audit')
  })

  // T2
  it('T2 不再请求 /api/security-audit(连字符形态)', async () => {
    renderPage()
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled())
    const url = String(fetchApiMock.mock.calls[0]?.[0])
    expect(url).not.toBe('/api/security-audit')
    expect(url).not.toContain('security-audit')
  })

  // T3
  it('T3 响应是 {list,...} 不是裸数组:取 .list 后能渲染出行(不落空态)', async () => {
    respondWith([logRow({ action: 'user.login' })])
    renderPage()
    // 若把整个响应对象当数组用,这里会落 empty;能渲染出 action 证明 .list 解包生效
    await waitFor(() => expect(screen.getByText('user.login')).toBeTruthy())
    expect(screen.queryByText('empty')).toBeNull()
  })
})

describe('安全审计页 · 字段映射(后端 security_logs 真实形状)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => cleanup())

  // T4
  it('T4 后端无 type 列:按 action 归类出既有词条,不渲染原始 status 值', async () => {
    respondWith([logRow({ id: 'r1', action: 'user.login' })])
    renderPage()
    await waitFor(() => expect(screen.getByText('type.login')).toBeTruthy())
  })

  // T5
  it('T5 后端无 description 列:描述列渲染 action 原文', async () => {
    respondWith([logRow({ action: 'account.password_changed' })])
    renderPage()
    // action 含 password ⇒ 归 permission;描述列显示 action 原文
    await waitFor(() => expect(screen.getByText('type.permission')).toBeTruthy())
    expect(screen.getByText('account.password_changed')).toBeTruthy()
  })

  it('未识别的 action 落 other 词条(不抛错、不空)', async () => {
    respondWith([logRow({ action: 'zzz-unknown-thing' })])
    renderPage()
    await waitFor(() => expect(screen.getByText('type.other')).toBeTruthy())
    expect(screen.getByText('zzz-unknown-thing')).toBeTruthy()
  })

  // T6
  it('T6 ip 为 null 时渲染 "-" 而不是空', async () => {
    respondWith([logRow({ ip: null })])
    renderPage()
    await waitFor(() => expect(screen.getByText('-')).toBeTruthy())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
