/**
 * DAP(Debug Adapter Protocol)调试器工具 — 对标 OpenCode "开箱即用 DAP" 杀手锏。
 *
 * 策略(Wave 10,2026-07-22):
 *   - 用 child_process.spawn 启动 debug adapter(node:js-debug-adapter / python:debugpy)
 *   - 手写 DAP JSON-RPC over stdio(Content-Length header framing,不引入新依赖)
 *   - 支持多 session 并发(Map<sessionId, DapClient>)
 *   - 10 个工具:launch/attach/set_breakpoints/continue/step/stack_trace/variables/eval/disconnect/list_sessions
 *   - adapter 不可用时优雅降级(errorType='debug-unavailable'),不 throw
 *   - 每请求 10s 超时,session 30 分钟无活动自动清理
 *
 * 协议参考: https://microsoft.github.io/debug-adapter-protocol/
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { registerTools, type Tool, type ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';

const DAP_REQUEST_TIMEOUT_MS = 10_000;
const DAP_INIT_TIMEOUT_MS = 15_000;
const DAP_STOPPED_TIMEOUT_MS = 300_000; // continue/step 等待 stopped 事件
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

// ==================== DAP 协议类型(内部)====================

interface DapResponse {
  seq: number;
  type: 'response';
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: unknown;
}

interface DapEvent {
  seq: number;
  type: 'event';
  event: string;
  body?: unknown;
}

type DapMessage = DapResponse | DapEvent;

interface PendingRequest {
  resolve: (body: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

interface StoppedInfo {
  reason: string;
  threadId?: number;
  text?: string;
  allThreadsStopped?: boolean;
}

// ==================== DapClient — 单 adapter 协议客户端 ====================

type EventHandler = (body: unknown) => void;

/**
 * 单个 debug adapter 子进程的 DAP 客户端。
 *
 * 职责:
 * - 管理 seq 计数器 + pending 请求 Promise 映射
 * - 解析 DAP 消息(Content-Length framing),分发 response/event
 * - 提供 sendRequest / onEvent / waitForStopped 高层 API
 * - 优雅关闭(disconnect + kill)
 */
class DapClient {
  private child: ChildProcess;
  private seq = 0;
  private pending = new Map<number, PendingRequest>();
  private buffer = '';
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private stoppedWaiter: ((info: StoppedInfo) => void) | null = null;
  private terminated = false;
  currentThreadId: number | undefined;
  status: 'initializing' | 'running' | 'stopped' | 'terminated' = 'initializing';
  readonly sessionId: string;
  readonly language: string;
  readonly startedAt: number;
  lastActivity: number;

  constructor(child: ChildProcess, sessionId: string, language: string) {
    this.child = child;
    this.sessionId = sessionId;
    this.language = language;
    this.startedAt = Date.now();
    this.lastActivity = Date.now();

    if (child.stdout) {
      child.stdout.on('data', (chunk: Buffer) => this.handleData(chunk));
    }
    child.on('error', (err) => {
      this.rejectAll(`debug adapter 异常: ${err.message}`);
    });
    child.on('exit', () => {
      this.terminated = true;
      this.status = 'terminated';
      this.rejectAll('debug adapter 已退出');
    });
  }

  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf-8');
    // 循环解析所有完整消息
    while (true) {
      const msg = this.tryParseMessage();
      if (msg === null) break;
      this.handleMessage(msg);
    }
  }

  private tryParseMessage(): DapMessage | null {
    const headerEnd = this.buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return null;
    const header = this.buffer.substring(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match || !match[1]) {
      // 无效 header,跳过
      this.buffer = this.buffer.substring(headerEnd + 4);
      return null;
    }
    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (this.buffer.length - bodyStart < contentLength) return null; // body 不完整
    const body = this.buffer.substring(bodyStart, bodyStart + contentLength);
    this.buffer = this.buffer.substring(bodyStart + contentLength);
    try {
      return JSON.parse(body) as DapMessage;
    } catch {
      return null;
    }
  }

  private handleMessage(msg: DapMessage): void {
    if (msg.type === 'response') {
      const pending = this.pending.get(msg.request_seq);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(msg.request_seq);
        if (msg.success) {
          pending.resolve(msg.body);
        } else {
          pending.reject(new Error(msg.message || `DAP 请求 ${msg.command} 失败`));
        }
      }
    } else if (msg.type === 'event') {
      this.handleEvent(msg.event, msg.body);
    }
  }

  private handleEvent(event: string, body: unknown): void {
    if (event === 'stopped') {
      const info = body as StoppedInfo;
      this.status = 'stopped';
      this.currentThreadId = info?.threadId;
      if (this.stoppedWaiter) {
        this.stoppedWaiter(info);
        this.stoppedWaiter = null;
      }
    } else if (event === 'terminated' || event === 'exited') {
      this.status = 'terminated';
    } else if (event === 'continued') {
      this.status = 'running';
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(body);
        } catch {
          // 忽略 handler 异常
        }
      }
    }
    this.lastActivity = Date.now();
  }

  /** 发送 DAP 请求,返回 response body。超时/失败 reject。 */
  sendRequest(command: string, args?: Record<string, unknown>, timeoutMs: number = DAP_REQUEST_TIMEOUT_MS): Promise<unknown> {
    if (this.terminated) {
      return Promise.reject(new Error('debug adapter 已关闭'));
    }
    this.seq += 1;
    const seq = this.seq;
    const msg: Record<string, unknown> = { seq, type: 'request', command };
    if (args) msg['arguments'] = args;
    const data = this.encodeMessage(msg);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`DAP 请求 ${command} 超时(${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(seq, { resolve, reject, timer });
      try {
        this.child.stdin?.write(data);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(seq);
        reject(new Error(`写入 debug adapter stdin 失败: ${err instanceof Error ? err.message : String(err)}`));
      }
    });
  }

  private encodeMessage(msg: Record<string, unknown>): string {
    const body = JSON.stringify(msg);
    return `Content-Length: ${Buffer.byteLength(body, 'utf-8')}\r\n\r\n${body}`;
  }

  onEvent(event: string, handler: EventHandler): void {
    let set = this.eventHandlers.get(event);
    if (!set) {
      set = new Set();
      this.eventHandlers.set(event, set);
    }
    set.add(handler);
  }

  /** 等待下次 stopped 事件(continue/step 用)。 */
  waitForStopped(timeoutMs: number = DAP_STOPPED_TIMEOUT_MS): Promise<StoppedInfo> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.stoppedWaiter = null;
        if (this.status === 'terminated') {
          resolve({ reason: 'terminated', threadId: this.currentThreadId });
        } else {
          resolve({ reason: 'timeout', threadId: this.currentThreadId });
        }
      }, timeoutMs);
      this.stoppedWaiter = (info) => {
        clearTimeout(timer);
        resolve(info);
      };
    });
  }

  /** DAP initialize 握手。 */
  async initialize(): Promise<void> {
    await this.sendRequest(
      'initialize',
      {
        clientID: 'ihui-cli',
        clientName: 'IHUI CLI',
        adapterID: 'generic',
        locale: 'en-US',
        linesStartAt1: true,
        columnsStartAt1: true,
        pathFormat: 'path',
        supportsVariableType: true,
      },
      DAP_INIT_TIMEOUT_MS,
    );
    this.status = 'running';
  }

  async disconnect(): Promise<void> {
    try {
      await this.sendRequest('disconnect', { terminateDebuggee: true }, 3000);
    } catch {
      // 忽略 disconnect 请求失败
    }
    this.terminated = true;
    this.status = 'terminated';
    this.rejectAll('session 已关闭');
    try {
      this.child.kill();
    } catch {
      // 已退出
    }
  }

  private rejectAll(reason: string): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
  }

  isIdle(): boolean {
    return Date.now() - this.lastActivity > SESSION_IDLE_TIMEOUT_MS;
  }
}

// ==================== Session 管理 ====================

const sessions = new Map<string, DapClient>();

function getAdapterCommand(language: string): { cmd: string; args: string[]; adapterId: string } | null {
  if (language === 'node') {
    return { cmd: 'js-debug-adapter', args: [], adapterId: 'pwa-node' };
  }
  if (language === 'python') {
    return { cmd: 'python', args: ['-m', 'debugpy', '--adapter'], adapterId: 'debugpy' };
  }
  if (language === 'web') {
    return { cmd: 'js-debug-adapter', args: [], adapterId: 'pwa-chrome' };
  }
  return null;
}

async function spawnAdapter(language: string, cwd?: string): Promise<DapClient> {
  const config = getAdapterCommand(language);
  if (!config) {
    throw new Error(`不支持的语言: ${language}(支持: node/python/web)`);
  }
  const sessionId = randomUUID();
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(config.cmd, config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd,
        windowsHide: true,
        shell: true,
      });
    } catch (err) {
      reject(new Error(`debug adapter 启动失败: ${err instanceof Error ? err.message : String(err)}`));
      return;
    }
    // spawn 'error' 事件(binary 不存在时异步触发)
    child.on('error', (err) => {
      reject(new Error(`debug adapter 启动失败(可能未安装 ${config.cmd}): ${err.message}`));
    });
    // 等 stdout 第一条数据确认进程已启动
    const onError = (err: Error): void => reject(err);
    child.once?.('error', onError);
    if (!child.stdout) {
      reject(new Error('无法获取 debug adapter stdout'));
      return;
    }
    child.stdout.once('data', () => {
      child.removeListener?.('error', onError);
      resolve(new DapClient(child, sessionId, language));
    });
    // 5s 内无输出 → 启动失败
    setTimeout(() => {
      reject(new Error(`debug adapter 启动超时(${config.cmd}),可能未安装`));
    }, 5000);
  });
}

function debugUnavailableResult(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    success: false,
    output: '',
    error: `debug adapter 不可用: ${msg}。请确保已安装 js-debug-adapter(npm i -g @vscode/js-debug-adapter)或 debugpy(pip install debugpy)`,
    errorType: 'debug-unavailable',
  };
}

function getSession(sessionId: string): DapClient | null {
  const client = sessions.get(sessionId);
  if (!client) return null;
  if (client.status === 'terminated') {
    sessions.delete(sessionId);
    return null;
  }
  return client;
}

/** 清理超时 session。 */
export function cleanupIdleSessions(): number {
  let cleaned = 0;
  for (const [sid, client] of sessions) {
    if (client.isIdle() || client.status === 'terminated') {
      client.disconnect().catch(() => {});
      sessions.delete(sid);
      cleaned++;
    }
  }
  return cleaned;
}

// ==================== 10 个 DAP 工具 ====================

export const debug_launch: Tool = {
  name: 'debug_launch',
  description:
    '启动 debug adapter 并 launch 程序进行调试(支持 node/js-debug-adapter 和 python/debugpy)。返回 sessionId 供后续 debug 工具使用。adapter 未安装时返回 debug-unavailable 错误。用法:debug_launch({ type: "node"|"python", command: "script.js"|"script.py", args?, cwd?, env?, stopOnEntry? })',
  dangerLevel: 'dangerous',
  parameters: {
    type: { type: 'string', description: '调试语言:node 或 python', enum: ['node', 'python', 'web'] },
    command: { type: 'string', description: '要调试的程序路径(如 script.js / script.py)' },
    args: { type: 'array', description: '程序参数数组(可选)', items: { type: 'string', description: '参数值' } },
    cwd: { type: 'string', description: '工作目录(可选,默认工作区根)' },
    env: { type: 'object', description: '环境变量键值对(可选)' },
    stopOnEntry: { type: 'boolean', description: '是否在入口处停止(可选,默认 false)' },
  },
  required: ['type', 'command'],
  async execute(args, ctx): Promise<ToolResult> {
    const language = args.type as string | undefined;
    const command = args.command as string | undefined;
    if (!language || !command) {
      return { success: false, output: '', error: '参数错误:需要 type(node/python/web)和 command(程序路径)' };
    }
    const preResult = runPreToolCall('debug_launch', { type: language, command });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const progArgs = args.args as string[] | undefined;
    const cwd = (args.cwd as string | undefined) ?? ctx.workspacePath;
    const env = args.env as Record<string, string> | undefined;
    const stopOnEntry = args.stopOnEntry === true;

    let client: DapClient;
    try {
      client = await spawnAdapter(language, cwd);
    } catch (err) {
      return debugUnavailableResult(err);
    }

    try {
      await client.initialize();
    } catch (err) {
      await client.disconnect();
      return debugUnavailableResult(err);
    }

    // 构建 launch 参数
    const launchArgs: Record<string, unknown> = {
      program: command,
      args: progArgs ?? [],
      cwd,
      env: env ?? {},
      stopOnEntry,
    };
    if (language === 'node') {
      launchArgs['type'] = 'pwa-node';
      launchArgs['name'] = 'IHUI Launch';
    } else if (language === 'python') {
      launchArgs['type'] = 'python';
      launchArgs['name'] = 'IHUI Launch';
    } else if (language === 'web') {
      launchArgs['type'] = 'pwa-chrome';
      launchArgs['url'] = command;
      delete launchArgs['program'];
    }

    try {
      await client.sendRequest('launch', launchArgs);
    } catch (err) {
      await client.disconnect();
      return debugUnavailableResult(err);
    }

    sessions.set(client.sessionId, client);
    runPostToolCall('debug_launch', { sessionId: client.sessionId, type: language });
    return {
      success: true,
      output: `调试 session 已启动\nsessionId: ${client.sessionId}\nlanguage: ${language}\ncommand: ${command}\nstopOnEntry: ${stopOnEntry}`,
    };
  },
};

export const debug_attach: Tool = {
  name: 'debug_attach',
  description:
    'attach 到已运行的 debug adapter(远程调试已运行的进程)。返回 sessionId。用法:debug_attach({ type: "node"|"python", port: 9229, host? })',
  dangerLevel: 'dangerous',
  parameters: {
    type: { type: 'string', description: '调试语言:node 或 python', enum: ['node', 'python', 'web'] },
    port: { type: 'number', description: '目标进程的调试端口' },
    host: { type: 'string', description: '目标主机(可选,默认 localhost)' },
  },
  required: ['type', 'port'],
  async execute(args, ctx): Promise<ToolResult> {
    const language = args.type as string | undefined;
    const port = args.port as number | undefined;
    if (!language || typeof port !== 'number') {
      return { success: false, output: '', error: '参数错误:需要 type(node/python/web)和 port(数字)' };
    }
    const preResult = runPreToolCall('debug_attach', { type: language, port });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const host = (args.host as string | undefined) ?? 'localhost';

    let client: DapClient;
    try {
      client = await spawnAdapter(language, ctx.workspacePath);
    } catch (err) {
      return debugUnavailableResult(err);
    }

    try {
      await client.initialize();
    } catch (err) {
      await client.disconnect();
      return debugUnavailableResult(err);
    }

    const attachArgs: Record<string, unknown> = { port, host };
    if (language === 'node') {
      attachArgs['type'] = 'pwa-node';
      attachArgs['name'] = 'IHUI Attach';
    } else if (language === 'python') {
      attachArgs['type'] = 'python';
      attachArgs['name'] = 'IHUI Attach';
    } else if (language === 'web') {
      attachArgs['type'] = 'pwa-chrome';
      attachArgs['url'] = `http://${host}:${port}`;
    }

    try {
      await client.sendRequest('attach', attachArgs);
    } catch (err) {
      await client.disconnect();
      return debugUnavailableResult(err);
    }

    sessions.set(client.sessionId, client);
    runPostToolCall('debug_attach', { sessionId: client.sessionId, type: language, port });
    return {
      success: true,
      output: `已 attach 到调试目标\nsessionId: ${client.sessionId}\nlanguage: ${language}\nhost: ${host}\nport: ${port}`,
    };
  },
};

export const debug_set_breakpoints: Tool = {
  name: 'debug_set_breakpoints',
  description:
    '设置断点(支持条件断点)。返回 DAP 验证后的断点列表(verified/message)。用法:debug_set_breakpoints({ sessionId, file, lines: [{line, condition?}] })',
  dangerLevel: 'write',
  parameters: {
    sessionId: { type: 'string', description: 'debug_launch 或 debug_attach 返回的 sessionId' },
    file: { type: 'string', description: '文件绝对路径或相对路径' },
    lines: { type: 'array', description: '断点行数组', items: { type: 'object', description: '{line, condition?}', properties: { line: { type: 'number', description: '行号(1-based)' }, condition: { type: 'string', description: '条件表达式(可选)' } } } },
  },
  required: ['sessionId', 'file', 'lines'],
  async execute(args): Promise<ToolResult> {
    const sessionId = args.sessionId as string | undefined;
    const file = args.file as string | undefined;
    const lines = args.lines as Array<{ line: number; condition?: string }> | undefined;
    if (!sessionId || !file || !Array.isArray(lines)) {
      return { success: false, output: '', error: '参数错误:需要 sessionId、file、lines(数组)' };
    }
    const preResult = runPreToolCall('debug_set_breakpoints', { sessionId, file, count: lines.length });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const client = getSession(sessionId);
    if (!client) {
      return { success: false, output: '', error: `debug session 不存在或已终止: ${sessionId}`, errorType: 'not_found' };
    }

    const bpArgs = lines.map((l) => {
      const bp: Record<string, unknown> = { line: l.line };
      if (l.condition) bp['condition'] = l.condition;
      return bp;
    });

    try {
      const body = await client.sendRequest('setBreakpoints', {
        source: { path: file },
        breakpoints: bpArgs,
        lines: lines.map((l) => l.line),
        sourceModified: false,
      });
      const breakpoints = (body as { breakpoints?: unknown[] })?.breakpoints ?? [];
      runPostToolCall('debug_set_breakpoints', { sessionId, file, verified: breakpoints.length });
      const formatted = (breakpoints as Array<Record<string, unknown>>)
        .map((bp, i) => `  行 ${lines[i]?.line}: ${bp['verified'] ? '✓ verified' : '✗ ' + (bp['message'] ?? 'unverified')}`)
        .join('\n');
      return {
        success: true,
        output: `已设置 ${breakpoints.length} 个断点(file=${file}):\n${formatted}`,
      };
    } catch (err) {
      return debugUnavailableResult(err);
    }
  },
};

export const debug_continue: Tool = {
  name: 'debug_continue',
  description:
    '继续执行程序,等待下一个 stopped 事件(断点/异常/暂停)。返回停止信息 {reason, threadId}。用法:debug_continue({ sessionId })',
  dangerLevel: 'write',
  parameters: {
    sessionId: { type: 'string', description: 'debug session ID' },
  },
  required: ['sessionId'],
  async execute(args): Promise<ToolResult> {
    const sessionId = args.sessionId as string | undefined;
    if (!sessionId) {
      return { success: false, output: '', error: '参数错误:需要 sessionId' };
    }
    const preResult = runPreToolCall('debug_continue', { sessionId });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const client = getSession(sessionId);
    if (!client) {
      return { success: false, output: '', error: `debug session 不存在或已终止: ${sessionId}`, errorType: 'not_found' };
    }
    if (client.currentThreadId === undefined) {
      return { success: false, output: '', error: '无当前线程(需先 stopped 才能 continue)', errorType: 'debug-unavailable' };
    }

    try {
      await client.sendRequest('continue', { threadId: client.currentThreadId });
      const stopped = await client.waitForStopped();
      runPostToolCall('debug_continue', { sessionId, reason: stopped.reason });
      return {
        success: true,
        output: `程序已暂停\nreason: ${stopped.reason}\nthreadId: ${stopped.threadId ?? 'N/A'}${stopped.text ? '\ntext: ' + stopped.text : ''}`,
      };
    } catch (err) {
      return debugUnavailableResult(err);
    }
  },
};

export const debug_step: Tool = {
  name: 'debug_step',
  description:
    '单步执行(next/stepIn/stepOut)。等待 stopped 事件后返回。用法:debug_step({ sessionId, stepType: "next"|"stepIn"|"stepOut" })',
  dangerLevel: 'write',
  parameters: {
    sessionId: { type: 'string', description: 'debug session ID' },
    stepType: { type: 'string', description: '步进类型', enum: ['next', 'stepIn', 'stepOut'] },
  },
  required: ['sessionId', 'stepType'],
  async execute(args): Promise<ToolResult> {
    const sessionId = args.sessionId as string | undefined;
    const stepType = args.stepType as string | undefined;
    if (!sessionId || !stepType) {
      return { success: false, output: '', error: '参数错误:需要 sessionId 和 stepType(next/stepIn/stepOut)' };
    }
    const valid = ['next', 'stepIn', 'stepOut'];
    if (!valid.includes(stepType)) {
      return { success: false, output: '', error: `无效 stepType: ${stepType},应为 next/stepIn/stepOut` };
    }
    const preResult = runPreToolCall('debug_step', { sessionId, stepType });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const client = getSession(sessionId);
    if (!client) {
      return { success: false, output: '', error: `debug session 不存在或已终止: ${sessionId}`, errorType: 'not_found' };
    }
    if (client.currentThreadId === undefined) {
      return { success: false, output: '', error: '无当前线程(需先 stopped 才能 step)', errorType: 'debug-unavailable' };
    }

    try {
      await client.sendRequest(stepType, { threadId: client.currentThreadId });
      const stopped = await client.waitForStopped(60_000);
      runPostToolCall('debug_step', { sessionId, stepType, reason: stopped.reason });
      return {
        success: true,
        output: `单步执行完成(${stepType})\nreason: ${stopped.reason}\nthreadId: ${stopped.threadId ?? 'N/A'}`,
      };
    } catch (err) {
      return debugUnavailableResult(err);
    }
  },
};

export const debug_get_stack_trace: Tool = {
  name: 'debug_get_stack_trace',
  description:
    '获取当前线程的调用栈(在 stopped 状态下使用)。返回 StackFrame 列表(id/function/file/line/column)。用法:debug_get_stack_trace({ sessionId })',
  dangerLevel: 'read',
  parameters: {
    sessionId: { type: 'string', description: 'debug session ID' },
  },
  required: ['sessionId'],
  async execute(args): Promise<ToolResult> {
    const sessionId = args.sessionId as string | undefined;
    if (!sessionId) {
      return { success: false, output: '', error: '参数错误:需要 sessionId' };
    }
    const preResult = runPreToolCall('debug_get_stack_trace', { sessionId });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const client = getSession(sessionId);
    if (!client) {
      return { success: false, output: '', error: `debug session 不存在或已终止: ${sessionId}`, errorType: 'not_found' };
    }
    if (client.currentThreadId === undefined) {
      return { success: false, output: '', error: '无当前线程(需先 stopped 才能获取 stack trace)', errorType: 'debug-unavailable' };
    }

    try {
      const body = await client.sendRequest('stackTrace', {
        threadId: client.currentThreadId,
        startFrame: 0,
        levels: 20,
      });
      const frames = (body as { stackFrames?: Array<Record<string, unknown>> })?.stackFrames ?? [];
      runPostToolCall('debug_get_stack_trace', { sessionId, frames: frames.length });
      if (frames.length === 0) {
        return { success: true, output: '(无调用栈帧)' };
      }
      const formatted = frames
        .map((f, i) => {
          const source = f['source'] as { path?: string; name?: string } | undefined;
          const file = source?.path ?? source?.name ?? '(unknown)';
          return `  #${i} ${f['name'] ?? '?'} at ${file}:${f['line'] ?? '?'}:${f['column'] ?? '?'}`;
        })
        .join('\n');
      return {
        success: true,
        output: `调用栈(${frames.length} 帧):\n${formatted}`,
      };
    } catch (err) {
      return debugUnavailableResult(err);
    }
  },
};

export const debug_get_variables: Tool = {
  name: 'debug_get_variables',
  description:
    '获取变量列表(需先 get_stack_trace 获取 frameId)。内部调用 scopes + variables。用法:debug_get_variables({ sessionId, frameId, scope?: "local"|"global"|"closure" })',
  dangerLevel: 'read',
  parameters: {
    sessionId: { type: 'string', description: 'debug session ID' },
    frameId: { type: 'number', description: '栈帧 ID(从 debug_get_stack_trace 获取)' },
    scope: { type: 'string', description: '变量作用域过滤(可选,默认 local)', enum: ['local', 'global', 'closure'] },
  },
  required: ['sessionId', 'frameId'],
  async execute(args): Promise<ToolResult> {
    const sessionId = args.sessionId as string | undefined;
    const frameId = args.frameId as number | undefined;
    if (!sessionId || typeof frameId !== 'number') {
      return { success: false, output: '', error: '参数错误:需要 sessionId 和 frameId(数字)' };
    }
    const scope = (args.scope as string | undefined) ?? 'local';
    const preResult = runPreToolCall('debug_get_variables', { sessionId, frameId, scope });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const client = getSession(sessionId);
    if (!client) {
      return { success: false, output: '', error: `debug session 不存在或已终止: ${sessionId}`, errorType: 'not_found' };
    }

    try {
      // 1. 获取 scopes
      const scopesBody = await client.sendRequest('scopes', { frameId });
      const scopes = (scopesBody as { scopes?: Array<Record<string, unknown>> })?.scopes ?? [];
      // 2. 找到匹配的 scope
      const scopeLower = scope.toLowerCase();
      let targetScope: Record<string, unknown> | undefined;
      for (const s of scopes) {
        const name = String(s['name'] ?? '').toLowerCase();
        if (scopeLower.includes(name) || name.includes(scopeLower)) {
          targetScope = s;
          break;
        }
      }
      // 3. 获取变量
      let variables: Array<Record<string, unknown>> = [];
      if (targetScope) {
        const varRef = targetScope['variablesReference'] as number | undefined;
        if (varRef) {
          const varBody = await client.sendRequest('variables', { variablesReference: varRef });
          variables = (varBody as { variables?: Array<Record<string, unknown>> })?.variables ?? [];
        }
      } else {
        // 无匹配 scope,返回所有 scopes 的变量
        for (const s of scopes) {
          const varRef = s['variablesReference'] as number | undefined;
          if (varRef) {
            const varBody = await client.sendRequest('variables', { variablesReference: varRef });
            variables.push(...((varBody as { variables?: Array<Record<string, unknown>> })?.variables ?? []));
          }
        }
      }
      runPostToolCall('debug_get_variables', { sessionId, frameId, scope, count: variables.length });
      if (variables.length === 0) {
        return { success: true, output: `(scope=${scope} 无变量)` };
      }
      const formatted = variables
        .map((v) => `  ${v['name'] ?? '?'} = ${v['value'] ?? '?'} (${v['type'] ?? '?'})`)
        .join('\n');
      return {
        success: true,
        output: `变量列表(scope=${scope}, ${variables.length} 个):\n${formatted}`,
      };
    } catch (err) {
      return debugUnavailableResult(err);
    }
  },
};

export const debug_eval: Tool = {
  name: 'debug_eval',
  description:
    '在调试上下文中求值表达式(repl 上下文)。返回 {result, type}。用法:debug_eval({ sessionId, expression, frameId? })',
  dangerLevel: 'read',
  parameters: {
    sessionId: { type: 'string', description: 'debug session ID' },
    expression: { type: 'string', description: '要求值的表达式' },
    frameId: { type: 'number', description: '栈帧 ID(可选,在指定帧上下文求值)' },
  },
  required: ['sessionId', 'expression'],
  async execute(args): Promise<ToolResult> {
    const sessionId = args.sessionId as string | undefined;
    const expression = args.expression as string | undefined;
    if (!sessionId || !expression) {
      return { success: false, output: '', error: '参数错误:需要 sessionId 和 expression' };
    }
    const frameId = args.frameId as number | undefined;
    const preResult = runPreToolCall('debug_eval', { sessionId, expression });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const client = getSession(sessionId);
    if (!client) {
      return { success: false, output: '', error: `debug session 不存在或已终止: ${sessionId}`, errorType: 'not_found' };
    }

    try {
      const evalArgs: Record<string, unknown> = { expression, context: 'repl' };
      if (frameId !== undefined) evalArgs['frameId'] = frameId;
      const result = await client.sendRequest('evaluate', evalArgs);
      const r = result as { result?: string; type?: string } | null;
      runPostToolCall('debug_eval', { sessionId, expression });
      return {
        success: true,
        output: `求值结果:\n  expression: ${expression}\n  result: ${r?.result ?? '(无结果)'}\n  type: ${r?.type ?? '?'}`,
      };
    } catch (err) {
      return debugUnavailableResult(err);
    }
  },
};

export const debug_disconnect: Tool = {
  name: 'debug_disconnect',
  description:
    '断开 debug session(发送 disconnect 请求 + 终止 adapter 子进程)。用法:debug_disconnect({ sessionId })',
  dangerLevel: 'write',
  parameters: {
    sessionId: { type: 'string', description: '要关闭的 debug session ID' },
  },
  required: ['sessionId'],
  async execute(args): Promise<ToolResult> {
    const sessionId = args.sessionId as string | undefined;
    if (!sessionId) {
      return { success: false, output: '', error: '参数错误:需要 sessionId' };
    }
    const preResult = runPreToolCall('debug_disconnect', { sessionId });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const client = sessions.get(sessionId);
    if (!client) {
      return { success: false, output: '', error: `debug session 不存在: ${sessionId}`, errorType: 'not_found' };
    }

    await client.disconnect();
    sessions.delete(sessionId);
    runPostToolCall('debug_disconnect', { sessionId });
    return {
      success: true,
      output: `debug session 已断开: ${sessionId}`,
    };
  },
};

export const debug_list_sessions: Tool = {
  name: 'debug_list_sessions',
  description:
    '列出所有活跃的 debug session。返回 [{sessionId, language, status, startedAt, lastActivityAt}]。用法:debug_list_sessions()',
  dangerLevel: 'read',
  parameters: {},
  required: [],
  async execute(): Promise<ToolResult> {
    runPreToolCall('debug_list_sessions', {});
    // 清理已终止的 session
    for (const [sid, client] of sessions) {
      if (client.status === 'terminated') {
        sessions.delete(sid);
      }
    }
    if (sessions.size === 0) {
      return { success: true, output: '(无活跃 debug session)' };
    }
    const lines: string[] = [];
    for (const client of sessions.values()) {
      const elapsed = Math.round((Date.now() - client.startedAt) / 1000);
      lines.push(`  ${client.sessionId} | ${client.language} | ${client.status} | ${elapsed}s ago`);
    }
    runPostToolCall('debug_list_sessions', { count: sessions.size });
    return {
      success: true,
      output: `活跃 debug session(${sessions.size} 个):\n${lines.join('\n')}`,
    };
  },
};

// ==================== 注册 ====================

export const DEBUG_TOOLS: Tool[] = [
  debug_launch,
  debug_attach,
  debug_set_breakpoints,
  debug_continue,
  debug_step,
  debug_get_stack_trace,
  debug_get_variables,
  debug_eval,
  debug_disconnect,
  debug_list_sessions,
];

export function registerDebugTools(): void {
  registerTools(DEBUG_TOOLS);
}
