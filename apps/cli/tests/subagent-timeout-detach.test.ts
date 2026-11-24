// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-426 拍板第三件套「超阈值自动后台化 detachParent」回归(in-process dispatch_subagent 面)。
 *
 * 立论:转后台的判据单独成函数(resolveSubagentTimeoutAction,与 resolveSubagentCascadeReason
 * 同一条"走完整条 dispatch 才能验这一格"的立论),纯函数边界在这里钉死;接线面走真实
 * `dispatch_subagent.execute`(fork/工具注册/hooks 全 mock,形态对齐 subagent-extended.test.ts),
 * 断言打在生产出口上(子 loop 收到的 signal / 状态库 / stderr 通知 / 级联结算调用)。
 *
 * 四条行为对照:
 *   ① exec-budget 到点且台账显示仍在推进(idle < 预算,即绝对上限触发)⇒ 子 loop 的 signal
 *      **未**被中止(转后台,不杀),状态落 detached_idle(中间态,非终态);自然完成后
 *      状态落 completed、不触发级联清账(与"正常完成一律不动"同一条)。
 *   ② exec-budget 到点且整段预算零推进(idle ≥ 预算)⇒ 照旧中止:子 loop signal 被中止,
 *      走既有失败+级联路径("无活动的照旧超时")。
 *   ③ 父级真取消(非 budget reason)⇒ 照旧中止,判据不得把父取消误判成转后台。
 *   ④ 无外层 signal ⇒ 与改前逐字等价:传给子 loop 的 signal 是 undefined,不建任何监听。
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

vi.mock('../src/commands/agent.js', () => ({
  setupAgentTools: vi.fn(async () => ({
    systemPrompt: '',
    ctx: { workspacePath: '/test-ws' },
    skills: [],
    memory: [],
  })),
  runToolLoop: vi.fn(),
}));

vi.mock('../src/hooks/index.js', () => ({
  runHook: vi.fn(() => ({ proceed: true })),
}));

vi.mock('../src/tools/background-registry.js', () => ({
  settleTasksOwnedByAgent: vi.fn(
    async () => ({ inFlightAtEntry: 0, unknown: [] as string[] }),
  ),
}));

import {
  createSubagentTool,
  resolveSubagentTimeoutAction,
  type SubagentParentOptions,
} from '../src/tools/subagent.js';
import { setupAgentTools, runToolLoop } from '../src/commands/agent.js';
import { runHook } from '../src/hooks/index.js';
import { settleTasksOwnedByAgent } from '../src/tools/background-registry.js';
import { loadSubagentState } from '../src/subagents/state-store.js';
import { SUBAGENT_STATUS_DETACHED_IDLE, isSubagentTerminalStatus } from '../src/subagents/types.js';
import type { ToolContext, ToolResult } from '../src/tools/index.js';

// 名义预算(subagent.ts 的 SUBAGENT_EXEC_BUDGET_MS,未导出;判据与它同值)
const BUDGET_MS = 60 * 60_000;

const baseParentOpts: SubagentParentOptions = {
  modelId: 'test-model',
  apiUrl: 'http://localhost:8801',
  apiKey: 'test-key',
  workspacePath: '/test-ws',
  sessionId: 'parent-1',
};

/** runToolLoop 收到的形参里接线面关心的那一角 */
interface CapturedLoop {
  signal?: AbortSignal;
  onDelta?: () => void;
  onToolCall?: () => void;
  onToolResult?: () => void;
}
let captured: CapturedLoop | undefined;
let resolveLoop!: (value: unknown) => void;
let rejectLoop!: (reason?: unknown) => void;

function armLoopMock(): void {
  (runToolLoop as unknown as Mock).mockImplementation(async (opts: unknown) => {
    captured = opts as CapturedLoop;
    return new Promise((resolve, reject) => {
      resolveLoop = resolve;
      rejectLoop = reject;
    });
  });
}

/** 挂起中的 loop 的成功终态(与 subagent-extended 的 mock 同形) */
function settleLoopOk(text = 'task done'): void {
  resolveLoop({
    stopReason: 'end_turn',
    assistantText: text,
    iterations: 1,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
  });
}

function dispatchedSubagentId(): string {
  const start = (runHook as unknown as Mock).mock.calls.find(
    (c: unknown[]) => c[0] === 'subagentStart',
  );
  if (!start) throw new Error('runHook 未收到 subagentStart 调用');
  return (start[1] as { subagentId: string }).subagentId;
}

/** exec-budget 到点时合成 signal 携带的 reason(唯一生成处在 tools/index.ts enterGrace) */
function budgetReason(): Error {
  return new Error('ihui:exec-budget:dispatch_subagent');
}

let stderrSpy: ReturnType<typeof vi.spyOn>;
let tmpStateDir: string;

beforeEach(() => {
  tmpStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-g426-detach-'));
  process.env.IHUI_SUBAGENT_STATE_DIR = tmpStateDir;
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  captured = undefined;
  armLoopMock();
  vi.mocked(setupAgentTools).mockClear();
  (runToolLoop as unknown as Mock).mockClear();
  (runHook as unknown as Mock).mockClear();
  (settleTasksOwnedByAgent as unknown as Mock).mockClear();
});

afterEach(() => {
  stderrSpy.mockRestore();
  delete process.env.IHUI_SUBAGENT_STATE_DIR;
  fs.rmSync(tmpStateDir, { recursive: true, force: true });
  vi.useRealTimers();
});

describe('resolveSubagentTimeoutAction:超阈值处置判据(纯函数,唯一出口)', () => {
  it('idle < budget ⇒ detach(绝对上限到点仍在推进,不杀)', () => {
    expect(resolveSubagentTimeoutAction({ idleMs: 0, budgetMs: BUDGET_MS })).toBe('detach');
    expect(resolveSubagentTimeoutAction({ idleMs: BUDGET_MS - 1, budgetMs: BUDGET_MS })).toBe('detach');
  });

  it('idle == budget ⇒ abort(整段空闲窗耗尽 = 判据口径下的卡死;边界取等不归 detach)', () => {
    expect(resolveSubagentTimeoutAction({ idleMs: BUDGET_MS, budgetMs: BUDGET_MS })).toBe('abort');
  });

  it('idle > budget ⇒ abort(真无活动,照旧超时)', () => {
    expect(resolveSubagentTimeoutAction({ idleMs: BUDGET_MS + 1, budgetMs: BUDGET_MS })).toBe('abort');
  });
});

describe('dispatch_subagent 接线面:exec-budget 到点的两档处置', () => {
  function startDispatch(outerSignal?: AbortSignal, reportExecActivity?: () => void) {
    const tool = createSubagentTool(baseParentOpts);
    return tool.execute(
      { task: '长任务' },
      {
        workspacePath: '/test-ws',
        ...(outerSignal ? { signal: outerSignal } : {}),
        ...(reportExecActivity ? { reportExecActivity } : {}),
      } as ToolContext,
    );
  }

  it('① 到点且仍在推进 ⇒ 转后台:子 loop signal 未中止、状态落 detached_idle;自然完成回收 completed 且不级联清账', async () => {
    const parentCtrl = new AbortController();
    const reportExecActivity = vi.fn();
    const execP = startDispatch(parentCtrl.signal, reportExecActivity);
    await new Promise((r) => setTimeout(r, 0)); // 真实微任务链:execute → setupAgentTools → runToolLoop
    expect(captured).toBeDefined();
    expect(captured!.signal).toBeDefined();

    captured!.onDelta!(); // 真实推进:活动台账 + 外层执行窗都收到
    expect(reportExecActivity).toHaveBeenCalled();

    const subId = dispatchedSubagentId();
    parentCtrl.abort(budgetReason()); // 预算窗到点
    expect(captured!.signal!.aborted).toBe(false); // 不杀:子 loop 继续跑
    const detachedState = loadSubagentState(subId);
    expect(detachedState!.status).toBe(SUBAGENT_STATUS_DETACHED_IDLE);
    expect(isSubagentTerminalStatus(SUBAGENT_STATUS_DETACHED_IDLE)).toBe(false); // 中间态,不是终态
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('detached to background'));

    settleLoopOk('最终报告');
    const res = (await execP) as ToolResult;
    expect(res.success).toBe(true);
    // 完成事件里回收:状态库落真终态 + stderr 出声;自然完成 ⇒ 级联清账不得触发
    expect(loadSubagentState(subId)!.status).toBe('completed');
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('detached subagent settled: stopReason=completed'),
    );
    expect(settleTasksOwnedByAgent).not.toHaveBeenCalled();
  });

  it('② 到点且整段预算零推进 ⇒ 照旧中止:子 loop signal 被中止,走既有失败+级联路径', async () => {
    vi.useFakeTimers();
    const parentCtrl = new AbortController();
    const execP = startDispatch(parentCtrl.signal);
    await vi.advanceTimersByTimeAsync(0); // 走完微任务链,loop 挂起
    expect(captured).toBeDefined();

    // 整段预算内没有任何真实推进(onDelta/onToolCall/onToolResult 一次都没发生)
    vi.setSystemTime(Date.now() + BUDGET_MS + 1);
    parentCtrl.abort(budgetReason());
    expect(captured!.signal!.aborted).toBe(true); // 照旧中止("无活动的照旧超时")

    rejectLoop(new Error('The operation was aborted'));
    const res = (await execP) as ToolResult;
    expect(res.success).toBe(false);
    expect(res.error).toContain('子 agent 执行失败');
    expect(settleTasksOwnedByAgent).toHaveBeenCalledWith(
      dispatchedSubagentId(),
      'subagent_cancelled',
    );
  });

  it('③ 父级真取消(非 budget reason)⇒ 照旧中止,不得被误判成转后台', async () => {
    const parentCtrl = new AbortController();
    const execP = startDispatch(parentCtrl.signal);
    await new Promise((r) => setTimeout(r, 0));
    expect(captured).toBeDefined();

    captured!.onDelta!(); // 有推进也拦不住父取消
    parentCtrl.abort(new Error('user interrupt')); // reason 不带 ihui:exec-budget: 前缀
    expect(captured!.signal!.aborted).toBe(true);

    rejectLoop(new Error('The operation was aborted'));
    const res = (await execP) as ToolResult;
    expect(res.success).toBe(false);
    expect(settleTasksOwnedByAgent).toHaveBeenCalledWith(
      dispatchedSubagentId(),
      'subagent_cancelled',
    );
  });

  it('④ 无外层 signal ⇒ 与改前逐字等价:传给子 loop 的 signal 是 undefined,正常完成', async () => {
    const execP = startDispatch();
    await new Promise((r) => setTimeout(r, 0));
    expect(captured).toBeDefined();
    expect(captured!.signal).toBeUndefined();

    settleLoopOk();
    const res = (await execP) as ToolResult;
    expect(res.success).toBe(true);
    expect(settleTasksOwnedByAgent).not.toHaveBeenCalled();
  });
});
