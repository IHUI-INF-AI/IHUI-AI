// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * D161(2026-09-29 立):审批卡的四个「决策信息字段」(whyNow/whyYou/reversibility/afterDecision)
 * + 准入声明 + 块级空态 + 状态四档词表。
 *
 * 验收对照(票第 6 栏):
 * ① 每个字段无值 ⇒ 整行不渲染(不得出现空标签或"—")——四字段各有一条无值用例;
 * ② 可逆性**真读**检查点可用性(@/api/checkpoint-api::listCheckpoints):
 *    读到值 ⇒ 有值渲染;通道读失败 ⇒ 该行不渲染(绝不伪造"可回退/不可回退");
 * ③ 词表键漏了会原样回显键名(下方 mock 的回退行为),断言文案即能钉住死键;
 * ④ 出口「在上下文中处理」本票不做(跳回锚点对跨会话请求不可机检,且可见跳转必须
 *    关掉决策面)—— 只做字段展示,无任何跳转入口是**有意为之**,不是漏测。
 * mock 纪律:useTranslations 的 mock 是模块级稳定引用(与既有 dialog 测试同款),
 * 防 vitest worker 反复重建模块导致 OOM 假死。
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'

// checkpoint 通道 mock:可按用例注入实现;调用记录用于"无会话不得查询"的反向断言
const ckpt = vi.hoisted(() => ({
  calls: [] as string[],
  impl: {
    list: (_sessionId: string): Promise<{ session_id: string; total: number; checkpoints: Array<{ checkpoint_id: string }> }> =>
      Promise.reject(new Error('checkpoint channel not stubbed')),
  },
}))

vi.mock('@/api/checkpoint-api', () => ({
  listCheckpoints: (sessionId: string) => {
    ckpt.calls.push(sessionId)
    return ckpt.impl.list(sessionId)
  },
}))

// api-client mock:与既有 dialog 测试同形(本文件不点决策按钮,仅防模块图缺 exports)
vi.mock('@ihui/api-client', () => ({
  postToolApprovalResponse: vi.fn(() => Promise.resolve()),
  sendToolApprovalResponse: vi.fn(() => Promise.resolve({ accepted: true })),
}))

// next-intl mock:editor.toolApproval 词包(与 packages/i18n/messages/web/zh-CN.json 同形;
// 键漏了会**原样回显键名** —— 死键与漏键因此可直接被文案断言钉住)
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
        scopeLabel: '授权范围',
        scopeOnce: '允许一次',
        scopeSession: '允许此对话',
        scopeAlways: '始终允许',
        reasonLabel: '原因(可选)',
        reasonPlaceholder: '填写原因,便于审计与追溯',
        pendingCount: '还有 {count} 个待审批',
        decisionLabel: '决策信息',
        decisionAdmission: '只列引擎侧可推导的事实,读不到的信息不会出现在这里。',
        decisionEmptyTitle: '暂无可读的决策信息',
        decisionEmptyDescription: '引擎侧没有可推导的决策依据,你可以直接批准或拒绝本次请求。',
        decisionWhyNow: '为什么现在',
        decisionWhyNowValue:
          '{toolName} 在执行前被审批门拦下(危险档 {dangerLevel}),你决策前不会执行',
        decisionWhyYou: '为什么找我',
        decisionWhyYouValue: '该调用发生在你的会话 {sessionId} 中,审批请求送达你这里',
        decisionReversibility: '可逆性',
        decisionReversible: '可回退:该会话已有 {count} 个检查点,决策后可回退恢复',
        decisionIrreversible: '不可回退:该会话没有可回退的检查点,决策后无法用回退撤销',
        decisionAfterDecision: '决定后',
        decisionAfterDecisionValue:
          '批准后 {toolName} 立即执行;拒绝则不执行,结果以错误回填给模型',
        stateBlocking: '阻塞中',
        stateRequested: '等待处理',
        stateWaitingForMe: '等我判断',
        stateOverdue: '已过期',
      }
      let out = pack[key] ?? key
      if (values) {
        for (const [k, v] of Object.entries(values)) out = out.replace(`{${k}}`, String(v))
      }
      return out
    },
}))

// Modal mock:jsdom 下直出内容与 footer(只保留 open 语义)
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
  deriveApprovalCardState,
  type ChatStreamToolApprovalRequest,
} from '../tool-approval-dialog'

function req(extra: Partial<ChatStreamToolApprovalRequest> = {}): ChatStreamToolApprovalRequest {
  return {
    approvalId: 'appr_d161_1',
    toolName: 'run_command',
    toolCallId: 'tc_d161_1',
    argsPreview: '{"argv":["git","status"]}',
    dangerLevel: 'high',
    sessionId: 'sess-d161',
    channel: 'chat-stream',
    ...extra,
  }
}

function push(r: ChatStreamToolApprovalRequest): void {
  act(() => {
    dispatchToolApprovalRequest(r)
  })
}

/** 让可逆性通道的异步读数(动态 import + promise 链)在 act 内落地 */
async function flushChannel(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  ckpt.calls.length = 0
  ckpt.impl.list = () => Promise.reject(new Error('checkpoint channel not stubbed'))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('D161 ①:四字段 有值渲染 / 无值整行不渲染', () => {
  it('whyNow 有值:渲染"为什么现在"行(审批门 + 危险档),准入声明与状态档同块可见', () => {
    render(<ToolApprovalDialog />)
    push(req())
    const row = screen.getByTestId('tool-approval-why-now')
    expect(row.textContent).toContain('为什么现在')
    expect(row.textContent).toContain('run_command')
    expect(row.textContent).toContain('审批门')
    expect(row.textContent).toContain('high')
    // 准入声明(块头)与状态档(当前卡 = 等我判断)同块出现
    expect(screen.getByTestId('tool-approval-decision').textContent).toContain(
      '只列引擎侧可推导的事实'
    )
    expect(screen.getByTestId('tool-approval-state').textContent).toBe('等我判断')
    expect(screen.queryByTestId('tool-approval-decision-empty')).toBeNull()
  })

  it('whyNow 无值(危险档不在已知集)⇒ 整行不渲染,其余有值行照常(不显示空标签)', () => {
    render(<ToolApprovalDialog />)
    push(req({ dangerLevel: 'unknown' as unknown as ChatStreamToolApprovalRequest['dangerLevel'] }))
    expect(screen.queryByTestId('tool-approval-why-now')).toBeNull()
    expect(screen.getByTestId('tool-approval-why-you')).toBeTruthy()
    expect(screen.getByTestId('tool-approval-after-decision')).toBeTruthy()
  })

  it('whyYou 有值:渲染"为什么找我"行(带会话 id)', () => {
    render(<ToolApprovalDialog />)
    push(req())
    const row = screen.getByTestId('tool-approval-why-you')
    expect(row.textContent).toContain('为什么找我')
    expect(row.textContent).toContain('sess-d161')
  })

  it('whyYou 无值(会话 id 缺席)⇒ 整行不渲染,且检查点通道一次都不查', async () => {
    render(<ToolApprovalDialog />)
    push(req({ sessionId: '' }))
    await flushChannel()
    expect(screen.queryByTestId('tool-approval-why-you')).toBeNull()
    expect(ckpt.calls).toHaveLength(0)
    expect(screen.getByTestId('tool-approval-why-now')).toBeTruthy()
  })

  it('afterDecision 有值:渲染"决定后"行(批准立即执行 / 拒绝以错误回填)', () => {
    render(<ToolApprovalDialog />)
    push(req())
    const row = screen.getByTestId('tool-approval-after-decision')
    expect(row.textContent).toContain('决定后')
    expect(row.textContent).toContain('立即执行')
    expect(row.textContent).toContain('回填给模型')
  })

  it('afterDecision 无值(工具名缺席)⇒ 整行不渲染(不拿通用句冒充点名)', async () => {
    render(<ToolApprovalDialog />)
    push(req({ toolName: '' }))
    await flushChannel()
    expect(screen.queryByTestId('tool-approval-after-decision')).toBeNull()
    expect(screen.getByTestId('tool-approval-why-you')).toBeTruthy()
  })
})

describe('D161 ②:可逆性真读检查点可用性', () => {
  it('检查点 > 0 ⇒ 渲染"可回退"行(带数量;数值来自通道真读,非档位推断)', async () => {
    ckpt.impl.list = (sessionId: string) =>
      Promise.resolve({ session_id: sessionId, total: 3, checkpoints: [] })
    render(<ToolApprovalDialog />)
    push(req())
    await flushChannel()
    const row = screen.getByTestId('tool-approval-reversibility')
    expect(row.textContent).toContain('可逆性')
    expect(row.textContent).toContain('可回退')
    expect(row.textContent).toContain('3')
    expect(ckpt.calls).toEqual(['sess-d161'])
  })

  it('检查点 = 0 ⇒ 渲染"不可回退"行(零检查点是引擎侧真值,不是"无值")', async () => {
    ckpt.impl.list = (sessionId: string) =>
      Promise.resolve({ session_id: sessionId, total: 0, checkpoints: [] })
    render(<ToolApprovalDialog />)
    push(req())
    await flushChannel()
    const row = screen.getByTestId('tool-approval-reversibility')
    expect(row.textContent).toContain('不可回退')
  })

  it('检查点通道读失败 ⇒ 该行不渲染(无值不渲染,绝不伪造可逆性结论)', async () => {
    ckpt.impl.list = () => Promise.reject(new Error('checkpoint api unreachable'))
    render(<ToolApprovalDialog />)
    push(req())
    await flushChannel()
    expect(screen.queryByTestId('tool-approval-reversibility')).toBeNull()
    // 其余有值字段照常,块不整体塌掉
    expect(screen.getByTestId('tool-approval-why-now')).toBeTruthy()
  })
})

describe('D161 ①(续):空态', () => {
  it('四字段全部无值 ⇒ 块级空态(标题+描述),不渲染任何字段行', async () => {
    render(<ToolApprovalDialog />)
    push(
      req({
        toolName: '',
        sessionId: '',
        dangerLevel: 'unknown' as unknown as ChatStreamToolApprovalRequest['dangerLevel'],
      }),
    )
    await flushChannel()
    const empty = screen.getByTestId('tool-approval-decision-empty')
    expect(empty.textContent).toContain('暂无可读的决策信息')
    expect(empty.textContent).toContain('引擎侧没有可推导的决策依据')
    expect(screen.queryByTestId('tool-approval-why-now')).toBeNull()
    expect(screen.queryByTestId('tool-approval-why-you')).toBeNull()
    expect(screen.queryByTestId('tool-approval-reversibility')).toBeNull()
    expect(screen.queryByTestId('tool-approval-after-decision')).toBeNull()
    // 空态下也不得出现"—"这类空占位
    expect(empty.textContent).not.toContain('—')
  })
})

describe('D161:状态四档推导(纯函数;弹窗当前卡只可达 waitingForMe)', () => {
  it('overdue > waitingForMe > blocking > requested 的优先级各就各位', () => {
    expect(deriveApprovalCardState({ isCurrent: true, belongsToOpenConversation: true, overdue: true })).toBe('overdue')
    expect(deriveApprovalCardState({ isCurrent: true, belongsToOpenConversation: true, overdue: false })).toBe('waitingForMe')
    expect(deriveApprovalCardState({ isCurrent: false, belongsToOpenConversation: true, overdue: false })).toBe('blocking')
    expect(deriveApprovalCardState({ isCurrent: false, belongsToOpenConversation: false, overdue: false })).toBe('requested')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
