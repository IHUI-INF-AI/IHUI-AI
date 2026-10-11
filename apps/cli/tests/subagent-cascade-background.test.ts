// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816029 —— 子代理被停/结束时,它自己派生的后台任务必须级联结算,不许留孤儿。
 *
 * 成对判据(票面验收三条 + 归属边界):
 *  ① 子代理被取消 ⇒ 它派生的在飞后台任务进入终态,事件带 `subagent_cancelled` 档;
 *  ② 子代理正常完成 ⇒ 后台任务**不**被误结算(级联写成无条件清账就是把长跑任务杀了);
 *  ③ 事件不得重复封口(幂等:第二次结算不发第二次终态、不重投通知);
 *  ④ 无归属(REPL / 主会话)的任务永远不动;
 *  ⑤ 另一个 agent 的任务永远不动(级联不得写成"清全场");
 *  ⑥ 结算动作在**三处至少一处可量到**:注册表状态、终态通知投递、跨进程台账 note。
 *
 * 台账落点用 IHUI_HOME + mkScratch(§26 唯一夹具落点,同 background-ledger.test.ts 的口径)。
 *
 * 跑:pnpm --filter @ihui/cli test -- tests/subagent-cascade-background.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
// arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边(同 background-ledger.test.ts)
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs';

/**
 * setupAgentTools / runToolLoop 用 mock:级联的接线点在 `dispatch_subagent` 的 finally,
 * 走真 loop 会把整条 provider 调用链拖进这一枚用例(与本票要证的判据无关)。
 * mock 里做两件事:① 记下收到的 agentId(归属必须真的从 ctx 下发,不是门里猜的);
 * ② 以那个 agentId 登记一枚在飞后台任务 —— 就是"子代理派生了后台任务"的最小模型。
 */
const seen: { agentId?: string } = {};
vi.mock('../src/commands/agent.js', () => ({
  setupAgentTools: vi.fn(async (opts: Record<string, unknown>) => {
    seen.agentId = opts.agentId as string | undefined;
    const { registerTask } = await import('../src/tools/background-registry.js');
    registerTask(fakeChild(), 'mock background task from subagent', { ownerAgentId: seen.agentId });
    return { systemPrompt: '', ctx: { workspacePath: '/test-ws' }, skills: [], memory: [] };
  }),
  runToolLoop: vi.fn(async () => ({
    stopReason: 'end_turn',
    assistantText: 'task done',
    iterations: 1,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
  })),
}));

vi.mock('../src/hooks/index.js', () => ({ runHook: vi.fn(() => ({ proceed: true })) }));
vi.mock('../src/subagents/worktree.js', () => ({
  createWorktree: vi.fn(() => ({ path: '/fake-wt', branch: 'b', parentId: 'p', subagentId: 's', createdAt: '' })),
  createWorktreeWithFallback: vi.fn(async () => ({ path: '/fake-wt', branch: 'b', parentId: 'p', subagentId: 's', createdAt: '' })),
  removeWorktree: vi.fn(() => true),
}));

import {
  registerTask,
  getTask,
  listTasks,
  clearAllTasks,
  settleTasksOwnedByAgent,
  __test__,
} from '../src/tools/background-registry.js';
import { summarizeLedger } from '../src/tools/background-ledger.js';
import { createSubagentTool, resolveSubagentCascadeReason } from '../src/tools/subagent.js';
import { runToolLoop, setupAgentTools } from '../src/commands/agent.js';
import { clearTools, registerTools, type Tool } from '../src/tools/index.js';

/** 假子进程:kill 立刻在微任务里回一发 close(真进程的形状:信号 → close)。 */
function fakeChild(): ChildProcess {
  const child = new EventEmitter() as unknown as ChildProcess & { kill: (s?: string) => boolean };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {
    queueMicrotask(() => child.emit('close', null, 'SIGTERM'));
    return true;
  };
  return child;
}

function makeTool(name: string): Tool {
  return {
    name,
    description: `${name} tool`,
    parameters: {},
    required: [],
    execute: async () => ({ success: true, output: '' }),
  };
}

const baseParent = {
  modelId: 'test-model',
  apiUrl: 'http://localhost:1/v1',
  apiKey: 'test-key',
  workspacePath: '/test-ws',
  sessionId: 'parent-1',
};

let scratch = '';
let previousHome: string | undefined;
let tmpStateDir = '';

beforeEach(() => {
  scratch = mkScratch('sub-cascade-');
  previousHome = process.env.IHUI_HOME;
  process.env.IHUI_HOME = path.join(scratch, 'home');
  tmpStateDir = path.join(scratch, 'subagents');
  fs.mkdirSync(tmpStateDir, { recursive: true });
  process.env.IHUI_SUBAGENT_STATE_DIR = tmpStateDir;
  clearAllTasks();
  seen.agentId = undefined;
  vi.mocked(setupAgentTools).mockClear();
  vi.mocked(runToolLoop).mockClear();
  clearTools();
  registerTools([makeTool('read_file'), makeTool('write_file'), makeTool('run_command')]);
});

afterEach(() => {
  clearAllTasks();
  if (previousHome === undefined) delete process.env.IHUI_HOME;
  else process.env.IHUI_HOME = previousHome;
  delete process.env.IHUI_SUBAGENT_STATE_DIR;
  if (scratch) rmScratch(scratch);
  scratch = '';
});

/** 台账里该任务那一条的 note(落库面的读数;取不到就返回空串,由断言去红)。 */
function ledgerNote(id: string): string {
  const summary = summarizeLedger({ liveIds: listTasks().map((t) => t.id) });
  const entry = summary.entries.find((e) => e.record.id === id);
  return entry ? entry.record.note : '';
}

describe('resolveSubagentCascadeReason —— 三档结论的唯一出口', () => {
  it('①配对:被取消(aborted / cancelled)⇒ subagent_cancelled', () => {
    expect(resolveSubagentCascadeReason({ stopReason: 'completed', aborted: true })).toBe('subagent_cancelled');
    expect(resolveSubagentCascadeReason({ stopReason: 'cancelled' })).toBe('subagent_cancelled');
  });

  it('②配对:正常完成 ⇒ undefined(级联写成无条件清账就是把长跑任务杀了)', () => {
    expect(resolveSubagentCascadeReason({ stopReason: 'completed' })).toBeUndefined();
    expect(resolveSubagentCascadeReason({ stopReason: 'completed', aborted: false })).toBeUndefined();
  });

  it('没正常完成(failed)⇒ subagent_terminal:task_id 只在子代理 context 里,不清就是孤儿', () => {
    expect(resolveSubagentCascadeReason({ stopReason: 'failed' })).toBe('subagent_terminal');
  });

  it('aborted 优先于 failed:同一时刻两件事两条轴,原因档要说"是被停的"', () => {
    expect(resolveSubagentCascadeReason({ stopReason: 'failed', aborted: true })).toBe('subagent_cancelled');
  });
});

describe('settleTasksOwnedByAgent —— 只结算归属该 agent 的在飞任务', () => {
  it('① 归属命中 ⇒ 进入终态 + 事件带 subagent_cancelled(计数 / 通知 / 落库三处一起量到)', async () => {
    const id = registerTask(fakeChild(), 'npm run dev', { ownerAgentId: 'sa-1' });
    const notices: unknown[] = [];
    const off = __test__.addSettleListener(id, (snap) => notices.push(snap));
    try {
      const report = await settleTasksOwnedByAgent('sa-1', 'subagent_cancelled');
      // 计数面
      expect(report.inFlightAtEntry).toBe(1);
      expect(report.settled).toEqual([id]);
      expect(report.unknown).toEqual([]);
      expect(getTask(id)!.status).toBe('killed');
      // 落库面:台账 note 必须带原因,否则"宿主替谁收的"与"外部 OOM 杀"在账面上同形
      expect(ledgerNote(id)).toMatch(/settled by subagent_cancelled/);
      // 队列面:终态通知必须把这档递给等待者,而不是只改内部对象
      expect(notices).toHaveLength(1);
      expect((notices[0] as { settledBy?: string }).settledBy).toBe('subagent_cancelled');
      expect((notices[0] as { ownerAgentId?: string }).ownerAgentId).toBe('sa-1');
    } finally {
      off();
    }
  });

  it('③ 幂等:第二次结算不发第二次终态、不重投通知、不改 exitedAt', async () => {
    const id = registerTask(fakeChild(), 'sleep 60', { ownerAgentId: 'sa-2' });
    const notices: unknown[] = [];
    const off = __test__.addSettleListener(id, (snap) => notices.push(snap));
    try {
      const first = await settleTasksOwnedByAgent('sa-2', 'subagent_cancelled');
      const firstExitedAt = getTask(id)!.exitedAt;
      const second = await settleTasksOwnedByAgent('sa-2', 'subagent_cancelled');
      expect(first.settled).toHaveLength(1);
      // 第二次必须在**入口时刻**就认出"它已经终态",而不是再发一遍信号
      expect(second.inFlightAtEntry).toBe(0);
      expect(second.settled).toEqual([]);
      expect(second.alreadyTerminal).toEqual([id]);
      expect(notices).toHaveLength(1);
      expect(getTask(id)!.exitedAt).toBe(firstExitedAt);
    } finally {
      off();
    }
  });

  it('④ 无归属(undefined)一律不碰 —— 级联不是"清全场"', async () => {
    const id = registerTask(fakeChild(), '用户自己起的长跑任务', undefined);
    const byAgent = await settleTasksOwnedByAgent('sa-3', 'subagent_cancelled');
    expect(byAgent.inFlightAtEntry).toBe(0);
    expect(getTask(id)!.status).toBe('running');
    const byNothing = await settleTasksOwnedByAgent(undefined, 'subagent_cancelled');
    expect(byNothing.inFlightAtEntry).toBe(0);
    expect(getTask(id)!.status).toBe('running');
  });

  it('⑤ 别的 agent 的任务不得被顺手杀掉(只结算同名归属那一族)', async () => {
    const mine = registerTask(fakeChild(), 'mine', { ownerAgentId: 'sa-a' });
    const theirs = registerTask(fakeChild(), 'theirs', { ownerAgentId: 'sa-b' });
    const report = await settleTasksOwnedByAgent('sa-a', 'subagent_terminal');
    expect(report.settled).toEqual([mine]);
    expect(getTask(mine)!.status).toBe('killed');
    expect(getTask(theirs)!.status).toBe('running');
    expect(listTasks().filter((t) => t.status === 'running').map((t) => t.id)).toContain(theirs);
    await settleTasksOwnedByAgent('sa-b', 'subagent_terminal');
    expect(getTask(theirs)!.status).toBe('killed');
  });

  it('⑥ agentId 缺席/空串不得被读成"全清"', async () => {
    const id = registerTask(fakeChild(), 'orphan?', { ownerAgentId: 'sa-c' });
    expect((await settleTasksOwnedByAgent(undefined, 'subagent_cancelled')).inFlightAtEntry).toBe(0);
    expect((await settleTasksOwnedByAgent('', 'subagent_cancelled')).inFlightAtEntry).toBe(0);
    expect(getTask(id)!.status).toBe('running');
    const r3 = await settleTasksOwnedByAgent('sa-c', 'subagent_cancelled');
    expect(r3.settled).toEqual([id]);
  });

  it('⑦ 真 close 先到(不是我们发的信号):结算不得改写已终态的任务(终态单向门)', async () => {
    const child = new EventEmitter() as unknown as ChildProcess & { kill: (s?: string) => boolean };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => true;
    const id = registerTask(child, 'already over', { ownerAgentId: 'sa-d' });
    child.emit('close', 0, null); // 自己正常退出
    expect(getTask(id)!.status).toBe('exited');
    const report = await settleTasksOwnedByAgent('sa-d', 'subagent_cancelled');
    expect(report.inFlightAtEntry).toBe(0);
    expect(report.alreadyTerminal).toEqual([id]);
    expect(getTask(id)!.status).toBe('exited');
    expect(getTask(id)!.exitCode).toBe(0);
    // 已经终态的条目**不得**被贴上级联原因 —— 那是把"它自己跑完了"改写成"我替它收的"
    expect(getTask(id)!.settledBy).toBeUndefined();
  });
});

describe('接线 —— dispatch_subagent 的 finally 必须真的调用级联出口', () => {
  function dispatch(args: Record<string, unknown>, ctx?: Record<string, unknown>) {
    const tool = createSubagentTool(baseParent);
    return tool.execute(args as never, ({ workspacePath: '/test-ws', ...(ctx ?? {}) }) as never);
  }

  it('①子代理被 abort ⇒ 派生的在飞任务进入终态,原因档是 subagent_cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const res = await dispatch({ task: '带后台任务的子任务', persona: 'general' }, { signal: controller.signal });
    expect(res.success).toBe(true); // 归因不得改变子代理结果本身
    const rows = listTasks();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((t) => t.status !== 'running')).toBe(true);
    for (const row of rows) {
      expect(getTask(row.id)!.settledBy).toBe('subagent_cancelled');
      expect(ledgerNote(row.id)).toMatch(/settled by subagent_cancelled/);
    }
    // mock 记下的 agentId 证明归属是从 ctx 一路下发到注册点的
    expect(typeof seen.agentId).toBe('string');
    expect(seen.agentId).toBe(rows[0] && getTask(rows[0].id)!.ownerAgentId);
  });

  it('②子代理正常完成 ⇒ 在飞任务一律不动(反向锁)', async () => {
    const res = await dispatch({ task: '正常完成的子任务', persona: 'general' });
    expect(res.success).toBe(true);
    const rows = listTasks();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((t) => t.status === 'running')).toBe(true);
    for (const row of rows) expect(getTask(row.id)!.settledBy).toBeUndefined();
    // 收尾:用例之间不留活体(显式结算,证明"结算"与"完成时自动结算"是两件事)
    const cleanup = await settleTasksOwnedByAgent(seen.agentId, 'subagent_terminal');
    expect(cleanup.settled).toHaveLength(rows.length);
  });

  it('②b 子代理失败(未正常完成)⇒ 结算并带 subagent_terminal 档', async () => {
    vi.mocked(runToolLoop).mockRejectedValueOnce(new Error('provider 挂了'));
    const res = await dispatch({ task: '会失败的子任务', persona: 'general' });
    expect(res.success).toBe(false);
    const rows = listTasks();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((t) => t.status !== 'running')).toBe(true);
    for (const row of rows) {
      expect(getTask(row.id)!.settledBy).toBe('subagent_terminal');
      expect(ledgerNote(row.id)).toMatch(/settled by subagent_terminal/);
    }
  });

  it('③重复终态不发第二次封口:同一子代理再走一次收尾不重投通知', async () => {
    const controller = new AbortController();
    controller.abort();
    await dispatch({ task: '取消一次', persona: 'general' }, { signal: controller.signal });
    const ids = listTasks().map((t) => t.id);
    expect(ids.length).toBeGreaterThan(0);
    const notices: unknown[] = [];
    const offs = ids.map((id) => __test__.addSettleListener(id, (s) => notices.push(s)));
    try {
      const again = await settleTasksOwnedByAgent(seen.agentId, 'subagent_cancelled');
      expect(again.inFlightAtEntry).toBe(0);
      expect(again.settled).toEqual([]);
      expect(again.alreadyTerminal.sort()).toEqual([...ids].sort());
      expect(notices).toEqual([]); // 已终态 ⇒ 一条都不投
    } finally {
      for (const off of offs) off();
    }
  });

  it('④主会话(REPL 路径,无 agentId)的任务不参与级联', async () => {
    const userOwned = registerTask(fakeChild(), '用户自己在 REPL 起的', undefined);
    const controller = new AbortController();
    controller.abort();
    await dispatch({ task: '子代理跑一次并取消', persona: 'general' }, { signal: controller.signal });
    expect(getTask(userOwned)!.status).toBe('running');
    expect(getTask(userOwned)!.settledBy).toBeUndefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
