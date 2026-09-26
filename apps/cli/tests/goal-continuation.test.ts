// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AGENTS.md §8 第 4 步"连续 N 轮 no 无进展 → blocked"的**循环侧**验收。
 *
 * 与 goal-verification.test.ts 的分工:那一份判纯函数decide 的档位划分,这一份判
 * **循环真的照它行事** —— 未过就续跑、到达上限就收口、非 goal 模式一律不动。
 * 所以这里必须驱动 `runToolLoop` 本体(mock 掉 streamChat 与校验端),而不是再抄一遍判据:
 * "函数在、自检过,但调用位没挂上"是本仓最高频的失效型(守门 70/76/81/102 同型)。
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearTools, registerTools, type Tool } from '../src/tools/index.js';

type StreamChatOpts = {
  model: string;
  messages: unknown[];
  onDelta: (delta: string) => void;
  onError?: (err: string) => void;
  onDone?: () => void;
};
type StreamChatFn = (opts: StreamChatOpts) => Promise<void>;

const { streamChatMock } = vi.hoisted(() => ({ streamChatMock: vi.fn<StreamChatFn>() }));

vi.mock('@ihui/api-client', () => ({
  streamChat: streamChatMock,
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  // goal-verification.ts 的缺省出口;本套用例一律走 requestGoalVerification 注入,
  // 但模块求值要求这个名字存在 —— 缺了它,装车证明就跑不起来而不是少测一条。
  fetchAiServiceJson: vi.fn(),
  formatSSEError: (err: unknown) => ({
    severity: 'unknown' as const,
    title: 'error',
    message: err instanceof Error ? err.message : String(err),
    rawMessage: err instanceof Error ? err.message : String(err),
    requireReauth: false,
  }),
}));

vi.mock('../src/audit.js', () => ({ auditLog: vi.fn() }));

// vi.mock 会被提到文件顶部，故静态 import 拿到的已是 mock 后的模块
import { runToolLoop, stopReasonToExitCode } from '../src/commands/agent.js';

const silentTool: Tool = {
  name: 'noop',
  description: 'noop',
  parameters: {},
  required: [],
  execute: async () => ({ success: true, output: 'ok' }),
};

/** 每次都判"未达标"的校验端；criterion_id 与正文都送得出来，供回灌文案断言 */
const failingVerdict = () => ({
  status: 'not_achieved',
  treat_as_complete: false,
  criteria: [
    {
      criterion_id: 'c1',
      statement: 'tests must pass',
      verdict: 'unmet',
      basis: 'machine',
      reason: 'exit=1',
      evidence_ids: ['e1'],
      contradicted: false,
    },
  ],
  independent_request_made: true,
});

const passingVerdict = () => ({
  status: 'achieved',
  treat_as_complete: true,
  criteria: [
    {
      criterion_id: 'c1',
      statement: 'tests must pass',
      verdict: 'met',
      basis: 'machine',
      reason: '',
      evidence_ids: ['e1'],
      contradicted: false,
    },
  ],
  independent_request_made: true,
});

const goalCriteria = [
  {
    id: 'c1',
    statement: 'tests must pass',
    evidence_kind: 'command' as const,
    required: true,
  },
];

function setStreamResponses(responses: string[]): void {
  for (const text of responses) {
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      opts.onDelta(text);
    });
  }
}

/** 取循环里所有 user 消息正文（回灌的反馈消息就在其中） */
function userMessages(): string[] {
  return streamChatMock.mock.calls
    .flatMap((call) => (call[0]?.messages ?? []) as Array<{ role: string; content: unknown }>)
    .filter((m) => m.role === 'user')
    .map((m) => String(m.content));
}

describe('goal 校验未过的续跑与收口（循环侧装车证明）', () => {
  beforeEach(() => {
    clearTools();
    registerTools([silentTool]);
    streamChatMock.mockReset();
  });

  it('未过且有预算 ⇒ 不交账，把未达标项回灌后继续跑下一轮', async () => {
    setStreamResponses(['done', 'still working', 'done']);
    const requestGoalVerification = vi.fn(async () => failingVerdict());
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'reach the goal' },
    ];
    const result = await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: '.' },
      maxIterations: 6,
      goal: 'reach the goal',
      goalCriteria,
      requestGoalVerification,
    });

    // 校验跑了不止一次（未过就续跑），而不是"一次未过就地交账"
    expect(requestGoalVerification.mock.calls.length).toBeGreaterThan(1);
    expect(streamChatMock.mock.calls.length).toBe(requestGoalVerification.mock.calls.length);
    // 回灌正文点名未达标项（criterion_id / verdict / reason 三要素都在）
    const feedback = userMessages().filter((m) => m.includes('c1'));
    expect(feedback.length).toBeGreaterThan(0);
    expect(feedback[0]).toContain('unmet');
    expect(feedback[0]).toContain('exit=1');
    expect(result.stopReason).not.toBe('end_turn');
  });

  it('连续未过到达上限 ⇒ stopReason 落 goal_blocked，且与"单次未过"是两个档', () => {
    // 单次未过这一档在上一例里已经量到（仍在续跑），此处只锁"到达上限"那一档
    expect(stopReasonToExitCode('goal_blocked')).toBe(1);
    expect(stopReasonToExitCode('verification_not_achieved')).toBe(1);
    expect(stopReasonToExitCode('end_turn')).toBe(0);
  });

  it('到达上限后收口：循环停在这一次，verification.goal_status === blocked', async () => {
    setStreamResponses(['done', 'done', 'done', 'done', 'done']);
    const requestGoalVerification = vi.fn(async () => failingVerdict());
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'reach the goal' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 20,
      goal: 'reach the goal',
      goalCriteria,
      requestGoalVerification,
    });
    // 默认上限取跨端镜像常量（未过 3 次即收口），且没把 20 轮预算烧完
    expect(result.stopReason).toBe('goal_blocked');
    expect(requestGoalVerification.mock.calls.length).toBe(3);
    expect(result.iterations).toBeLessThan(20);
    expect(result.verification?.goal_status).toBe('blocked');
    expect(result.verification?.treat_as_complete).toBe(false);
  });

  it('校验通过 ⇒ 保持 end_turn，不制造额外轮次（续跑逻辑不得变成默认重试）', async () => {
    setStreamResponses(['done']);
    const requestGoalVerification = vi.fn(async () => passingVerdict());
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'reach the goal' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 6,
      goal: 'reach the goal',
      goalCriteria,
      requestGoalVerification,
    });
    expect(result.stopReason).toBe('end_turn');
    expect(requestGoalVerification.mock.calls.length).toBe(1);
    expect(streamChatMock.mock.calls.length).toBe(1);
    expect(result.verification?.treat_as_complete).toBe(true);
  });

  it('预算耗尽而仍未过 ⇒ 既不 pass 也不 blocked，按未达标档交账（fail-open 锁）', async () => {
    setStreamResponses(['done']);
    const requestGoalVerification = vi.fn(async () => failingVerdict());
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'reach the goal' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 1,
      goal: 'reach the goal',
      goalCriteria,
      requestGoalVerification,
    });
    expect(result.stopReason).toBe('verification_not_achieved');
    expect(stopReasonToExitCode(result.stopReason)).toBe(1);
    expect(result.verification?.goal_status).not.toBe('blocked');
  });

  it('非 goal 模式（未声明指标）⇒ 一次都不跑校验，行为与接线前逐零差异', async () => {
    setStreamResponses(['done']);
    const requestGoalVerification = vi.fn(async () => failingVerdict());
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'just talk' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      requestGoalVerification,
    });
    expect(result.stopReason).toBe('end_turn');
    expect(requestGoalVerification).not.toHaveBeenCalled();
  });

  it('装车证明：续跑/收口判定真挂在 commands/agent.ts 的调用位上（判调用位，不判 import）', () => {
    const src = readFileSync(new URL('../src/commands/agent.ts', import.meta.url), 'utf8');
    // 决策函数的调用位（只 import 不调用正是本仓最高频失效形态）
    expect(src).toContain('decideGoalContinuation({');
    // 收口档必须同时挂在两处：停止档的计算 + 退出码映射（缺后者就退 default，
    // 而 CI 读到的就是一个与 goal 无关的数字）
    expect(src).toContain('stopReason = STOP_GOAL_BLOCKED;');
    expect(src).toContain('case STOP_GOAL_BLOCKED:');
    // 续跑的那一步是真的往对话里塞了反馈（而非只计数）
    expect(src).toMatch(/opts\.messages\.push\(\{ role: 'user', content: decision\.feedback \}\)/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
