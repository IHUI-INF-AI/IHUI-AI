// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'

// api-client mock:捕获审批响应请求体(不真发请求)
const sendCalls: Array<Record<string, unknown>> = []
vi.mock('@ihui/api-client', () => ({
  sendToolApprovalResponse: vi.fn((params: Record<string, unknown>) => {
    sendCalls.push(params)
    return Promise.resolve({ accepted: true })
  }),
}))

// next-intl mock:editor.toolApproval 命名空间(键 → 期望中文,与 zh-CN 词包同形)
vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string => {
      const pack: Record<string, string> = {
        title: '工具审批',
        description: 'AI 请求执行以下高危操作,请确认是否允许',
        approve: '批准',
        reject: '拒绝',
        argsPreview: '参数预览',
        scopeLabel: '授权范围',
        scopeOnce: '允许一次',
        scopeSession: '允许此对话',
        scopeAlways: '始终允许',
        reasonLabel: '原因(可选)',
        reasonPlaceholder: '填写原因,便于审计与追溯',
      }
      return pack[key] ?? key
    },
}))

// Modal mock:jsdom 下直出内容与 footer(仅保留 open 语义,不测 Modal 本身)
vi.mock('@/components/feedback', () => ({
  Modal: ({
    open,
    children,
    footer,
  }: {
    open: boolean
    children: React.ReactNode
    footer?: React.ReactNode
  }) =>
    open ? (
      <div data-testid="approval-modal">
        {children}
        {footer}
      </div>
    ) : null,
}))

import { ToolApprovalDialog, dispatchToolApprovalRequest } from '../tool-approval-dialog'
import type { ToolApprovalRequest } from '@ihui/types'

const BASE_REQ: ToolApprovalRequest = {
  approvalId: 'appr_test_001',
  toolName: 'write_file',
  toolCallId: 'tc_1',
  argsPreview: '{"path":"/tmp/a.txt"}',
  dangerLevel: 'high',
  sessionId: 'sess-1',
}

function pushRequest(req: ToolApprovalRequest = BASE_REQ): void {
  act(() => {
    dispatchToolApprovalRequest(req)
  })
}

/** handleDecision 是 async(提交后 finally 才出栈下一条):点击必须等到微任务排空。 */
async function clickAsync(btn: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(btn)
  })
}

/**
 * D84 审批作用域四件套守门测试(2026-09-23 立):
 *   - 作用域三档(允许一次/此对话/始终允许)随批准请求透传,默认 once(最小特权)
 *   - 拒绝不携带 scope(拒绝不落任何授权)但携带已填原因
 *   - 空原因不携带 reason 键(与后端"空值不写 key"语义一致)
 *   - 下一条请求入栈时作用域/原因重置,不串
 */
describe('ToolApprovalDialog D84 作用域与原因', () => {
  beforeEach(() => {
    sendCalls.length = 0
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('默认作用域为 once:直接点批准,body 携带 scope=once', () => {
    render(<ToolApprovalDialog />)
    pushRequest()
    fireEvent.click(screen.getByTestId('tool-approval-approve'))
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0]).toMatchObject({ approvalId: 'appr_test_001', decision: 'approve', scope: 'once' })
    expect(sendCalls[0]).not.toHaveProperty('reason')
  })

  it('选择「始终允许」后批准,body 携带 scope=always', () => {
    render(<ToolApprovalDialog />)
    pushRequest()
    fireEvent.click(screen.getByTestId('tool-approval-scope-always'))
    expect(screen.getByTestId('tool-approval-scope-always').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByTestId('tool-approval-approve'))
    expect(sendCalls[0]).toMatchObject({ decision: 'approve', scope: 'always' })
  })

  it('选择「允许此对话」后批准,body 携带 scope=session', () => {
    render(<ToolApprovalDialog />)
    pushRequest()
    fireEvent.click(screen.getByTestId('tool-approval-scope-session'))
    fireEvent.click(screen.getByTestId('tool-approval-approve'))
    expect(sendCalls[0]).toMatchObject({ decision: 'approve', scope: 'session' })
  })

  it('拒绝不携带 scope;已填原因随请求透传,空原因不携带 reason 键', async () => {
    render(<ToolApprovalDialog />)
    pushRequest()
    fireEvent.click(screen.getByTestId('tool-approval-scope-always'))
    await clickAsync(screen.getByTestId('tool-approval-reject'))
    // 拒绝:即便作用域选了 always 也不落授权 → 不携带 scope
    expect(sendCalls[0]).toMatchObject({ decision: 'reject', approvalId: 'appr_test_001' })
    expect(sendCalls[0]).not.toHaveProperty('scope')

    // 第二条:填原因后拒绝 → reason 透传(trim 后非空才携带)
    pushRequest({ ...BASE_REQ, approvalId: 'appr_test_002', toolCallId: 'tc_2' })
    const reasonBox = screen.getByTestId('tool-approval-reason') as HTMLTextAreaElement
    fireEvent.change(reasonBox, { target: { value: '  不要动这个文件  ' } })
    await clickAsync(screen.getByTestId('tool-approval-reject'))
    expect(sendCalls[1]).toMatchObject({ decision: 'reject', reason: '不要动这个文件' })

    // 第三条:原因留空拒绝 → 不携带 reason 键
    pushRequest({ ...BASE_REQ, approvalId: 'appr_test_003', toolCallId: 'tc_3' })
    await clickAsync(screen.getByTestId('tool-approval-reject'))
    expect(sendCalls[2]).not.toHaveProperty('reason')
  })

  it('下一条请求入栈时作用域重置为 once(不串上一条的授权范围)', async () => {
    render(<ToolApprovalDialog />)
    pushRequest()
    fireEvent.click(screen.getByTestId('tool-approval-scope-always'))
    // 排队第二条,批准第一条
    pushRequest({ ...BASE_REQ, approvalId: 'appr_test_002', toolCallId: 'tc_2' })
    await clickAsync(screen.getByTestId('tool-approval-approve'))
    expect(sendCalls[0]).toMatchObject({ approvalId: 'appr_test_001', scope: 'always' })
    // 第二条变为当前:作用域已重置为 once
    await clickAsync(screen.getByTestId('tool-approval-approve'))
    expect(sendCalls[1]).toMatchObject({ approvalId: 'appr_test_002', scope: 'once' })
  })
})
