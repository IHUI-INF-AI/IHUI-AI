// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 格① 回归:审批卡(dangerous-* / plan-approval-*)永停"等待中"的修复。
 *
 * 故障:两处审批都以 status:'pending' 发出 tool_call(server.ts 的
 * requestPermissionFromEditor),但全仓没有对这两个 id 的任何 tool_call_update
 * —— 用户批/拒之后面板卡片永久 pending。
 *
 * 本测试两层:
 *  1. 行为层:emitApprovalTerminalUpdate 按真实决定落终态
 *     (approved→completed;rejected/cancelled→failed,"没收到回复"不得写 completed)。
 *  2. 装车层(阳性对照,对修复前源码必红):两处审批调用点
 *     (`const selected = await requestPermissionFromEditor(`)之后必须真的
 *     调用 emitApprovalTerminalUpdate —— 只在导出里放着判据而没人调用 = 没有修。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { emitApprovalTerminalUpdate, type ApprovalDecision } from '../src/acp/server.js';
import type { AgentContext } from '@agentclientprotocol/sdk';

interface CapturedUpdate {
  method: string;
  sessionId: string;
  update: {
    sessionUpdate: string;
    toolCallId: string;
    status: string;
    rawOutput?: { approval?: string };
  };
}

function makeNotifyingCx(notifyImpl?: (method: string, params: unknown) => Promise<void>) {
  const sent: CapturedUpdate[] = [];
  const cx = {
    request: async () => null,
    notify:
      notifyImpl ??
      (async (method: string, params: unknown) => {
        const p = params as { sessionId: string; update: CapturedUpdate['update'] };
        sent.push({ method, sessionId: p.sessionId, update: p.update });
      }),
  } as unknown as AgentContext;
  return { cx, sent };
}

describe('emitApprovalTerminalUpdate(审批卡终态与真实决定一致)', () => {
  const cases: Array<{ decision: ApprovalDecision; expected: 'completed' | 'failed' }> = [
    { decision: 'approved', expected: 'completed' },
    { decision: 'rejected', expected: 'failed' },
    { decision: 'cancelled', expected: 'failed' },
  ];
  for (const { decision, expected } of cases) {
    it(`decision=${decision} → status=${expected} 且携带同一 toolCallId`, async () => {
      const { cx, sent } = makeNotifyingCx();
      await emitApprovalTerminalUpdate(cx, 'sess-1', 'dangerous-bash-123', decision);
      expect(sent).toHaveLength(1);
      expect(sent[0]!.method).toContain('session/update');
      expect(sent[0]!.sessionId).toBe('sess-1');
      expect(sent[0]!.update.sessionUpdate).toBe('tool_call_update');
      expect(sent[0]!.update.toolCallId).toBe('dangerous-bash-123');
      expect(sent[0]!.update.status).toBe(expected);
      expect(sent[0]!.update.rawOutput?.approval).toBe(decision);
    });
  }

  it('反"把没收到回复写成 completed":cancelled 不得为 completed', async () => {
    const { cx, sent } = makeNotifyingCx();
    await emitApprovalTerminalUpdate(cx, 's', 'plan-approval-1', 'cancelled');
    expect(sent[0]!.update.status).not.toBe('completed');
  });

  it('notify 抛错(IDE 渲染失败)不得向 agent 主流程抛出', async () => {
    const { cx } = makeNotifyingCx(async () => {
      throw new Error('client gone');
    });
    await expect(
      emitApprovalTerminalUpdate(cx, 's', 'dangerous-x-1', 'approved'),
    ).resolves.toBeUndefined();
  });
});

describe('装车锁:两处审批调用点必须真的落终态(对修复前源码必红)', () => {
  const serverSrc = readFileSync(fileURLToPath(new URL('../src/acp/server.ts', import.meta.url)), 'utf8');
  const CALL_MARKER = 'const selected = await requestPermissionFromEditor(';

  it('源内恰有两处审批调用点(dangerous-* 与 plan-approval-*)', () => {
    const count = serverSrc.split(CALL_MARKER).length - 1;
    expect(count).toBe(2);
  });

  it('每个调用点在其回调内必须调用 emitApprovalTerminalUpdate(id 变量同源)', () => {
    // 两处审批 id 都以 `approvalToolCallId` 变量提出并在调用点之后引用
    expect(serverSrc).toContain('approvalToolCallId = `dangerous-${tool.name}-${Date.now()}`');
    expect(serverSrc).toContain('approvalToolCallId = `plan-approval-${Date.now()}`');
    const segments = serverSrc.split(CALL_MARKER).slice(1);
    expect(segments).toHaveLength(2);
    segments.forEach((seg) => {
      expect(seg).toContain('emitApprovalTerminalUpdate(');
      expect(seg).toContain('approvalToolCallId,');
    });
  });

  it('两处终态映射不得把 null(未收到回复/取消)写成 approved 分支', () => {
    // 判据形态:selected === null → 'cancelled'(而非 'approved')
    const nullBranches = serverSrc.match(/selected === null \? 'cancelled'/g) ?? [];
    expect(nullBranches.length).toBe(2);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
