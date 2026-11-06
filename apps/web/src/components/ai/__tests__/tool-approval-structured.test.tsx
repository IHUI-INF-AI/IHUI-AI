// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 批次 2(2026-11-06 立):web 审批弹窗结构化决策信息渲染回归。
 *
 * 验收对照:
 * ① 结构化字段在位 ⇒ 渲染摘要/原因/风险/作用域/目录/路径/argv,**不再**把裸 JSON 当主视线;
 * ② 老生产者(无结构化字段)⇒ 旧"参数预览"块原样保留(降级不是丢信息);
 * ③ cwd 为 null(宿主明确上报"没有目录")⇒ 不出空行,也不显示"null";
 * ④ 结构化 argv 优先于 argsPreview(被截断的 JSON 不能决定实际放行前缀)。
 *
 * mock 纪律:useTranslations 是模块级稳定引用(与 tool-approval-decision-info.test.tsx 同款)。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, act } from '@testing-library/react'

vi.mock('@ihui/api-client', () => ({
  postToolApprovalResponse: vi.fn(() => Promise.resolve()),
  sendToolApprovalResponse: vi.fn(() => Promise.resolve({ accepted: true })),
}))

// 可逆性通道与既有 dialog 测试同款 mock:本文件不验证 D161,只需让动态 import 有实现。
vi.mock('@/api/checkpoint-api', () => ({
  listCheckpoints: () => Promise.reject(new Error('not stubbed')),
}))

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string | number>): string => {
      const pack: Record<string, string> = {
        title: '工具审批',
        description: 'AI 请求执行以下高危操作,请确认是否允许',
        approve: '批准',
        reject: '拒绝',
        argsPreview: '参数预览',
        rawArgs: '原始参数(可能被截断)',
        scopeLabel: '授权范围',
        scopeOnce: '允许一次',
        scopeSession: '允许此对话',
        scopeAlways: '始终允许',
        reasonLabel: '原因(可选)',
        reasonPlaceholder: '填写原因,便于审计与追溯',
        pendingCount: '还有 {count} 个待审批',
        grantRuleToggle: '顺带放行这类命令',
        grantRuleDesc: '将放行前缀 {prefix}',
        decisionDetail: '本次执行',
        decisionDetailReason: '原因',
        decisionDetailRisk: '风险',
        decisionDetailScope: '范围',
        decisionDetailCwd: '工作目录',
        decisionDetailPaths: '受影响文件',
        decisionDetailCommand: '命令',
        reasonWritesFiles: '写入文件',
        riskMedium: '中',
        riskHigh: '高',
        scopeFsWrite: '写文件',
        scopeExec: '执行命令',
      }
      let out = pack[key] ?? key
      if (values) {
        for (const [k, v] of Object.entries(values)) out = out.replace(`{${k}}`, String(v))
      }
      return out
    },
}))

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
  confirmDialog: vi.fn(() => Promise.resolve(true)),
}))

import {
  ToolApprovalDialog,
  dispatchToolApprovalRequest,
  type ChatStreamToolApprovalRequest,
} from '../tool-approval-dialog'

function req(extra: Partial<ChatStreamToolApprovalRequest> = {}): ChatStreamToolApprovalRequest {
  return {
    approvalId: 'appr_b2_1',
    toolName: 'run_command',
    toolCallId: 'tc_b2_1',
    argsPreview: '{"argv":["git","status"]}',
    dangerLevel: 'high',
    sessionId: 'sess-b2',
    channel: 'chat-stream',
    ...extra,
  }
}

function push(r: ChatStreamToolApprovalRequest): void {
  act(() => {
    dispatchToolApprovalRequest(r)
  })
}

afterEach(cleanup)

describe('batch 2 structured approval detail (web)', () => {
  it('结构化字段在位:摘要/原因/风险/范围/目录/路径/命令齐出,裸 JSON 收进 details', () => {
    render(<ToolApprovalDialog />)
    push(
      req({
        reasonCode: 'writes_files',
        riskLevel: 'medium',
        scope: 'fs_write',
        cwd: '/repo',
        affectedPaths: ['src/a.ts', 'src/b.ts'],
        argv: ['git', 'status'],
        summary: '写入 2 个文件',
      }),
    )
    const block = screen.getByTestId('tool-approval-structured')
    expect(screen.getByTestId('tool-approval-summary').textContent ?? '').toContain('写入 2 个文件')
    expect(block.textContent ?? '').toContain('写入文件')
    expect(block.textContent ?? '').toContain('中')
    expect(block.textContent ?? '').toContain('写文件')
    expect(block.textContent ?? '').toContain('/repo')
    expect(block.textContent ?? '').toContain('src/a.ts')
    expect(block.textContent ?? '').toContain('src/b.ts')
    expect(block.textContent ?? '').toContain('git status')
    // 裸 JSON 只在可展开的"原始参数"里,不再作为主区块标题
    expect(screen.getByText('原始参数(可能被截断)')).not.toBeNull()
    expect(screen.queryByText('参数预览')).toBeNull()
  })

  it('老生产者(无结构化字段):退回参数预览块,不凭空造结构化面板', () => {
    render(<ToolApprovalDialog />)
    push(req({ argsPreview: '{"command":"ls"}' }))
    expect(screen.queryByTestId('tool-approval-structured')).toBeNull()
    expect(screen.getByText('参数预览')).not.toBeNull()
    expect(screen.getByText('{"command":"ls"}')).not.toBeNull()
  })

  it('cwd 显式 null 不渲染工作目录行(不写 null 也不编造路径)', () => {
    render(<ToolApprovalDialog />)
    push(req({ reasonCode: 'writes_files', cwd: null, affectedPaths: ['src/a.ts'] }))
    expect(screen.getByTestId('tool-approval-structured')).not.toBeNull()
    expect(screen.queryByText('工作目录')).toBeNull()
    expect(screen.queryByText('null')).toBeNull()
  })

  it('结构化 argv 优先于 argsPreview(被截断的 JSON 不能决定放行前缀)', () => {
    render(<ToolApprovalDialog />)
    push(
      req({
        toolName: 'run_command',
        argsPreview: '{"argv":["git","sta', // 截断的旧预览
        argv: ['git', 'status'],
        scope: 'exec',
        reasonCode: 'executes_command',
      }),
    )
    expect(screen.getByText('将放行前缀 git status')).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
