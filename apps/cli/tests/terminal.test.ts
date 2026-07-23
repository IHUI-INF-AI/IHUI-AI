/**
 * 终端 PTY 工具集测试 — open/send/read/resize/close
 *
 * 策略:
 *   - mock node:module 的 createRequire,拦截 terminal.ts 内部 require('node-pty') 返回虚拟 PTY
 *     (terminal.ts 用 createRequire 加载 node-pty,vi.mock('node-pty') 无法拦截 CJS require,
 *      必须从 createRequire 入口拦截)
 *   - 虚拟 PTY 实现 onData/onExit/write/resize/kill + emitData/emitExit 供测试主动触发回调
 *   - mock command-safety(matchDangerousCommand / isReadonlyCommand)和 hooks(runPreToolCall)
 *   - 不依赖真实 PTY 进程,每个测试通过 afterEach terminal_close 清理会话
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'node:os';
import type * as nodeModule from 'node:module';

// ==================== 虚拟 PTY 类型(供测试中访问 mock 状态)====================

interface MockPty {
  written: string[];
  resized: Array<{ cols: number; rows: number }>;
  killed: boolean;
  killedSignal?: string;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(cb: (data: string) => void): { dispose(): void };
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): { dispose(): void };
  emitData(data: string): void;
  emitExit(exitCode: number, signal?: number): void;
}

// ==================== vi.hoisted:共享 mock 状态(工厂函数在 import 前 hoist 执行)====================

const mockState = vi.hoisted(() => {
  // 虚拟 PTY 工厂:记录 write/resize/kill,支持 emitData/emitExit 触发回调
  function createMockPty(): MockPty {
    const dataCallbacks: Array<(data: string) => void> = [];
    const exitCallbacks: Array<(e: { exitCode: number; signal?: number }) => void> = [];
    const pty: MockPty = {
      written: [],
      resized: [],
      killed: false,
      killedSignal: undefined,
      write(data: string) { pty.written.push(data); },
      resize(cols: number, rows: number) { pty.resized.push({ cols, rows }); },
      kill(signal?: string) { pty.killed = true; pty.killedSignal = signal; },
      onData(cb: (data: string) => void) {
        dataCallbacks.push(cb);
        return { dispose: () => { const i = dataCallbacks.indexOf(cb); if (i >= 0) dataCallbacks.splice(i, 1); } };
      },
      onExit(cb: (e: { exitCode: number; signal?: number }) => void) {
        exitCallbacks.push(cb);
        return { dispose: () => { const i = exitCallbacks.indexOf(cb); if (i >= 0) exitCallbacks.splice(i, 1); } };
      },
      emitData(data: string) { for (const cb of dataCallbacks) cb(data); },
      emitExit(exitCode: number, signal?: number) { for (const cb of exitCallbacks) cb({ exitCode, signal }); },
    };
    return pty;
  }

  const ptyInstances: MockPty[] = [];
  const mockPtySpawn = vi.fn((_file: string, _args: string[], _options: unknown): MockPty => {
    const p = createMockPty();
    ptyInstances.push(p);
    return p;
  });
  const mockMatchDangerous = vi.fn((_cmd: string): RegExp | null => null);
  const mockIsReadonly = vi.fn((_cmd: string): boolean => true);
  const mockRunPreToolCall = vi.fn((_tool: string, _input: unknown): { proceed: boolean } => ({ proceed: true }));

  return { ptyInstances, mockPtySpawn, mockMatchDangerous, mockIsReadonly, mockRunPreToolCall };
});

// ==================== Mock 声明(hoisted before imports)====================

// 关键:mock node:module 的 createRequire,让 terminal.ts 内部 require('node-pty') 返回虚拟 PTY
// terminal.ts 用 createRequire(import.meta.url) 创建独立 require,vi.mock('node-pty') 无法拦截 CJS require,
// 必须从 createRequire 入口拦截,否则真实 node-pty 加载后调用 conpty 失败(Windows 环境无 TTY)。
vi.mock('node:module', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof nodeModule;
  return {
    ...actual,
    createRequire: (url: string) => {
      const realRequire = actual.createRequire(url);
      return (id: string) => {
        if (id === 'node-pty') return { spawn: mockState.mockPtySpawn };
        return realRequire(id);
      };
    },
  };
});
vi.mock('../src/tools/command-safety.js', () => ({
  matchDangerousCommand: mockState.mockMatchDangerous,
  isReadonlyCommand: mockState.mockIsReadonly,
}));
vi.mock('../src/hooks/index.js', () => ({
  runPreToolCall: mockState.mockRunPreToolCall,
}));

// ==================== 导入被测模块(在 mock 声明之后)====================

import {
  terminal_open,
  terminal_send,
  terminal_read,
  terminal_resize,
  terminal_close,
} from '../src/tools/terminal.js';

// ==================== 本地 ToolContext 类型(避免 import index.js 触发连带类型检查)====================

interface ToolContext {
  workspacePath: string;
  confirmDangerous?: (tool: unknown, args: Record<string, unknown>) => Promise<boolean>;
}

// ==================== 测试环境 ====================

let ctx: ToolContext;
const createdSessionIds: string[] = [];
let origYolo: string | undefined;

beforeEach(() => {
  // 重置 mock 状态(每个测试拿到干净的 mock 返回值)
  mockState.mockPtySpawn.mockClear();
  mockState.mockMatchDangerous.mockReset();
  mockState.mockMatchDangerous.mockReturnValue(null);
  mockState.mockIsReadonly.mockReset();
  mockState.mockIsReadonly.mockReturnValue(true);
  mockState.mockRunPreToolCall.mockReset();
  mockState.mockRunPreToolCall.mockReturnValue({ proceed: true });
  mockState.ptyInstances.length = 0;

  ctx = { workspacePath: os.tmpdir() };
  createdSessionIds.length = 0;
  origYolo = process.env.IHUI_YOLO;
  delete process.env.IHUI_YOLO;
});

afterEach(async () => {
  vi.useRealTimers();
  // 关闭所有创建的会话(忽略错误 — 可能已被关闭/清理)
  for (const id of createdSessionIds) {
    try {
      await terminal_close.execute({ sessionId: id }, ctx);
    } catch {
      // 忽略
    }
  }
  if (origYolo !== undefined) process.env.IHUI_YOLO = origYolo;
  else delete process.env.IHUI_YOLO;
});

// ==================== 辅助函数 ====================

/** 从 terminal_open 输出中提取 sessionId */
function extractSessionId(output: string): string | null {
  const m = output.match(/sessionId:\s*(\S+)/);
  return m?.[1] ?? null;
}

/** 创建一个会话并追踪 sessionId,返回 { id, pty } */
async function openSession(command = 'echo hello'): Promise<{ id: string; pty: MockPty }> {
  const result = await terminal_open.execute({ command }, ctx);
  expect(result.success).toBe(true);
  const id = extractSessionId(result.output);
  expect(id).not.toBeNull();
  createdSessionIds.push(id!);
  const pty = mockState.ptyInstances[mockState.ptyInstances.length - 1]!;
  return { id: id!, pty };
}

// ==================== terminal_open ====================

describe('terminal_open', () => {
  it('正常创建会话,返回 sessionId 和 success', async () => {
    const result = await terminal_open.execute({ command: 'echo hello' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('sessionId');
    const id = extractSessionId(result.output);
    expect(id).toMatch(/^term_\d+_[a-f0-9]+$/);
    expect(result.output).toContain('echo hello');
    expect(result.output).toContain('mode: pty');
    createdSessionIds.push(id!);
  });

  it('危险命令被拦截(matchDangerousCommand 返回匹配)', async () => {
    mockState.mockMatchDangerous.mockReturnValue(/rm\s+-rf/i);
    const result = await terminal_open.execute({ command: 'rm -rf /' }, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain('危险命令被拦截');
    expect(mockState.mockPtySpawn).not.toHaveBeenCalled();
  });

  it('confirmDangerous 回调返回 false 时拒绝', async () => {
    mockState.mockIsReadonly.mockReturnValue(false);
    ctx.confirmDangerous = async () => false;
    const result = await terminal_open.execute({ command: 'pnpm dev' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('被拒绝');
    expect(mockState.mockPtySpawn).not.toHaveBeenCalled();
  });

  it('超过 10 个并发会话时拒绝', async () => {
    // 创建 10 个会话(达到上限)
    for (let i = 0; i < 10; i++) {
      await openSession(`echo cmd${i}`);
    }
    // 第 11 个应被拒绝
    const result = await terminal_open.execute({ command: 'echo overflow' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('超过最大并发终端数');
    expect(result.error).toContain('10');
  });

  it('过期会话自动清理(pruneStaleSessions)', async () => {
    vi.useFakeTimers();
    // 创建会话 A
    const { id: idA } = await openSession('echo A');
    // 推进时间 31 分钟(超过 30 分钟超时)
    vi.advanceTimersByTime(31 * 60 * 1000);
    // 创建会话 B — 触发 pruneStaleSessions,清理 A
    const { id: idB } = await openSession('echo B');
    // A 应已被清理:send 返回"不存在"
    const sendA = await terminal_send.execute({ sessionId: idA, input: 'test' }, ctx);
    expect(sendA.success).toBe(false);
    expect(sendA.error).toContain('不存在');
    // B 仍可用
    const sendB = await terminal_send.execute({ sessionId: idB, input: 'test' }, ctx);
    expect(sendB.success).toBe(true);
  });
});

// ==================== terminal_send ====================

describe('terminal_send', () => {
  it('向存在会话发送输入,返回 success', async () => {
    const { id, pty } = await openSession();
    const result = await terminal_send.execute({ sessionId: id, input: 'ls -la' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('已发送');
    // 验证 pty.write 收到输入(spawnPty 会先写 command\r,再写 send 的内容)
    expect(pty.written).toContain('ls -la');
  });

  it('向不存在会话发送,返回 error', async () => {
    const result = await terminal_send.execute({ sessionId: 'nonexistent', input: 'test' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('不存在');
  });

  it('pressEnter=true 时追加 \\r', async () => {
    const { id, pty } = await openSession();
    const result = await terminal_send.execute(
      { sessionId: id, input: 'git status', pressEnter: true },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('含回车');
    // 最后一次 write 应为 'git status\r'
    expect(pty.written[pty.written.length - 1]).toBe('git status\r');
  });
});

// ==================== terminal_read ====================

describe('terminal_read', () => {
  it('读取会话输出,返回增量内容', async () => {
    const { id, pty } = await openSession();
    // 模拟 PTY 输出数据(onData 回调已注册,emitData 触发 outputBuffer 累积)
    pty.emitData('hello world\n');
    const result = await terminal_read.execute({ sessionId: id, timeout: 500 }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello world');
  });

  it('不存在会话返回 error', async () => {
    const result = await terminal_read.execute({ sessionId: 'nonexistent' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('不存在');
  });

  it('无新输出时返回空', async () => {
    const { id } = await openSession();
    // 不 emit 任何数据,read 应在 timeout 后返回"暂无新输出"
    const result = await terminal_read.execute({ sessionId: id, timeout: 50 }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('暂无新输出');
  });
});

// ==================== terminal_resize ====================

describe('terminal_resize', () => {
  it('调整会话大小,返回 success', async () => {
    const { id, pty } = await openSession();
    const result = await terminal_resize.execute({ sessionId: id, cols: 120, rows: 40 }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('120x40');
    // 验证 pty.resize 被调用
    expect(pty.resized).toContainEqual({ cols: 120, rows: 40 });
  });

  it('不存在会话返回 error', async () => {
    const result = await terminal_resize.execute(
      { sessionId: 'nonexistent', cols: 80, rows: 24 },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('不存在');
  });
});

// ==================== terminal_close ====================

describe('terminal_close', () => {
  it('关闭会话,返回 success', async () => {
    const { id } = await openSession();
    const result = await terminal_close.execute({ sessionId: id }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('已关闭');
    // 从追踪列表移除(避免 afterEach 重复关闭)
    const idx = createdSessionIds.indexOf(id);
    if (idx >= 0) createdSessionIds.splice(idx, 1);
  });

  it('不存在会话返回 error', async () => {
    const result = await terminal_close.execute({ sessionId: 'nonexistent' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('不存在');
  });

  it('关闭后再次读取返回 error', async () => {
    const { id } = await openSession();
    await terminal_close.execute({ sessionId: id }, ctx);
    // 从追踪列表移除
    const idx = createdSessionIds.indexOf(id);
    if (idx >= 0) createdSessionIds.splice(idx, 1);
    // 再次 read 应返回"不存在"
    const result = await terminal_read.execute({ sessionId: id }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('不存在');
  });
});
