// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后台任务生命周期钩子(taskCreated / taskCompleted)接线锁。
 *
 * 对齐轴:Qoder/Trae 都在"命令转后台"与"它跑完了"这两个时刻出声(取证见
 * docs/benchmark-evidence/2026-10/trae-rea-20261031/T1-trae-ai-agent.md)。本仓事件源
 * 早就在 background-registry,缺的只是钩子面。
 *
 * 本册真正在钉的是**派发位置**,不是"有没有这个函数":
 * ① taskCompleted 必须落在 `notifySettled` 的**代际归属门之后、投递/去重裁决之前**。
 *    放在函数尾部会被 `if (!set || set.size === 0) return` 挡掉 —— 而"转后台后没人 join"
 *    恰是最常见的情形,那样钩子等于没接(这条是本票实现时踩到的第一个真坑)。
 * ② 配对不变式:一枚 taskCreated 恰好对应一次 taskCompleted,含"从未有过进程"的占位任务。
 * ③ 归属轴(本仓超越点,对方单会话形态结构上不需要):ownerAgentId / worktreePath 必须
 *    随事件带出,否则多席共写一棵树时钩子无法做到"谁的后台任务只通知谁"。
 * ④ 失效方向:钩子层炸了不得把登记面/终态处理带崩,也不得静默(落 stderr 通道)。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 类型面走 `import type`(门 99 的 consistent-type-imports 禁内联 import() 类型注解)
import type * as HooksModule from '../src/hooks/index.js';

const runHookSpy = vi.hoisted(() => vi.fn());

vi.mock('../src/hooks/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof HooksModule>();
  return { ...actual, runHook: runHookSpy };
});

import {
  registerTask,
  registerFailedTask,
  getTask,
  __test__,
  type BackgroundTask,
} from '../src/tools/background-registry.js';

type Ctx = Record<string, unknown>;
type Call = { event: string; ctx: Ctx };

/** 取某事件的派发记录(按发生顺序)。 */
function callsFor(event: string): Call[] {
  return runHookSpy.mock.calls
    .map(([e, c]) => ({ event: e as string, ctx: (c ?? {}) as Ctx }))
    .filter((x) => x.event === event);
}

function resolveHookResult(): Promise<{ allowed: true; modified?: undefined }> {
  return Promise.resolve({ allowed: true } as { allowed: true; modified?: undefined });
}

let stderrLines: string[] = [];
let origWrite: typeof process.stderr.write;

beforeEach(() => {
  runHookSpy.mockReset();
  runHookSpy.mockImplementation(() => resolveHookResult());
  stderrLines = [];
  origWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrLines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
    return true;
  }) as typeof process.stderr.write;
});

afterEach(() => {
  process.stderr.write = origWrite;
});

describe('taskCreated —— 登记即出声', () => {
  it('① registerTask 派发一次 taskCreated,载荷带 id/命令,且状态是 running', () => {
    const id = registerTask(null, 'echo hello', { ownerAgentId: 'agent-7' });

    const created = callsFor('taskCreated');
    expect(created).toHaveLength(1);
    expect(created[0].ctx.taskId).toBe(id);
    expect(created[0].ctx.taskCommand).toBe('echo hello');
    expect(created[0].ctx.taskStatus).toBe('running');
  });

  it('② 登记档不得塞退出码:undefined(还没结束)与 null(被信号终止)是两件事', () => {
    registerTask(null, 'echo x');
    const ctx = callsFor('taskCreated')[0].ctx;
    expect('taskExitCode' in ctx).toBe(false);
  });

  it('③ 归属轴随事件带出(超越点:谁的后台任务只通知谁)', () => {
    const id = registerTask(null, 'pnpm build', {
      ownerAgentId: 'agent-9',
      worktreePath: 'G:/IHUI-AI/.worktrees/wt-demo',
    });
    const ctx = callsFor('taskCreated')[0].ctx;
    expect(ctx.taskOwnerAgentId).toBe('agent-9');
    expect(ctx.taskWorktreePath).toBe('G:/IHUI-AI/.worktrees/wt-demo');
    expect(getTask(id)?.ownerAgentId).toBe('agent-9');
  });
});

describe('taskCompleted —— 派发位置是本册的牙', () => {
  /** 造一条已落终态、且**没有任何等待者**的任务,再走真实收口。 */
  function settleWithoutWaiters(status: 'exited' | 'error' | 'killed', exitCode: number | null): BackgroundTask {
    const id = registerTask(null, 'sleep 1');
    const task = getTask(id);
    expect(task).not.toBeNull();
    const live = task as BackgroundTask;
    runHookSpy.mockClear(); // 只留终态这一跳
    live.status = status;
    live.exitCode = exitCode;
    live.exitedAt = new Date().toISOString();
    __test__.notifySettled(live);
    return live;
  }

  it('④ 没有等待者也必须派发(放函数尾部会被 set.size===0 提前 return 整批漏掉)', () => {
    settleWithoutWaiters('exited', 0);
    expect(callsFor('taskCompleted')).toHaveLength(1);
  });

  it('⑤ 终态载荷读的是已落定的状态,不是登记时的 running', () => {
    settleWithoutWaiters('killed', null);
    const ctx = callsFor('taskCompleted')[0].ctx;
    expect(ctx.taskStatus).toBe('killed');
    expect(ctx.taskExitCode).toBeNull(); // 被信号终止:确实没有码
  });

  it('⑥ 迟到旧世代的终态不得二次派发(代际归属门排在派发之前)', () => {
    const live = settleWithoutWaiters('exited', 0);
    // 同一 key 上如今站着新一代登记 ⇒ 旧对象再进来的终态必须整段拒收
    const incoming: BackgroundTask = { ...live, identity: `${live.identity}-renewed` };
    registerTask(null, 'sleep 1');
    runHookSpy.mockClear();
    __test__.notifySettled(incoming);
    expect(callsFor('taskCompleted')).toHaveLength(0);
  });

  it('⑦ 配对不变式:占位任务(从未有过进程)也必须两档齐全', () => {
    const id = registerFailedTask('cargo build', 'sandbox refused');
    const created = callsFor('taskCreated');
    const completed = callsFor('taskCompleted');
    expect(created).toHaveLength(1);
    expect(completed).toHaveLength(1);
    expect(created[0].ctx.taskId).toBe(id);
    expect(completed[0].ctx.taskId).toBe(id);
    // 成对而不是一枚:只发 created 会让下游把"沙盒拒绝"记成永久在跑
    expect(completed[0].ctx.taskStatus).toBe(getTask(id)?.status);
  });
});

describe('失效方向 —— 钩子坏了不许带崩主链', () => {
  it('⑧ 钩子层同步抛错:登记仍然成功返回 id,且必须留下一行可见诊断(不静默)', () => {
    runHookSpy.mockImplementation(() => {
      throw new Error('hooks config unreadable');
    });
    const id = registerTask(null, 'echo still-registered');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(stderrLines.join('')).toContain('taskCreated hook dispatch failed');
  });

  it('⑨ 钩子体 reject:不许冒未捕获拒绝,同样必须点名', async () => {
    runHookSpy.mockImplementation(() => Promise.reject(new Error('hook exited 3')));
    registerTask(null, 'echo ok');
    await Promise.resolve();
    await Promise.resolve();
    expect(stderrLines.join('')).toContain('taskCreated hook threw');
  });

  it('⑩ 未配置任何钩子时派发调用仍发生(由钩子层决定空转),登记面行为与接钩子前一致', () => {
    runHookSpy.mockImplementation(() =>
      Promise.resolve({ allowed: true } as { allowed: true; modified?: undefined }),
    );
    const before = stderrLines.length;
    const id = registerTask(null, 'echo noop');
    expect(getTask(id)?.status).toBe('running');
    expect(stderrLines).toHaveLength(before);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
