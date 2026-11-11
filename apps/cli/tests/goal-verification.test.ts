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

import type { GoalVerification } from '@ihui/api-client';

import {
  applyGoalVerificationToStopReason,
  buildGoalEvidence,
  decideGoalContinuation,
  GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES,
  resolveMaxConsecutiveFailures,
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

/**
 * AGENTS.md §8 第 4 步的收口语义(2026-09-26 补,上一条闸门只做到"未过就一次性改档退出")。
 *
 * 三件事必须分开,合并任何两件都会把这条规则读歪:
 *   - **单次未过** ⇒ 回灌未达标项续跑(循环还没干完活,不该交账);
 *   - **连续未过到达上限** ⇒ goal 落 blocked(生命周期收口,不是又一次未过);
 *   - **没预算了** ⇒ 按未达标交账,绝不得当成 pass —— 这是本文件那条"绝不 fail-open"
 *     取向在续跑逻辑里的投影,所以它的用例是这个 describe 里最贵的一条。
 */
const fullVerification = (over: Partial<GoalVerification> = {}): GoalVerification => ({
  status: 'not_achieved',
  goal_status: 'not_achieved',
  treat_as_complete: false,
  criteria: [
    {
      criterion_id: 'c1',
      statement: 'typecheck 必须 0 错误',
      verdict: 'unmet',
      basis: 'machine',
      reason: 'exit=2',
      evidence_ids: ['e1'],
      contradicted: false,
    },
  ],
  independent_request_made: true,
  judge_model: 'judge-x',
  unavailable_reason: null,
  independence_warnings: [],
  consecutive_failures: 0,
  // 刻意不上报服务端档位(0)⇒ 判序必须落回跨端镜像常量,而不是"没有就不收口"
  max_consecutive_failures: 0,
  ...over,
});

describe('resolveMaxConsecutiveFailures —— 上限缺失/非法只允许落到保守默认', () => {
  it('服务端未给档位(缺失/0/负数/NaN/Infinity)⇒ 一律取跨端镜像常量', () => {
    for (const raw of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveMaxConsecutiveFailures(raw)).toBe(GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES);
    }
  });

  it('保守方向的定义是"更少的续跑":默认必须是有限正整数,绝不可能是 Infinity', () => {
    const d = resolveMaxConsecutiveFailures(undefined);
    expect(Number.isFinite(d)).toBe(true);
    expect(Number.isInteger(d)).toBe(true);
    expect(d).toBeGreaterThanOrEqual(1);
  });

  it('服务端显式给的合法档位照采纳(计数在端内,阈值以真源下发为准)', () => {
    expect(resolveMaxConsecutiveFailures(5)).toBe(5);
    expect(resolveMaxConsecutiveFailures(2.9)).toBe(2);
  });
});

describe('decideGoalContinuation —— 未过 ≠ 交账,连续未过才落 blocked', () => {
  it('盖章通过 ⇒ pass,且计数归零(未过之后的一次通过不得继续背着旧账)', () => {
    const d = decideGoalContinuation({
      verification: fullVerification({
        status: 'achieved',
        goal_status: 'achieved',
        treat_as_complete: true,
      }),
      consecutiveFailures: 2,
      iterationsRemaining: 5,
    });
    expect(d.action).toBe('pass');
    expect(d.consecutiveFailures).toBe(0);
    expect(d.feedback).toBeUndefined();
  });

  it('单次未过 + 还有预算 ⇒ continue,且这一档不得被写成 blocked(两档必须可分)', () => {
    const d = decideGoalContinuation({
      verification: fullVerification(),
      consecutiveFailures: 0,
      iterationsRemaining: 5,
    });
    expect(d.action).toBe('continue');
    expect(d.consecutiveFailures).toBe(1);
    expect(d.verification.goal_status).toBe('not_achieved');
    expect(d.verification.goal_status).not.toBe('blocked');
  });

  it('回灌正文必须逐条点名 criterion_id / verdict / reason,并带上 unavailable_reason', () => {
    const d = decideGoalContinuation({
      verification: fullVerification({
        status: 'undetermined',
        goal_status: 'undetermined',
        unavailable_reason: '独立校验不可达: ECONNREFUSED',
      }),
      consecutiveFailures: 0,
      iterationsRemaining: 5,
    });
    expect(d.action).toBe('continue');
    expect(d.feedback).toContain('c1');
    expect(d.feedback).toContain('unmet');
    expect(d.feedback).toContain('exit=2');
    expect(d.feedback).toContain('ECONNREFUSED');
  });

  it('undetermined 与 not_achieved 同样计入连续未过(拿"没判成"当免费续跑就是 fail-open)', () => {
    const d = decideGoalContinuation({
      verification: fullVerification({
        status: 'undetermined',
        goal_status: 'undetermined',
        unavailable_reason: '校验返回体不是对象',
      }),
      consecutiveFailures: 0,
      iterationsRemaining: 9,
    });
    expect(d.action).toBe('continue');
    expect(d.consecutiveFailures).toBe(1);
  });

  it('连续未过到达上限 ⇒ blocked,且 verification.goal_status 落 blocked(与单次未过不同档)', () => {
    const d = decideGoalContinuation({
      verification: fullVerification(),
      consecutiveFailures: GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES - 1,
      iterationsRemaining: 9,
    });
    expect(d.action).toBe('blocked');
    expect(d.consecutiveFailures).toBe(GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES);
    expect(d.verification.goal_status).toBe('blocked');
    // 收口≠放行:落 blocked 时 treat_as_complete 必须仍是 false
    expect(d.verification.treat_as_complete).toBe(false);
    // 已经收口就不该再往循环里塞反馈消息
    expect(d.feedback).toBeUndefined();
  });

  it('预算耗尽 ⇒ 按未达标交账(deliver_unverified),绝不得当 pass —— 这一条就是 fail-open 锁', () => {
    for (const remaining of [0, -3]) {
      const d = decideGoalContinuation({
        verification: fullVerification(),
        consecutiveFailures: 0,
        iterationsRemaining: remaining,
      });
      expect(d.action).toBe('deliver_unverified');
      expect(d.verification.treat_as_complete).toBe(false);
      expect(d.consecutiveFailures).toBe(1);
    }
  });

  it('判序:同一轮既没预算又到达上限 ⇒ blocked 优先(收口比"没预算"更具体)', () => {
    const d = decideGoalContinuation({
      verification: fullVerification(),
      consecutiveFailures: GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES - 1,
      iterationsRemaining: 0,
    });
    expect(d.action).toBe('blocked');
  });

  it('不原地改写传入的 verification 对象(调用方还要拿它交账)', () => {
    const v = fullVerification();
    const snapshot = structuredClone(v);
    const d = decideGoalContinuation({
      verification: v,
      consecutiveFailures: GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES - 1,
      iterationsRemaining: 0,
    });
    expect(v).toEqual(snapshot);
    // 落 blocked 时改的是副本:原对象档位仍是 not_achieved,新档才可见
    expect(v.goal_status).toBe('not_achieved');
    expect(d.verification.goal_status).toBe('blocked');
    expect(d.verification).not.toBe(v);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
