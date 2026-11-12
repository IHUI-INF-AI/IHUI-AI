// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌‌​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-019 回归:Windows 沙箱兜底超时不得留下孤儿 cmd 进程树。
 *
 * 病灶:PowerShell 包装器卡死触发 Node 侧 guard 时,旧实现只 `child.kill('SIGKILL')`,
 * PS 脚本里内联的 `taskkill` 永不执行 ⇒ cmd 子树残留;`finally` 还会删掉仍在写的
 * 工作目录。
 *
 * 判据(全部打在**生产入口** runSandboxedWindows 上,只 mock 系统边界):
 *  ① guard 触发后必须派生独立 `taskkill /T /F /PID <child.pid>` 进程(参数逐个比对),
 *     且派生前不得有 taskkill 调用(时机判据);
 *  ② guard 的定时器仍是 timeoutMs + 10s(兜底窗口不变);
 *  ③ 超时分支仍返回 exitCode=124 / timedOut=true 且不抛(老语义保持);
 *  ④ 工作目录清理发生在子进程 exit 之后(顺序判据),不再删"仍在写"的目录。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (...args: unknown[]) => void;

type FakeChild = {
  pid: number;
  on: (event: string, cb: Listener) => FakeChild;
  kill: (signal?: string) => boolean;
  emitExit: (code: number | null) => void;
};

type SpawnRecord = {
  command: string;
  args: string[];
  options: Record<string, unknown>;
  child: FakeChild;
};

const { spawnRecords, events, rmTargets } = vi.hoisted(() => ({
  spawnRecords: [] as SpawnRecord[],
  events: [] as string[],
  rmTargets: [] as string[],
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  let nextPid = 5000;
  const spawn = vi.fn(
    (command: string, args: readonly string[] = [], options: Record<string, unknown> = {}) => {
      const exitListeners: Listener[] = [];
      const errorListeners: Listener[] = [];
      const child: FakeChild = {
        pid: nextPid++,
        on: (event: string, cb: Listener) => {
          if (event === 'exit') exitListeners.push(cb);
          if (event === 'error') errorListeners.push(cb);
          return child;
        },
        kill: () => {
          events.push(`${command}:kill`);
          return true;
        },
        emitExit: (code: number | null) => {
          events.push(`${command}:exit`);
          for (const cb of exitListeners) cb(code);
        },
      };
      spawnRecords.push({ command, args: Array.from(args), options: { ...options }, child });
      return child;
    },
  );
  return { ...actual, spawn };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const actualRm = actual.rm as (...a: unknown[]) => Promise<void>;
  const rm = vi.fn(async (target: string, opts?: unknown) => {
    events.push('rm');
    rmTargets.push(target);
    return actualRm(target, opts);
  });
  return { ...actual, rm };
});

import { runSandboxedWindows } from '../src/tools/sandbox/platform/windows.js';
import type { SandboxPolicy } from '../src/tools/sandbox/policy.js';

const CWD = process.cwd();
const TIMEOUT_MS = 1;

const POLICY: SandboxPolicy = { workspaceRoot: CWD, timeoutMs: TIMEOUT_MS };

/** 等条件成立(真定时器轮询;生产入口内部有真实文件 I/O,不能用假定时器推进)。 */
async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`等待超时:${label}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

/** 捕获 guard 定时器(生产以 timeoutMs + 10_000 注册),其余定时器照常走真定时器。 */
const guardTimers: Array<{ fn: () => void; ms: number }> = [];
let setTimeoutSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  spawnRecords.length = 0;
  events.length = 0;
  rmTargets.length = 0;
  guardTimers.length = 0;
  const realSetTimeout = globalThis.setTimeout;
  setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    fn: (...a: unknown[]) => void,
    ms?: number,
    ...args: unknown[]
  ) => {
    if (typeof ms === 'number' && ms >= 10_000) {
      guardTimers.push({ fn: () => fn(...args), ms });
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }
    return realSetTimeout(fn, ms, ...args);
  }) as unknown as typeof setTimeout) as unknown as ReturnType<typeof vi.spyOn>;
});

afterEach(() => {
  setTimeoutSpy?.mockRestore();
  vi.restoreAllMocks();
});

function psRecord(): SpawnRecord {
  const record = spawnRecords.find((r) => r.command !== 'taskkill');
  if (!record) throw new Error('PowerShell 子进程未派生');
  return record;
}

function taskkillRecords(): SpawnRecord[] {
  return spawnRecords.filter((r) => r.command === 'taskkill');
}

describe('F-019 guard 兜底:Node 侧直接打整棵进程树', () => {
  it('guard 触发后派生 taskkill /T /F /PID <ps pid>,杀树结束才收尾且仍返回 124', async () => {
    const pending = runSandboxedWindows(POLICY, 'echo hi', { cwd: CWD });

    await waitFor(() => spawnRecords.length === 1, 'PowerShell 派生');
    const ps = psRecord();
    // 时机判据:guard 未触发前不得有任何 taskkill(旧实现同样不该有,这是防新增早杀)
    expect(taskkillRecords()).toHaveLength(0);
    // 兜底窗口不变:timeoutMs + 10s
    await waitFor(() => guardTimers.length === 1, 'guard 定时器注册');
    expect(guardTimers[0]!.ms).toBe(TIMEOUT_MS + 10_000);

    guardTimers[0]!.fn();

    // 参数判据:整树终止必须有 /T(树)与 /F(强制),PID 是 PowerShell 的 pid
    const taskkill = taskkillRecords();
    expect(taskkill).toHaveLength(1);
    expect(taskkill[0]!.args).toEqual(['/T', '/F', '/PID', String(ps.child.pid)]);
    // 独立进程、不占管道、不弹窗(异步派生不阻塞本进程)
    expect(taskkill[0]!.options.windowsHide).toBe(true);
    expect(taskkill[0]!.options.stdio).toBe('ignore');

    // 模拟 taskkill 打完整棵树:PowerShell 先退,随后 taskkill 自身退出
    ps.child.emitExit(1);
    taskkill[0]!.child.emitExit(0);

    const result = await pending;
    // 老语义保持:兜底超时仍以 124 收口,timedOut=true,不抛
    expect(result.exitCode).toBe(124);
    expect(result.timedOut).toBe(true);

    // 顺序判据:工作目录删除必须发生在子进程 exit 之后(不再删仍在写的目录)
    expect(rmTargets).toHaveLength(1);
    expect(rmTargets[0]).toContain('ihui-sandbox-');
    const exitIndex = events.indexOf(`${ps.command}:exit`);
    const rmIndex = events.indexOf('rm');
    expect(exitIndex).toBeGreaterThanOrEqual(0);
    expect(rmIndex).toBeGreaterThan(exitIndex);
    // 不得退化成"只杀 PowerShell 本身"
    expect(taskkill[0]!.args).not.toEqual(['/PID', String(ps.child.pid)]);
  });

  it('PS 在 guard 前正常退出:不派生 taskkill,仍按原退出码返回', async () => {
    const pending = runSandboxedWindows(POLICY, 'echo hi', { cwd: CWD });

    await waitFor(() => spawnRecords.length === 1, 'PowerShell 派生');
    const ps = psRecord();
    expect(guardTimers).toHaveLength(1);

    ps.child.emitExit(0);
    const result = await pending;

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(taskkillRecords()).toHaveLength(0);
    // 正常路径清理语义不变:目录照删一次
    expect(rmTargets).toHaveLength(1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌‌​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
