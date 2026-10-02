// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D136(2026-10-01 立,承票面第 5 栏):审批决议的**副作用断言**。
 *
 * 票面要求:mock 高危工具调用,拒绝后断言副作用(文件写/命令执行桩)未被调用,
 * **不只看错误码**。本端可自动化的事实链是:高危工具的真实执行在服务端,客户端唯一能
 * 扳动它的方式是送出 `decision: 'approve'` 的决议载荷 —— 所以副作用桩挂在这条扳机上
 * (makeUpstream),断言打两处:
 *   ① 决议载荷**键级**形状(decision 值、scope 键在不在),不是 HTTP 码也不是界面文案;
 *   ② 副作用桩被调次数(拒绝路径恒 0,批准路径按档逐次 +1 —— 正向对照证明桩不是死的)。
 *
 * 纯逻辑层(tool-approval-text.ts)可直接喂数据,与 tool-approval-wiring.test.ts 同一环境约定。
 */
import { describe, expect, it, vi } from 'vitest'
import {
  appendApprovalRecord,
  buildApprovePayload,
  buildRejectPayload,
  dequeueApprovalRequest,
  enqueueApprovalRequest,
  offersManualOverride,
  type ApprovalRecord,
  type ApprovalRequestView,
} from '../tool-approval-text'

const REQUEST: ApprovalRequestView = {
  approvalId: 'ap-risk',
  toolName: 'run_command',
  toolCallId: 'tc-risk',
  argsPreview: '{"command":"rm -rf dist"}',
  dangerLevel: 'high',
  sessionId: 's-risk',
}

/** 副作用桩的挂载面:服务端收到 approve 决议才执行高危工具(与 ai-service 审批门同契约)。 */
function makeUpstream(executeTool: (scope: unknown) => void) {
  return async (payload: Record<string, unknown>): Promise<{ ok: boolean }> => {
    if (payload.decision === 'approve') executeTool(payload.scope)
    return { ok: true }
  }
}

describe('D136 副作用断言:拒绝 ⇒ 高危工具执行桩零调用', () => {
  it('拒绝路径:桩零调用,载荷键级断言(decision=reject、无 scope、无 grantRule)', async () => {
    const executeTool = vi.fn()
    const upstream = makeUpstream(executeTool)
    const payload = buildRejectPayload(REQUEST)
    await upstream(payload as unknown as Record<string, unknown>)
    expect(executeTool).not.toHaveBeenCalled()
    // 键级断言(不是错误码):拒绝载荷恰为三键,多一个授权键都是越权
    expect(Object.keys(payload).sort()).toEqual(['approvalId', 'decision', 'sessionId'])
    expect(payload.decision).toBe('reject')
    expect('scope' in payload).toBe(false)
    expect('grantRule' in payload).toBe(false)
  })

  it('先选 always 再拒绝:scope 根本不在拒绝载荷的构造面上(不是"忘了带上",是"带不上")', async () => {
    const executeTool = vi.fn()
    const upstream = makeUpstream(executeTool)
    // buildRejectPayload 没有 scope 参数 —— 拒绝不落任何授权,类型层面就写不出来
    const payload = buildRejectPayload(REQUEST)
    await upstream(payload as unknown as Record<string, unknown>)
    expect(executeTool).not.toHaveBeenCalled()
    expect('scope' in payload).toBe(false)
  })

  it('正向对照:批准 ⇒ 桩恰好一次且按所选档执行(证明桩不是死的,拒绝路径的 0 是真 0)', async () => {
    for (const scope of ['once', 'session', 'always'] as const) {
      const executeTool = vi.fn()
      const upstream = makeUpstream(executeTool)
      const payload = buildApprovePayload(REQUEST, scope)
      await upstream(payload as unknown as Record<string, unknown>)
      expect(executeTool).toHaveBeenCalledTimes(1)
      expect(executeTool).toHaveBeenCalledWith(scope)
      // 批准载荷必带 scope(显式送 once,防后端缺省把授权放大)
      expect(payload.scope).toBe(scope)
    }
  })
})

describe('D136 副作用断言:页级流程(入队 → 决议 → 记录)走通后,被拒条目留人工放行出口', () => {
  it('拒绝成功:出队 + 记录 rejected,§30 放行口子仍在且可用(载荷可重送)', async () => {
    const executeTool = vi.fn()
    const upstream = makeUpstream(executeTool)
    let queue = enqueueApprovalRequest([], REQUEST)
    const payload = buildRejectPayload(REQUEST)
    await upstream(payload as unknown as Record<string, unknown>)
    expect(executeTool).not.toHaveBeenCalled()
    queue = dequeueApprovalRequest(queue, REQUEST.approvalId)
    const records = appendApprovalRecord([], {
      approvalId: REQUEST.approvalId,
      sessionId: REQUEST.sessionId,
      toolName: REQUEST.toolName,
      decision: 'reject',
      outcome: 'rejected',
      overrideCount: 0,
    } as ApprovalRecord)
    expect(queue).toHaveLength(0)
    expect(offersManualOverride(records[0] as ApprovalRecord)).toBe(true)
    // 人工放行 = 用记录里的 id 重新构造批准载荷(页级补 sessionId)重送
    const override = buildApprovePayload({ approvalId: REQUEST.approvalId }, 'once')
    await upstream({ ...override, sessionId: REQUEST.sessionId } as unknown as Record<
      string,
      unknown
    >)
    expect(executeTool).toHaveBeenCalledTimes(1)
    expect(executeTool).toHaveBeenCalledWith('once')
  })

  it('回传失败(send-failed):副作用桩零调用(没送出去的决议扳不动服务端执行)', async () => {
    const executeTool = vi.fn()
    const failingUpstream = async (): Promise<never> => {
      throw new Error('AI 服务未接受该决策')
    }
    const payload = buildApprovePayload(REQUEST, 'once')
    await expect(failingUpstream()).rejects.toThrow('AI 服务未接受该决策')
    // 上游拒绝了这次回传 ⇒ 决议未生效 ⇒ 工具不执行;条目不得显示"已处理"
    expect(executeTool).not.toHaveBeenCalled()
    expect(payload.decision).toBe('approve')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
