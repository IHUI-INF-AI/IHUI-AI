/**
 * 终端 PTY 工具集 — 长驻终端会话管理(open/send/read/resize/close)。
 *
 * 灵感来源:参考 API 端 terminal-service.ts 的 node-pty 动态加载 + background-registry.ts 的 Map 管理。
 * 简化策略(做减法):
 *   - 动态加载 node-pty,缺失时降级到 child_process.spawn(设置 FORCE_COLOR 模拟 TTY)
 *   - 模块级 Map 管理会话,30 分钟无活动自动清理,最多 10 个并发
 *   - 复用 matchDangerousCommand + isReadonlyCommand + confirmDangerous + runPreToolCall 安全护栏
 *   - 会话输出累积到 outputBuffer,terminal_read 返回自上次读取以来的增量
 */

import { spawn as spawnChild } from 'node:child_process';
import { createRequire } from 'node:module';
import * as crypto from 'node:crypto';
import type { Tool, ToolResult } from './index.js';
import { matchDangerousCommand, isReadonlyCommand } from './command-safety.js';
import { runPreToolCall } from '../hooks/index.js';

// ==================== node-pty 动态加载(参考 API 端 terminal-service.ts)====================

const require = createRequire(import.meta.url);
// 手动定义 node-pty 模块类型(避免 typeof import('node-pty') 在未安装时报 TS2307)
interface NodePtyModule {
  spawn(file: string, args: string[], options: {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
  }): IPty;
}
let ptyMod: NodePtyModule | null = null;
try {
  ptyMod = require('node-pty') as NodePtyModule;
} catch {
  ptyMod = null; // node-pty 未安装,降级到 child_process.spawn
}

// PTY 实例最小接口(与 node-pty 的 IPty 兼容,避免静态 import 失败)
interface IPty {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(cb: (data: string) => void): { dispose(): void };
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): { dispose(): void };
}

// 统一会话进程句柄(node-pty IPty 或 ChildProcess fallback 共用)
interface SessionProc {
  write(data: string): void;
  resize?(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(cb: (data: string) => void): () => void;
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): () => void;
}

// ==================== 会话注册表(参考 background-registry.ts)====================

interface TerminalSession {
  id: string;
  command: string;
  proc: SessionProc | null;
  cols: number;
  rows: number;
  startedAt: number;
  lastActivityAt: number;
  outputBuffer: string; // 累积输出
  lastReadOffset: number; // 上次读取位置
  exited: boolean;
  exitCode?: number;
  mode: 'pty' | 'spawn';
}

const MAX_SESSIONS = 10;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟
const MAX_OUTPUT_BUFFER = 1024 * 1024; // 1MB

const sessions = new Map<string, TerminalSession>();

function genId(): string {
  return `term_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

/** 获取默认 shell(Windows: powershell/cmd,Unix: /bin/bash) */
function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

/** 用 node-pty 创建 PTY 会话句柄,并立即注入要执行的命令 */
function spawnPty(command: string, cwd: string, cols: number, rows: number): SessionProc {
  if (!ptyMod) throw new Error('node-pty 未安装');
  const shell = getDefaultShell();
  const pty = ptyMod.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: process.env as Record<string, string>,
  }) as unknown as IPty;
  pty.write(`${command}\r`); // 立即注入命令
  return {
    write: (data: string) => pty.write(data),
    resize: (c: number, r: number) => pty.resize(c, r),
    kill: (signal?: string) => pty.kill(signal),
    onData: (cb) => {
      const h = pty.onData(cb);
      return () => h.dispose();
    },
    onExit: (cb) => {
      const h = pty.onExit(cb);
      return () => h.dispose();
    },
  };
}

/** 降级:用 child_process.spawn 模拟 TTY(无 PTY,但设置 FORCE_COLOR 启用颜色) */
function spawnFallback(command: string, cwd: string, _cols: number, _rows: number): SessionProc {
  const env = { ...process.env, FORCE_COLOR: '1' } as Record<string, string>;
  const child = spawnChild(command, {
    shell: true,
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    write: (data: string) => { child.stdin?.write(data); },
    kill: (signal?: string) => { try { child.kill(signal as NodeJS.Signals); } catch { /* ignore */ } },
    onData: (cb) => {
      const h1 = (chunk: Buffer) => cb(chunk.toString('utf-8'));
      const h2 = (chunk: Buffer) => cb(chunk.toString('utf-8'));
      child.stdout?.on('data', h1);
      child.stderr?.on('data', h2);
      return () => { child.stdout?.off('data', h1); child.stderr?.off('data', h2); };
    },
    onExit: (cb) => {
      const h = (code: number | null, signal: NodeJS.Signals | null) => {
        cb({ exitCode: code ?? 0, signal: signal ? Number(signal) : undefined });
      };
      child.on('close', h);
      return () => child.off('close', h);
    },
  };
}

/** 清理超时会话(30 分钟无活动)— 每次新建会话前调用 */
function pruneStaleSessions(): void {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TIMEOUT_MS) {
      try { s.proc?.kill('SIGTERM'); } catch { /* ignore */ }
      sessions.delete(id);
    }
  }
}

// ==================== 工具实现 ====================

export const terminal_open: Tool = {
  name: 'terminal_open',
  description: '创建长驻 PTY 终端会话(交互式 shell,如 pnpm dev / python repl)。参数:command(要执行的命令),cwd(可选,工作目录,默认工作区根),cols(可选,列数,默认 80),rows(可选,行数,默认 24)。返回 sessionId。',
  dangerLevel: 'dangerous',
  parameters: {
    command: { type: 'string', description: '要执行的 shell 命令(如 pnpm dev)' },
    cwd: { type: 'string', description: '工作目录(默认工作区根目录)' },
    cols: { type: 'number', description: '终端列数(默认 80)' },
    rows: { type: 'number', description: '终端行数(默认 24)' },
  },
  required: ['command'],
  async execute(args, ctx): Promise<ToolResult> {
    const command = args.command as string;
    if (!command) return { success: false, output: '', error: '缺少 command 参数' };

    // 安全:复用 run_command 模式 — matchDangerousCommand + confirmDangerous + runPreToolCall
    const dangerousMatch = matchDangerousCommand(command);
    if (dangerousMatch && !process.env.IHUI_YOLO) {
      return {
        success: false,
        output: `⚠ 危险命令被拦截:命令匹配危险模式 ${dangerousMatch.source}\n如确需执行,请设置 IHUI_YOLO=1`,
      };
    }
    const readonlyAutoApproved = isReadonlyCommand(command);
    if (!readonlyAutoApproved) {
      if (!ctx.confirmDangerous) {
        return { success: false, output: '', error: `危险操作被拒绝(需用户确认): ${terminal_open.name}` };
      }
      if (!(await ctx.confirmDangerous(terminal_open, args))) {
        return { success: false, output: '', error: `危险操作被拒绝(需用户确认): ${terminal_open.name}` };
      }
    }
    const preResult = runPreToolCall('terminal', { command, cwd: args.cwd ?? ctx.workspacePath });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    // 清理超时会话 + 限额检查
    pruneStaleSessions();
    if (sessions.size >= MAX_SESSIONS) {
      return { success: false, output: '', error: `超过最大并发终端数(${MAX_SESSIONS})` };
    }

    const cwd = (args.cwd as string) || ctx.workspacePath;
    const cols = (args.cols as number) ?? 80;
    const rows = (args.rows as number) ?? 24;
    const id = genId();
    const mode: 'pty' | 'spawn' = ptyMod ? 'pty' : 'spawn';

    let proc: SessionProc;
    try {
      proc = ptyMod ? spawnPty(command, cwd, cols, rows) : spawnFallback(command, cwd, cols, rows);
    } catch (e) {
      return { success: false, output: '', error: `终端创建失败: ${(e as Error).message}` };
    }

    const session: TerminalSession = {
      id, command, proc, cols, rows,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      outputBuffer: '',
      lastReadOffset: 0,
      exited: false,
      mode,
    };

    proc.onData((data: string) => {
      session.lastActivityAt = Date.now();
      if (session.outputBuffer.length < MAX_OUTPUT_BUFFER) {
        session.outputBuffer += data;
        if (session.outputBuffer.length >= MAX_OUTPUT_BUFFER) {
          // 超限时保留最新 1MB,同步修正 lastReadOffset 避免负差
          const overflow = session.outputBuffer.length - MAX_OUTPUT_BUFFER;
          session.outputBuffer = session.outputBuffer.slice(overflow);
          session.lastReadOffset = Math.max(0, session.lastReadOffset - overflow);
        }
      }
    });
    proc.onExit((e) => {
      session.exited = true;
      session.exitCode = e.exitCode;
      session.lastActivityAt = Date.now();
    });

    sessions.set(id, session);
    return {
      success: true,
      output: `终端会话已创建\n  sessionId: ${id}\n  command: ${command}\n  cwd: ${cwd}\n  size: ${cols}x${rows}\n  mode: ${mode}${mode === 'spawn' ? '(node-pty 未安装,降级 child_process)' : ''}\n  用 terminal_send ${id} <input> 发送输入,terminal_read ${id} 读取输出,terminal_close ${id} 关闭`,
    };
  },
};

export const terminal_send: Tool = {
  name: 'terminal_send',
  description: '向 PTY 终端会话发送输入(模拟键盘输入)。参数:sessionId,input(要发送的文本),pressEnter(可选,默认 false,是否在末尾追加 \\r 回车)。',
  dangerLevel: 'write',
  parameters: {
    sessionId: { type: 'string', description: 'terminal_open 返回的 sessionId' },
    input: { type: 'string', description: '要发送的输入文本' },
    pressEnter: { type: 'boolean', description: '是否在输入末尾追加回车(\\r,默认 false)' },
  },
  required: ['sessionId', 'input'],
  async execute(args, _ctx): Promise<ToolResult> {
    const sessionId = args.sessionId as string;
    const input = args.input as string;
    const pressEnter = args.pressEnter === true;
    if (!sessionId) return { success: false, output: '', error: '缺少 sessionId 参数' };
    if (input === undefined || input === null) return { success: false, output: '', error: '缺少 input 参数' };

    const session = sessions.get(sessionId);
    if (!session) return { success: false, output: '', error: `会话 ${sessionId} 不存在` };
    if (session.exited) return { success: false, output: '', error: `会话 ${sessionId} 已退出(exitCode=${session.exitCode ?? '-'})` };
    if (!session.proc) return { success: false, output: '', error: `会话 ${sessionId} 无进程句柄` };

    try {
      session.proc.write(input + (pressEnter ? '\r' : ''));
      session.lastActivityAt = Date.now();
      return {
        success: true,
        output: `已发送 ${input.length + (pressEnter ? 1 : 0)} 字节到会话 ${sessionId}${pressEnter ? '(含回车)' : ''}`,
      };
    } catch (e) {
      return { success: false, output: '', error: `写入失败: ${(e as Error).message}` };
    }
  },
};

export const terminal_read: Tool = {
  name: 'terminal_read',
  description: '读取 PTY 终端会话的累积输出(返回自上次读取以来的新输出)。参数:sessionId,timeout(可选,等待新输出的超时毫秒数,默认 3000)。',
  dangerLevel: 'read',
  parameters: {
    sessionId: { type: 'string', description: 'terminal_open 返回的 sessionId' },
    timeout: { type: 'number', description: '等待新输出的超时毫秒数(默认 3000)' },
  },
  required: ['sessionId'],
  async execute(args, _ctx): Promise<ToolResult> {
    const sessionId = args.sessionId as string;
    const timeout = (args.timeout as number) ?? 3000;
    if (!sessionId) return { success: false, output: '', error: '缺少 sessionId 参数' };

    const session = sessions.get(sessionId);
    if (!session) return { success: false, output: '', error: `会话 ${sessionId} 不存在` };

    // 等待新输出(若已读到末尾,短暂轮询等待新数据到达)
    const start = Date.now();
    while (
      session.outputBuffer.length <= session.lastReadOffset &&
      !session.exited &&
      Date.now() - start < timeout
    ) {
      await new Promise((r) => setTimeout(r, 50));
    }

    const newOutput = session.outputBuffer.slice(session.lastReadOffset);
    session.lastReadOffset = session.outputBuffer.length;

    const parts: string[] = [];
    if (newOutput) parts.push(newOutput);
    if (session.exited) parts.push(`\n[会话已退出 exitCode=${session.exitCode ?? '-'}]`);
    if (!newOutput && !session.exited) parts.push('(暂无新输出)');

    return { success: true, output: parts.join('').trimEnd() || '(无输出)' };
  },
};

export const terminal_resize: Tool = {
  name: 'terminal_resize',
  description: '调整 PTY 终端会话的尺寸(列数 x 行数)。参数:sessionId,cols,rows。',
  dangerLevel: 'read',
  parameters: {
    sessionId: { type: 'string', description: 'terminal_open 返回的 sessionId' },
    cols: { type: 'number', description: '新的列数' },
    rows: { type: 'number', description: '新的行数' },
  },
  required: ['sessionId', 'cols', 'rows'],
  async execute(args, _ctx): Promise<ToolResult> {
    const sessionId = args.sessionId as string;
    const cols = args.cols as number;
    const rows = args.rows as number;
    if (!sessionId) return { success: false, output: '', error: '缺少 sessionId 参数' };
    if (!cols || !rows || cols < 1 || rows < 1) return { success: false, output: '', error: 'cols 和 rows 必须为正整数' };

    const session = sessions.get(sessionId);
    if (!session) return { success: false, output: '', error: `会话 ${sessionId} 不存在` };
    if (session.exited) return { success: false, output: '', error: `会话 ${sessionId} 已退出` };

    if (!session.proc?.resize) {
      // 降级模式(spawn)不支持 PTY resize,仅更新元数据
      session.cols = cols;
      session.rows = rows;
      return { success: true, output: `会话 ${sessionId} 尺寸更新为 ${cols}x${rows}(降级模式无 PTY resize)` };
    }
    try {
      session.proc.resize(cols, rows);
      session.cols = cols;
      session.rows = rows;
      return { success: true, output: `会话 ${sessionId} 尺寸调整为 ${cols}x${rows}` };
    } catch (e) {
      return { success: false, output: '', error: `resize 失败: ${(e as Error).message}` };
    }
  },
};

export const terminal_close: Tool = {
  name: 'terminal_close',
  description: '关闭 PTY 终端会话(终止进程,释放资源)。参数:sessionId。',
  dangerLevel: 'write',
  parameters: {
    sessionId: { type: 'string', description: 'terminal_open 返回的 sessionId' },
  },
  required: ['sessionId'],
  async execute(args, _ctx): Promise<ToolResult> {
    const sessionId = args.sessionId as string;
    if (!sessionId) return { success: false, output: '', error: '缺少 sessionId 参数' };

    const session = sessions.get(sessionId);
    if (!session) return { success: false, output: '', error: `会话 ${sessionId} 不存在` };

    try { session.proc?.kill('SIGTERM'); } catch { /* ignore */ }
    sessions.delete(sessionId);
    return {
      success: true,
      output: `会话 ${sessionId} 已关闭(command: ${session.command}, exitCode: ${session.exitCode ?? '-'})`,
    };
  },
};
