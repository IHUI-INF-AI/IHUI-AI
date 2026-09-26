// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WP-8 第③件:goal 模式"目标完成独立校验轮"的 CLI 执行侧闸门。
 *
 * 立票事实(2026-09-26 实测):契约字段(`GoalHardCriterion` / `GoalVerification`)与
 * web 呈现位早已入库,ai-service 侧机制本体也在(`completion_verification.py` +
 * `routers/goal_verification.py`),**唯独执行侧没有任何调用方** —— 循环自宣完成
 * (stopReason='end_turn')仍然直接等价于"完成了"。AGENTS.md §8 第 3 步写的
 * "禁止模型自评 yes"因此只是一句文档。
 *
 * 本文件的判据都围绕一条不可让的取向:**绝不允许 fail-open** ——
 * 校验没跑成 / 拿不到结论 / 结论畸形,一律按"未完成"处理,并且要留下可读的原因。
 */
import { describe, expect, it } from 'vitest';

import {
  applyGoalVerificationToStopReason,
  buildGoalEvidence,
  runGoalVerification,
  type GoalToolCallRecord,
} from '../src/goal-verification.js';

const criterion = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  statement: 'pnpm --filter @ihui/cli typecheck 必须 0 错误',
  evidence_kind: 'command',
  required: true,
  probe_command: 'pnpm --filter @ihui/cli typecheck',
  expected_exit_code: 0,
  ...over,
});

const call = (over: Record<string, unknown> = {}): GoalToolCallRecord => ({
  id: 'e1',
  toolName: 'run_command',
  args: { command: 'pnpm --filter @ihui/cli typecheck' },
  ok: true,
  exitCode: 0,
  output: 'No errors found',
  ...over,
});

describe('buildGoalEvidence —— 采集侧只如实搬运,不猜不补', () => {
  it('probe_command 命中本轮真跑过的命令调用 ⇒ 出一条带机器结论的证据', () => {
    const { evidence, unprobed } = buildGoalEvidence({
      criteria: [criterion()],
      calls: [call()],
    });
    expect(evidence).toHaveLength(1);
    expect(evidence[0].criterion_id).toBe('c1');
    expect(evidence[0].outcome).toBe('met');
    expect(unprobed).toEqual([]);
  });

  it('退出码与期望不符 ⇒ 机器结论是 unmet,不得写成 met', () => {
    const { evidence } = buildGoalEvidence({
      criteria: [criterion()],
      calls: [call({ exitCode: 2, ok: false, output: 'TS2345 error' })],
    });
    expect(evidence[0].outcome).toBe('unmet');
  });

  it('没跑过该命令 ⇒ 不附证据,只点名"缺证据"(不得拿相近命令冒充)', () => {
    const { evidence, unprobed } = buildGoalEvidence({
      criteria: [criterion()],
      calls: [call({ args: { command: 'pnpm --filter @ihui/cli lint' } })],
    });
    expect(evidence).toEqual([]);
    expect(unprobed).toHaveLength(1);
    expect(unprobed[0].reason).toContain('pnpm --filter @ihui/cli typecheck');
  });

  it('命令族之外的工具调用不得当作 probe 证据(读文件读到同名字符串也不行)', () => {
    const { evidence } = buildGoalEvidence({
      criteria: [criterion()],
      calls: [
        call({
          toolName: 'read_file',
          args: { path: 'pnpm --filter @ihui/cli typecheck' },
        }),
      ],
    });
    expect(evidence).toEqual([]);
  });

  it('无 probe_command 的指标交语义判定 ⇒ 证据可空,但指标本身仍进请求', () => {
    const { evidence, unprobed } = buildGoalEvidence({
      criteria: [criterion({ probe_command: undefined, evidence_kind: 'manual' })],
      calls: [call()],
    });
    expect(evidence).toEqual([]);
    expect(unprobed).toEqual([]);
  });
});

describe('runGoalVerification —— 唯一不可让的取向:绝不 fail-open', () => {
  const base = {
    goal: '把 goal 校验接到执行侧',
    criteria: [criterion()],
    calls: [call()],
    executorClaim: '我已经完成了',
    executorModel: 'gpt-x',
  };

  it('判 not_achieved ⇒ treat_as_complete 必须为 false', async () => {
    const v = await runGoalVerification({
      ...base,
      requestVerification: async () => ({
        status: 'not_achieved',
        treat_as_complete: false,
        criteria: [],
        independent_request_made: true,
      }),
    });
    expect(v.treat_as_complete).toBe(false);
    expect(v.goal_status).toBe('not_achieved');
  });

  it('校验服务不可达 ⇒ undetermined + 原因可见,绝不当成通过', async () => {
    const v = await runGoalVerification({
      ...base,
      requestVerification: async () => {
        throw new Error('ECONNREFUSED 127.0.0.1:8803');
      },
    });
    expect(v.status).toBe('undetermined');
    expect(v.treat_as_complete).toBe(false);
    expect(v.unavailable_reason).toContain('ECONNREFUSED');
    expect(v.independent_request_made).toBe(false);
  });

  it('返回体缺 treat_as_complete 章 ⇒ 按未判定处理(不采信 status 字面)', async () => {
    const v = await runGoalVerification({
      ...base,
      requestVerification: async () => ({ status: 'achieved' }) as never,
    });
    expect(v.status).toBe('undetermined');
    expect(v.treat_as_complete).toBe(false);
  });

  it('status 说 achieved 但盖章 false ⇒ 以章为准(结论由代码合成,不由模型自述)', async () => {
    const v = await runGoalVerification({
      ...base,
      requestVerification: async () =>
        ({ status: 'achieved', treat_as_complete: false, criteria: [] }) as never,
    });
    expect(v.treat_as_complete).toBe(false);
    expect(v.independence_warnings.join(' ')).toContain('treat_as_complete');
  });

  it('achieved 且盖章 true ⇒ 唯一允许宣布完成的一档', async () => {
    const v = await runGoalVerification({
      ...base,
      requestVerification: async () =>
        ({
          status: 'achieved',
          treat_as_complete: true,
          criteria: [{ criterion_id: 'c1', verdict: 'met', basis: 'machine', reason: '' }],
          independent_request_made: true,
        }) as never,
    });
    expect(v.goal_status).toBe('achieved');
    expect(v.treat_as_complete).toBe(true);
  });
});

describe('applyGoalVerificationToStopReason —— 结论必须改变退出档', () => {
  it('end_turn + 未通过校验 ⇒ 不再是 end_turn(自宣完成不得原样交账)', () => {
    const r = applyGoalVerificationToStopReason('end_turn', {
      status: 'not_achieved',
      treat_as_complete: false,
      goal_status: 'not_achieved',
    });
    expect(r).toBe('verification_not_achieved');
  });

  it('end_turn + 校验未判定 ⇒ verification_undetermined(按未完成处理)', () => {
    const r = applyGoalVerificationToStopReason('end_turn', {
      status: 'undetermined',
      treat_as_complete: false,
      goal_status: 'undetermined',
    });
    expect(r).toBe('verification_undetermined');
  });

  it('end_turn + 校验通过 ⇒ 保持 end_turn', () => {
    expect(
      applyGoalVerificationToStopReason('end_turn', {
        status: 'achieved',
        treat_as_complete: true,
        goal_status: 'achieved',
      }),
    ).toBe('end_turn');
  });

  it('非 end_turn(轮次/预算/错误/取消)⇒ 不跑校验也不判达成,原样返回', () => {
    for (const reason of ['max_iterations', 'budget_limited', 'error', 'cancelled'] as const) {
      expect(applyGoalVerificationToStopReason(reason, null)).toBe(reason);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
