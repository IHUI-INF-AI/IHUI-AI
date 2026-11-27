// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI → desktop tool-host 的最小客户端（Node 侧）。
 *
 * 这是 W4-06 的**消费方**：CLI 不再自己 `spawn` 命令，而是把一次性前台执行交给
 * `ihui-tool-host.exe`，自己只持管道句柄。宿主可独立重启；进程崩溃不带走 CLI。
 *
 * 启用条件（显式，不默认）：Windows + `IHUI_TOOL_HOST_EXE` 指向真实宿主，或宿主
 * 与 CLI 可执行文件同目录（SEA/打包形态）。找不到宿主就返回 unavailable，调用方
 * 继续走原来的 `runSandboxed`，不假装已经切了执行宿主。
 *
 * 边界：这里只做**前台一次性**执行；后台任务需要 ChildProcess 句柄与流式输出，
 * 仍走原路径。宿主内默认 AppContainer 档（低完整性、默认断网）；写工作区的任务
 * 由 `TaskPrepare` 先建可丢弃副本，副本内写、显式发布，不靠放宽宿主机 MIC。
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { connect, type Socket } from 'node:net';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { createInterface, type Interface } from 'node:readline';

import { buildFilteredEnv } from './index.js';
import { DEFAULT_BLOCKED_ENV_VARS } from './index.js';
import { connectToolHostMcp, type ToolHostMcpProcess } from './tool-host-mcp.js';

const PROTOCOL_VERSION = 1;
const CONNECT_TIMEOUT_MS = 5_000;
/** 任务副本建立/发布要跑 Git，不能沿用 5s 连接超时。 */
const TASK_OPERATION_TIMEOUT_MS = 120_000;

export interface ToolHostExecOptions {
  command: string;
  cwd: string;
  timeoutMs: number;
  blockedEnvVars: string[];
  /** 默认 AppContainer（无网络）；显式 `inherit` 仅用于需要写工作区的前台命令。 */
  integrity?: 'inherit' | 'appcontainer';
  /** 幂等双键：同一回合内同一原生 tool_call id 重试必须命中宿主缓存。 */
  turnId?: string;
  toolCallId?: string;
  /** TaskPrepare 的已授权源根；不传则宿主侧空集合，任务副本全部拒绝。 */
  workspaceRoots?: readonly string[];
  /**
   * 当前任务副本 id。存在时复用已持有该任务的宿主连接，不允许因 blockedEnvVars
   * 不同而重建宿主——那会把 TaskPrepare 的 `tasks` map 一起丢掉。
   */
  taskWorkspaceId?: string;
}

export interface ToolHostMcpStartOptions {
  /** 会话稳定 id（同一 MCP server 在一段 CLI 生命周期里复用它，便于宿主回收）。 */
  sessionId: string;
  command: string;
  args?: string[];
  cwd?: string;
  /** 显式过滤后的环境；不传则宿主继承自己的环境（生产调用方应总是传）。 */
  env?: Record<string, string>;
  framing?: 'ndjson' | 'content-length';
  timeoutMs?: number;
}

export interface ToolHostMcpStartResult {
  sessionId: string;
  pid: number;
}

export interface ToolHostMcpRequestResult {
  response: Record<string, unknown>;
  peerAnswered: boolean;
}

export interface ToolHostExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export interface ToolHostMcpOpenOptions {
  sessionId?: string;
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: Record<string, string>;
}

interface RpcResponse {
  v: number;
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
  replayed?: boolean;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

class ToolHostConnection {
  private nextId = 1;
  private readonly pending = new Map<string, Pending>();
  private readonly sessionId = randomUUID();

  private constructor(
    private readonly child: ChildProcess,
    private readonly socket: Socket,
    private readonly lines: Interface,
  ) {
    this.lines.on('line', (line) => this.onLine(line));
    this.socket.on('error', (err) => this.failAll(err));
    this.socket.on('close', () => this.failAll(new Error('tool-host 管道已关闭')));
    this.child.once('exit', (code) =>
      this.failAll(new Error(`tool-host 已退出 code=${code ?? 'unknown'}`)),
    );
  }

  static async connect(exe: string, env: NodeJS.ProcessEnv): Promise<ToolHostConnection> {
    const token = randomBytes(16).toString('hex');
    const pipeName = `ihui-tool-host-${process.pid}-${token.slice(0, 12)}`;
    const child = spawn(exe, ['--pipe', pipeName, '--token', token], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderrTail = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = `${stderrTail}${chunk.toString('utf8')}`.slice(-4_096);
    });

    const path = `\\\\.\\pipe\\${pipeName}`;
    let socket: Socket;
    try {
      socket = await connectRetry(path, child, () => stderrTail);
    } catch (err) {
      child.kill();
      const detail = stderrTail.trim();
      throw new Error(`${err instanceof Error ? err.message : String(err)}${detail ? ` (host stderr: ${detail})` : ''}`);
    }
    const lines = createInterface({ input: socket, crlfDelay: Infinity });
    const conn = new ToolHostConnection(child, socket, lines);
    const hello = await conn.call('service/Hello', '', '', { token }, CONNECT_TIMEOUT_MS);
    if (!isRecord(hello) || hello.ok !== true) {
      conn.dispose();
      throw new Error(`tool-host 握手失败: ${JSON.stringify(hello)}`);
    }
    return conn;
  }

  async execute(opts: ToolHostExecOptions): Promise<ToolHostExecResult> {
    const result = await this.call(
      'service/Execute',
      opts.turnId?.trim() || this.sessionId,
      opts.toolCallId?.trim() || randomUUID(),
      {
        program: 'cmd.exe',
        args: ['/d', '/s', '/c', opts.command],
        cwd: opts.cwd,
        timeoutMs: opts.timeoutMs,
        integrity: opts.integrity ?? 'appcontainer',
      },
      opts.timeoutMs + 5_000,
    );
    if (!isRecord(result)) throw new Error('tool-host 返回了非对象结果');
    const exit = result.exitCode;
    return {
      stdout: typeof result.stdout === 'string' ? result.stdout : '',
      stderr: typeof result.stderr === 'string' ? result.stderr : '',
      exitCode: typeof exit === 'number' ? exit : null,
      timedOut: result.timedOut === true,
      durationMs: typeof result.durationMs === 'number' ? result.durationMs : 0,
    };
  }

  async taskPrepare(source: string, taskId: string): Promise<Record<string, unknown>> {
    const result = await this.call(
      'service/TaskPrepare',
      '',
      '',
      { source, taskId },
      TASK_OPERATION_TIMEOUT_MS,
    );
    if (!isRecord(result) || typeof result.root !== 'string') {
      throw new Error(`tool-host TaskPrepare 返回非法: ${JSON.stringify(result)}`);
    }
    return result;
  }

  async taskDiff(taskId: string): Promise<Record<string, unknown>> {
    const result = await this.call('service/TaskDiff', '', '', { taskId }, 30_000);
    if (!isRecord(result)) throw new Error('tool-host TaskDiff 返回了非对象结果');
    return result;
  }

  async fileWrite(
    taskId: string,
    path: string,
    content: string,
    turnId: string,
    toolCallId: string,
  ): Promise<Record<string, unknown>> {
    const result = await this.call(
      'service/FileWrite',
      turnId,
      toolCallId,
      { taskId, path, content },
      30_000,
    );
    if (!isRecord(result) || typeof result.bytes !== 'number') {
      throw new Error(`tool-host FileWrite 返回非法: ${JSON.stringify(result)}`);
    }
    return result;
  }

  async fileDelete(
    taskId: string,
    path: string,
    turnId: string,
    toolCallId: string,
  ): Promise<Record<string, unknown>> {
    const result = await this.call(
      'service/FileDelete',
      turnId,
      toolCallId,
      { taskId, path },
      30_000,
    );
    if (!isRecord(result) || result.deleted !== true) {
      throw new Error(`tool-host FileDelete 返回非法: ${JSON.stringify(result)}`);
    }
    return result;
  }

  async taskPublish(taskId: string): Promise<Record<string, unknown>> {
    const result = await this.call('service/TaskPublish', '', '', { taskId }, 30_000);
    if (!isRecord(result)) throw new Error('tool-host TaskPublish 返回了非对象结果');
    return result;
  }

  async taskAbandon(taskId: string): Promise<Record<string, unknown>> {
    const result = await this.call('service/TaskAbandon', '', '', { taskId }, TASK_OPERATION_TIMEOUT_MS);
    if (!isRecord(result)) throw new Error('tool-host TaskAbandon 返回了非对象结果');
    return result;
  }

  async startMcp(opts: ToolHostMcpStartOptions): Promise<ToolHostMcpStartResult> {
    const result = await this.call(
      'service/McpStart',
      this.sessionId,
      randomUUID(),
      {
        sessionId: opts.sessionId,
        command: opts.command,
        args: opts.args ?? [],
        cwd: opts.cwd,
        ...(opts.env ? { env: opts.env } : {}),
        framing: opts.framing ?? 'ndjson',
      },
      opts.timeoutMs ?? 10_000,
    );
    if (!isRecord(result) || typeof result.sessionId !== 'string') {
      throw new Error(`tool-host MCP start 返回非法: ${JSON.stringify(result)}`);
    }
    return {
      sessionId: result.sessionId,
      pid: typeof result.pid === 'number' ? result.pid : 0,
    };
  }

  async requestMcp(
    sessionId: string,
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 10_000,
  ): Promise<ToolHostMcpRequestResult> {
    const result = await this.call(
      'service/McpRequest',
      this.sessionId,
      randomUUID(),
      { sessionId, method, params, timeoutMs },
      timeoutMs + 5_000,
    );
    if (!isRecord(result) || !isRecord(result.response)) {
      throw new Error(`tool-host MCP request 返回非法: ${JSON.stringify(result)}`);
    }
    return {
      response: result.response,
      peerAnswered: result.peerAnswered === true,
    };
  }

  async notifyMcp(
    sessionId: string,
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<void> {
    await this.call(
      'service/McpNotify',
      this.sessionId,
      randomUUID(),
      { sessionId, method, params },
      CONNECT_TIMEOUT_MS,
    );
  }

  async closeMcp(sessionId: string): Promise<void> {
    await this.call(
      'service/McpClose',
      this.sessionId,
      randomUUID(),
      { sessionId },
      CONNECT_TIMEOUT_MS,
    );
  }

  dispose(): void {
    this.failAll(new Error('tool-host 连接已释放'));
    this.lines.close();
    this.socket.destroy();
    this.child.kill();
  }

  /** 让宿主拉起并拥有一个 MCP stdio 子进程；返回 raw relay 上的 ChildProcess 形状适配器。 */
  async openMcp(opts: ToolHostMcpOpenOptions): Promise<ToolHostMcpProcess> {
    const sessionId = opts.sessionId ?? `mcp-${randomUUID()}`;
    const result = await this.call(
      'service/McpOpen',
      '',
      '',
      {
        sessionId,
        command: opts.command,
        args: [...(opts.args ?? [])],
        cwd: opts.cwd,
        env: opts.env,
      },
      CONNECT_TIMEOUT_MS,
    );
    if (!isRecord(result)) throw new Error('tool-host MCP 返回了非对象结果');
    const host = typeof result.host === 'string' ? result.host : '';
    const port = typeof result.port === 'number' ? result.port : 0;
    const stderrPort = typeof result.stderrPort === 'number' ? result.stderrPort : undefined;
    const token = typeof result.token === 'string' ? result.token : '';
    const pid = typeof result.pid === 'number' ? result.pid : 0;
    if (!host || !port || !token || !pid) throw new Error('tool-host MCP 返回缺少 host/port/token/pid');
    return connectToolHostMcp({ host, port, ...(stderrPort ? { stderrPort } : {}), token, pid }, {
      close: async () => {
        await this.call('service/McpClose', '', '', { sessionId }, CONNECT_TIMEOUT_MS);
      },
    });
  }

  private async call(
    method: string,
    turnId: string,
    toolCallId: string,
    params: Record<string, unknown>,
    waitMs: number,
  ): Promise<unknown> {
    const id = `req-${this.nextId++}`;
    const line = JSON.stringify({ v: PROTOCOL_VERSION, id, turnId, toolCallId, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`tool-host 调用超时: ${method} (${waitMs}ms)`));
      }, waitMs);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
      this.socket.write(`${line}\n`, (err) => {
        if (!err) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        clearTimeout(pending.timer);
        pending.reject(err);
      });
    });
  }

  private onLine(line: string): void {
    if (line.trim().length === 0) return;
    let msg: RpcResponse;
    try {
      msg = JSON.parse(line) as RpcResponse;
    } catch {
      return;
    }
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.ok) pending.resolve(msg.result ?? null);
    else pending.reject(new Error(msg.error ?? 'tool-host 未给出错误原因'));
  }

  private failAll(err: Error): void {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      clearTimeout(pending.timer);
      pending.reject(err);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function connectRetry(path: string, child: ChildProcess, stderr: () => string): Promise<Socket> {
  const deadline = Date.now() + CONNECT_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const attempt = (): void => {
      if (child.exitCode !== null) {
        reject(new Error(`tool-host 启动即退出 code=${child.exitCode}`));
        return;
      }
      const socket = connect({ path });
      const onError = (err: Error): void => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`连接 ${path} 超时: ${err.message}${stderr() ? ` (${stderr().trim()})` : ''}`));
          return;
        }
        setTimeout(attempt, 50);
      };
      socket.once('error', onError);
      socket.once('connect', () => {
        socket.removeListener('error', onError);
        resolve(socket);
      });
    };
    attempt();
  });
}

/** 宿主可执行文件位置：显式 env 优先；再找 CLI 同目录与桌面 resources 安装位（打包形态）。 */
function resolveHostExe(): string | null {
  if (process.platform !== 'win32') return null;
  const explicit = process.env.IHUI_TOOL_HOST_EXE?.trim();
  if (explicit && existsSync(explicit)) return explicit;
  const dir = dirname(process.execPath);
  const candidates = [
    join(dir, 'ihui-tool-host.exe'),
    join(dir, 'tool-host', 'ihui-tool-host.exe'),
    join(dir, 'resources', 'tool-host', 'ihui-tool-host.exe'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function isToolHostAvailable(): boolean {
  return resolveHostExe() !== null;
}

/** 主动释放宿主；CLI 退出钩子也会调，测试里用来避免子进程拖住事件循环。 */
export function shutdownToolHost(): void {
  connection?.dispose();
  connection = null;
  connectionKey = '';
  mcpConnection?.dispose();
  mcpConnection = null;
}

let connection: ToolHostConnection | null = null;
let connectionKey = '';
let mcpConnection: ToolHostConnection | null = null;
let exitHookInstalled = false;

function installExitHook(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.once('exit', () => {
    connection?.dispose();
    connection = null;
    mcpConnection?.dispose();
    mcpConnection = null;
  });
}

function withWorkspaceRoots(
  env: NodeJS.ProcessEnv,
  roots: readonly string[] | undefined,
): NodeJS.ProcessEnv {
  if (!roots || roots.length === 0) return env;
  return { ...env, IHUI_TOOL_HOST_WORKSPACE_ROOTS: roots.map((root) => resolvePath(root)).join(';') };
}

async function ensureConnection(
  exe: string,
  blockedEnvVars: string[],
  workspaceRoots: readonly string[] | undefined,
): Promise<ToolHostConnection> {
  const key = JSON.stringify({ blockedEnvVars, workspaceRoots: workspaceRoots ?? [] });
  if (connection && connectionKey === key) return connection;
  connection?.dispose();
  connection = null;
  connectionKey = '';
  connection = await ToolHostConnection.connect(
    exe,
    withWorkspaceRoots(buildFilteredEnv(blockedEnvVars), workspaceRoots),
  );
  connectionKey = key;
  installExitHook();
  return connection;
}

/**
 * 在一次前台命令上使用宿主。找不到宿主抛错，由调用方决定是否回退。
 * 同一 CLI 进程复用一条宿主连接；blockedEnvVars / workspaceRoots 变化时重建，
 * 避免把上个会话的凭据环境或工作区授权带给下一条命令。
 */
export async function runOnToolHost(opts: ToolHostExecOptions): Promise<ToolHostExecResult> {
  const exe = resolveHostExe();
  if (!exe) throw new Error('tool-host 不可用：未找到 ihui-tool-host.exe（设 IHUI_TOOL_HOST_EXE）');
  if (opts.taskWorkspaceId) {
    // 任务副本活在某个具体宿主进程的 `tasks` map 里。复用连接，不按 env/roots
    // 重建；重建会让 TaskPrepare 的副本句柄一起消失。
    if (!connection) throw new Error('tool-host 尚未连接；任务命令必须在 TaskPrepare 之后');
    try {
      return await connection.execute(opts);
    } catch (err) {
      connection.dispose();
      connection = null;
      connectionKey = '';
      throw err;
    }
  }
  const conn = await ensureConnection(exe, opts.blockedEnvVars, opts.workspaceRoots);
  try {
    return await conn.execute(opts);
  } catch (err) {
    // 传输出错就把连接丢弃，下一次调用重建；业务非零退出不走这里。
    connection?.dispose();
    connection = null;
    connectionKey = '';
    throw err;
  }
}

/** 在宿主授权根下准备可丢弃任务副本；调用方负责后续 diff / publish / abandon。 */
export async function prepareTaskOnToolHost(
  source: string,
  taskId: string,
  workspaceRoots: readonly string[],
  blockedEnvVars: string[] = DEFAULT_BLOCKED_ENV_VARS,
): Promise<Record<string, unknown>> {
  const exe = resolveHostExe();
  if (!exe) throw new Error('tool-host 不可用：未找到 ihui-tool-host.exe（设 IHUI_TOOL_HOST_EXE）');
  const conn = await ensureConnection(exe, blockedEnvVars, workspaceRoots);
  return conn.taskPrepare(source, taskId);
}

export async function diffTaskOnToolHost(taskId: string): Promise<Record<string, unknown>> {
  const exe = resolveHostExe();
  if (!exe) throw new Error('tool-host 不可用：未找到 ihui-tool-host.exe（设 IHUI_TOOL_HOST_EXE）');
  if (!connection) throw new Error('tool-host 尚未连接');
  return connection.taskDiff(taskId);
}

/** 任务副本的唯一写入口：文件工具不再在 CLI 进程里直接 fs.write。 */
export async function writeFileOnToolHost(
  taskId: string,
  path: string,
  content: string,
  turnId = '',
  toolCallId = '',
): Promise<Record<string, unknown>> {
  const exe = resolveHostExe();
  if (!exe) throw new Error('tool-host 不可用：未找到 ihui-tool-host.exe（设 IHUI_TOOL_HOST_EXE）');
  if (!connection) throw new Error('tool-host 尚未连接；任务副本写文件必须在 TaskPrepare 之后');
  return connection.fileWrite(taskId, path, content, turnId, toolCallId);
}

/** 任务副本删除的唯一入口；与 FileWrite 共用 taskId + 双键。 */
export async function deleteFileOnToolHost(
  taskId: string,
  path: string,
  turnId = '',
  toolCallId = '',
): Promise<Record<string, unknown>> {
  const exe = resolveHostExe();
  if (!exe) throw new Error('tool-host 不可用：未找到 ihui-tool-host.exe（设 IHUI_TOOL_HOST_EXE）');
  if (!connection) throw new Error('tool-host 尚未连接；任务副本删除必须在 TaskPrepare 之后');
  return connection.fileDelete(taskId, path, turnId, toolCallId);
}

export async function publishTaskOnToolHost(taskId: string): Promise<Record<string, unknown>> {
  const exe = resolveHostExe();
  if (!exe) throw new Error('tool-host 不可用：未找到 ihui-tool-host.exe（设 IHUI_TOOL_HOST_EXE）');
  if (!connection) throw new Error('tool-host 尚未连接');
  return connection.taskPublish(taskId);
}

export async function abandonTaskOnToolHost(taskId: string): Promise<Record<string, unknown>> {
  const exe = resolveHostExe();
  if (!exe) throw new Error('tool-host 不可用：未找到 ihui-tool-host.exe（设 IHUI_TOOL_HOST_EXE）');
  if (!connection) throw new Error('tool-host 尚未连接');
  return connection.taskAbandon(taskId);
}

/** MCP 客户端迁移：显式选择宿主，或 Windows 上检测到 sidecar 时自动走宿主。 */
export function shouldUseToolHostForMcp(): boolean {
  if (process.platform !== 'win32') return false;
  const explicit = process.env.IHUI_MCP_TOOL_HOST?.trim();
  if (explicit === '1' || explicit === 'true') return true;
  if (explicit === '0' || explicit === 'false') return false;
  return isToolHostAvailable();
}

/**
 * 让 tool-host 托管一个 MCP stdio server，返回 raw relay 适配器。
 * 连接失败直接抛错，不静默回退到 CLI 自 spawn：宿主存在却启动失败时，
 * 退回未隔离路径会把边界问题藏起来。
 */
export async function openMcpOnToolHost(opts: ToolHostMcpOpenOptions): Promise<ToolHostMcpProcess> {
  const exe = resolveHostExe();
  if (!exe) throw new Error('tool-host 不可用：未找到 ihui-tool-host.exe（设 IHUI_TOOL_HOST_EXE）');
  if (!mcpConnection) {
    mcpConnection = await ToolHostConnection.connect(exe, buildFilteredEnv([]));
    installExitHook();
  }
  try {
    return await mcpConnection.openMcp(opts);
  } catch (err) {
    mcpConnection?.dispose();
    mcpConnection = null;
    throw err;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
