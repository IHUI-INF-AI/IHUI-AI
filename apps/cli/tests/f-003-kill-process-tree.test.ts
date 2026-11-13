// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-003 回归:进程树回收口径 + 接线形状。
 *
 * 三道判据:
 *  ① win32:`taskkill /PID <pid> /T /F`(windowsHide),起不来才降级单进程 SIGKILL;
 *  ② POSIX:先 `kill(-pid, SIGKILL)` 打进程组,ESRCH 后降级 `kill(pid, SIGKILL)`,任何情况不抛;
 *  ③ 形状:terminal.ts 三处清理点(降级 kill / 超时清理 / terminal_close)与
 *     background-registry 的 killTask 都走 `killProcessTree`,不再只杀直接子进程。
 *
 * 平台分支靠 `platform` 注入驱动,单测不真杀进程(win32 分支在 POSIX CI 上也能判);
 * 只有 spawn 模块被 mock 成记账替身,不派生真实 taskkill。
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

type SpawnRecord = { command: string; args: string[]; options: Record<string, unknown> };
type ErrorListener = (err: Error) => void;

type FakeTaskkill = { on: (event: string, cb: ErrorListener) => unknown };
type SpawnFn = (
  command: string,
  args?: readonly string[],
  options?: Record<string, unknown>,
) => FakeTaskkill;
type ChildProcessModuleSurface = { spawn: SpawnFn; [key: string]: unknown };

// vi.hoisted:mock 工厂在 import 之前执行,记账状态必须先于模块图存在
const { spawnRecords, errorListeners } = vi.hoisted(() => ({
  spawnRecords: [] as SpawnRecord[],
  errorListeners: [] as ErrorListener[][],
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<ChildProcessModuleSurface>();
  const recordingSpawn: SpawnFn = (command, args, options) => {
    spawnRecords.push({ command, args: args ? Array.from(args) : [], options: { ...options } });
    const listeners: ErrorListener[] = [];
    errorListeners.push(listeners);
    return {
      on: (event: string, cb: ErrorListener) => {
        // 'error' = taskkill 起不来(ENOENT/EPERM)的降级信号;其余事件本用例不关心
        if (event === 'error') listeners.push(cb);
        return undefined;
      },
    };
  };
  return { ...actual, spawn: recordingSpawn };
});

import { killProcessTree } from '../src/util/kill-tree.js';

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

/** 截取一个导出函数/接口之间的正文,避免把文件里别处的调用算进"这个清理点" */
function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end <= start) throw new Error(`切片失败:${startMarker} .. ${endMarker}`);
  return source.slice(start, end);
}

afterEach(() => {
  vi.restoreAllMocks();
  spawnRecords.length = 0;
  errorListeners.length = 0;
});

describe('F-003 killProcessTree — win32 分支', () => {
  it('用 taskkill /PID <pid> /T /F 收整棵树,并且 windowsHide 不弹窗', () => {
    killProcessTree(4242, { platform: 'win32' });

    expect(spawnRecords).toHaveLength(1);
    const record = spawnRecords[0]!;
    expect(record.command).toBe('taskkill');
    expect(record.args).toEqual(['/PID', '4242', '/T', '/F']);
    expect(record.options.windowsHide).toBe(true);
  });

  it('taskkill 起不来(异步 error)时降级单进程 SIGKILL', () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    killProcessTree(4343, { platform: 'win32' });
    errorListeners[0]!.forEach((cb) => cb(new Error('spawn taskkill ENOENT')));

    expect(killSpy).toHaveBeenCalledWith(4343, 'SIGKILL');
  });
});

describe('F-003 killProcessTree — POSIX 分支', () => {
  it('先以 -pid 打进程组;组信号 ESRCH 后降级 pid 单进程', () => {
    const calls: Array<{ pid: number; signal?: string | number }> = [];
    vi.spyOn(process, 'kill').mockImplementation((pid: number, signal?: string | number) => {
      calls.push({ pid, signal });
      if (pid < 0) {
        const err = new Error('kill ESRCH') as NodeJS.ErrnoException;
        err.code = 'ESRCH';
        throw err;
      }
      return true;
    });

    killProcessTree(5151, { platform: 'linux' });

    expect(calls).toEqual([
      { pid: -5151, signal: 'SIGKILL' },
      { pid: 5151, signal: 'SIGKILL' },
    ]);
  });

  it('进程组信号成功时不再补刀单进程', () => {
    const calls: Array<{ pid: number; signal?: string | number }> = [];
    vi.spyOn(process, 'kill').mockImplementation((pid: number, signal?: string | number) => {
      calls.push({ pid, signal });
      return true;
    });

    killProcessTree(5252, { platform: 'darwin' });

    expect(calls).toEqual([{ pid: -5252, signal: 'SIGKILL' }]);
  });

  it('组信号与单进程补刀都失败时也不抛出', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      const err = new Error('kill ESRCH') as NodeJS.ErrnoException;
      err.code = 'ESRCH';
      throw err;
    });

    expect(() => killProcessTree(5353, { platform: 'linux' })).not.toThrow();
  });

  it('pid 缺失/非法时结构性 no-op(不派生 taskkill、不发信号)', () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    killProcessTree(undefined);
    killProcessTree(null);
    killProcessTree(0);
    killProcessTree(Number.NaN);

    expect(killSpy).not.toHaveBeenCalled();
    expect(spawnRecords).toHaveLength(0);
  });
});

describe('F-003 接线形状:清理点都走 killProcessTree', () => {
  it('terminal.ts 三处清理点调 killProcessTree,且不再直接 process.kill', () => {
    const source = readSource('../src/tools/terminal.ts');

    expect(source).toContain("from '../util/kill-tree.js'");
    // 降级会话 kill / 超时会话清理 / terminal_close,共三处
    expect(source.match(/killProcessTree\(/g) ?? []).toHaveLength(3);
    expect(source).not.toMatch(/process\.kill\(/);

    const fallback = sliceBetween(source, 'function spawnFallback', 'function pruneStaleSessions');
    expect(fallback).toContain('killProcessTree(child.pid)');
    // POSIX 派生必须自成进程组,否则 kill(-pid) 打不到任何组;Windows 不 detached
    expect(fallback).toContain('detached: process.platform !== \'win32\'');

    const prune = sliceBetween(source, 'function pruneStaleSessions', '// ==================== 工具实现');
    expect(prune).toContain('killProcessTree(s.proc?.pid)');

    const close = sliceBetween(source, "name: 'terminal_close'", "name: 'terminal_exec_sandboxed'");
    expect(close).toContain('killProcessTree(session.proc?.pid)');
  });

  it('background-registry 的 killTask 走 killProcessTree,不再自拼 taskkill/process.kill', () => {
    const source = readSource('../src/tools/background-registry.ts');
    const killTask = sliceBetween(
      source,
      'export async function killTask',
      'export interface AgentCascadeSettleReport',
    );

    expect(source).toContain("from '../util/kill-tree.js'");
    expect(killTask).toContain('killProcessTree(t.process.pid)');
    // SIGTERM 通道保留(先礼后兵),但不再有"组信号 + 单进程 SIGKILL"的手拼杀树
    expect(killTask).not.toMatch(/process\.kill\(-/);
    expect(killTask).not.toContain("t.process.kill('SIGKILL')");
    expect(killTask).not.toContain('spawnSync');
    expect(source).not.toContain("spawnSync('taskkill'");
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
