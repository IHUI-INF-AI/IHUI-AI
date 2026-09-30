// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP Runtime — MCP 服务器连接与工具调用运行时。
 *
 * 灵感来源:参考行业 Agent 框架的 MCP crate 设计,实现完整的 MCP server 连接和工具调用。
 * 简化策略(做减法):
 *   - stdio transport:spawn 子进程,通过 stdin/stdout 通信(JSON-RPC 2.0 over stdio)
 *   - http transport:用 fetch POST 发送 JSON-RPC,响应即 POST 响应
 *   - sse transport:GET 建立 SSE 长连接,后续 POST 到 endpoint,响应通过 SSE 流推送
 *   - 工具枚举:调用 tools/list,将 MCP 工具转为 Tool 接口
 *   - 工具调用转发:Agent 调用时,转发到 MCP server 的 tools/call
 *   - resources:调用 resources/list / resources/read(预加载可选,不支持时静默)
 *   - prompts:调用 prompts/list / prompts/get(预加载可选,不支持时静默)
 *
 * JSON-RPC 2.0 消息格式:
 *   请求:{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
 *   响应:{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
 *
 * MCP over SSE 协议:
 *   1. GET <url> 拿 SSE 流(header Accept: text/event-stream)
 *   2. 服务器推送 endpoint 事件,告知后续 POST 的目标 URL
 *   3. RPC 请求 POST 到 endpoint,body 是 JSON-RPC 2.0
 *   4. 响应以 message 事件形式通过 SSE 流推送回来
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { buildFilteredEnv, DEFAULT_BLOCKED_ENV_VARS } from '../sandbox/index.js';
import * as fs from 'node:fs';
// MCP 协议版本单一真源(packages/shared 镜像 ai-service tunables.py;
// GAP-PLAN P0-1 收敛:此前此处二次写死旧版 '2024-11-05' 造成跨端漂移)
import { DEFAULT_PROTOCOL_VERSION } from '@ihui/shared';
// G-689:子进程 stderr 尾要进错误消息 ⇒ 必须过共享层**唯一**脱敏出口。
// 端内不得再抄一份 secret 正则(两处实现必漂移是本仓最高频失效型)。
import { sanitizeEvidenceText } from '@ihui/shared/utils/redact';
import { assertSafeFetchUrl, formatSsrfRejection, type SelfHostedTrust } from '@ihui/shared/utils/ssrf-guard';
import { killProcessTree } from '../util/spawn-isolated.js';
import { getMcpConfigPath, type McpServer } from '../commands/mcp-config.js';
import type { Tool, ToolResult, ToolContext, ToolParameter } from './index.js';
import { getCredential, isExpired, setCredential } from './mcp-credentials.js';
import { startOAuthFlow, refreshAccessToken, type OAuthConfig } from './mcp-oauth.js';

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
  /**
   * MCP 标准工具注解(tools/list 原样带回),本仓只取**免批两轴**用得上的两项:
   * `readOnlyHint`(轴 A:只读)与 `openWorldHint`(轴 B:是否触达外部世界)。
   * 这里只是把服务端**自报的事实**抄下来,不做任何批准判定 —— 判定唯一实现在
   * `tools/index.ts` 的 `requiresUserConfirmation()`。
   */
  annotations?: {
    readOnlyHint?: boolean;
    openWorldHint?: boolean;
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface McpPromptMessage {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
}

export interface McpPromptResult {
  description?: string;
  messages: McpPromptMessage[];
}

export interface McpConnection {
  server: McpServer;
  tools: McpToolDef[];
  process?: ChildProcess;
  connected: boolean;
  transport: 'stdio' | 'http' | 'sse';
  /** 认证 headers(含 Authorization),http/sse 路径复用 */
  headers?: Record<string, string>;
  /** sse 专用:长连接 abort 控制器 */
  sseAbortController?: AbortController;
  /** sse 专用:POST 目标 URL(endpoint 事件推送) */
  sseEndpoint?: string;
  /** sse 专用:等待响应的 pending Map,id → resolver */
  ssePending: Map<string | number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  /** sse 专用:下一个 JSON-RPC id */
  sseNextId: number;
  /** resources/list 预加载结果(不支持 resources 的 server 为空数组) */
  resources?: McpResource[];
  /** prompts/list 预加载结果(不支持 prompts 的 server 为空数组) */
  prompts?: McpPrompt[];
}

let _nextId = 1;

function nextId(): number {
  return _nextId++;
}

// ==================== G-689 / G-694:stdio 子进程观察点(有界 stderr 尾 + error/exit 监听 + 单点分派) ====================

/** stdio RPC 默认超时(旧代码在 3 个调用点各写一遍 `10_000` 字面量,此处收成单点)。 */
const STDIO_RPC_DEFAULT_TIMEOUT_MS = 10_000;
/**
 * G-689:stderr 尾缓冲上限(**单点定义**,注释与代码同值只此一源)。
 * 有界是硬要求:第三方 MCP server 可以把 stderr 写成无限流,不设上限等于给 CLI 加一个内存泄漏。
 */
const MCP_STDERR_TAIL_MAX_BYTES = 8 * 1024;
/** 附进错误消息的尾部行数(再长也会把 message 撑成日志文件,诊断价值反而下降) */
const MCP_STDERR_TAIL_MAX_LINES = 8;
/** 附进错误消息的字符上限(在行数之外再兜一道,防单行超长日志) */
const MCP_STDERR_TAIL_MAX_CHARS = 600;
/** stdout 未收到换行的累积缓冲上限(病态 server 只写不换行时的护栏) */
const MCP_STDIO_LINE_BUFFER_MAX_CHARS = 256 * 1024;
/** stderr 单块追加上限(超过就直接截尾,不进缓冲) */
const MCP_STDERR_APPEND_MAX_BYTES = 64 * 1024;

/**
 * G-691 — 错误对象上的"对端是否已应答"标记。
 * 按**属性读数**(不靠 instanceof / 文案匹配),与 `readMcpRefreshKind` 同一条口径:
 * 模块 mock / 错误被包一层之后 instanceof 会失真,而属性不会说谎。
 */
type McpPeerAnsweredError = Error & { peerAnswered?: boolean };

function mcpError(message: string, peerAnswered: boolean): McpPeerAnsweredError {
  const err = new Error(message) as McpPeerAnsweredError;
  err.peerAnswered = peerAnswered;
  return err;
}

/** 读到 true = 对端确实回了话(业务失败);false = 传输级失败;undefined = 本层之外产生的错误。 */
function readMcpPeerAnswered(err: unknown): boolean | undefined {
  if (err === null || typeof err !== 'object') return undefined;
  const raw = (err as { peerAnswered?: unknown }).peerAnswered;
  return typeof raw === 'boolean' ? raw : undefined;
}

/** stdout 上收到的 JSON-RPC 响应形态(只声明本层用到的字段) */
interface StdioRpcMessage {
  id?: number | string;
  error?: { code?: number; message?: string };
  result?: unknown;
}

interface StdioPending {
  readonly method: string;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly resolve: (v: unknown) => void;
  readonly reject: (e: Error) => void;
}

/**
 * stdio 子进程的**唯一**观察点。
 *
 * 修的形状(G-689 立项实测):旧代码 `proc.stderr?.on('data', () => {/* 忽略 stderr *\/})`
 * 且零事件监听器 ⇒ `command` 不存在时 ENOENT 走**异步** `error` 事件而无人接,
 * 调用方只由 10s 计时器兜成"MCP 请求超时: initialize" —— spawn 失败 / 退出码 / 对端写在
 * stderr 里的真实报错整块丢失。
 *
 * 修的形状(G-694 立项实测):旧 `sendStdioRpc` 的 `stdout.off('data', onData)` **只在收到
 * 匹配 id 时执行**,超时分支只 reject ⇒ 每超时一次永久留一个监听器。本类的结构让这一型
 * 不可能出现:每个子进程只有**一个** stdout 'data' 监听器(分派器),每次请求登记的是
 * pending 表里的一项,超时/错误/成功三条路都经 `settle()` 这一个出口摘表项。
 *
 * 两条不可漂的写法:
 *  ① 尾缓冲有界(上限常量单点定义);
 *  ② 任何离开本类的文本必须先过共享层唯一脱敏出口 `sanitizeEvidenceText` ——
 *     stderr 由**第三方进程**书写,里面完全可能出现它自己的 token。
 */
class McpStdioChild {
  private readonly pending = new Map<number, StdioPending>();
  private readonly stderrChunks: Buffer[] = [];
  private stderrBytes = 0;
  private lineBuf = '';
  private droppedLineBytes = 0;
  /** undefined = 尚未报告(与 null = "被信号终止、无码"是两件事,不得并桶) */
  private exitCode: number | null | undefined;
  private exitSignal: NodeJS.Signals | null | undefined;
  private spawnError: Error | null = null;
  private terminated = false;
  private disposed = false;

  constructor(private readonly proc: ChildProcess) {
    proc.stderr?.on('data', this.onStderrData);
    proc.stdout?.on('data', this.onStdoutData);
    // stdin 的 EPIPE 在无监听器时会升级成 uncaughtException;这里只记账,不改判据
    proc.stdin?.on('error', this.onStdinError);
    proc.once('error', this.onProcError);
    proc.once('exit', this.onProcExit);
    proc.once('close', this.onProcClose);
  }

  /** 该子进程是否已经不可用(启动失败 / 已终止 / 观察点已摘线)。 */
  private get unavailable(): boolean {
    return this.disposed || this.terminated || this.spawnError !== null;
  }

  /**
   * 发送一次 JSON-RPC 请求并等待匹配 id 的响应。
   * 返回的 Promise 无论走哪条路(响应 / JSON-RPC error / 超时 / 子进程终止)都**不会**留下表项。
   */
  request(method: string, params: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      if (this.unavailable || !this.proc.stdin || !this.proc.stdout) {
        reject(mcpError(`MCP 子进程不可用(${method}): ${this.diagnosticContext()}`, false));
        return;
      }
      const id = nextId();
      const timer = setTimeout(() => {
        // G-694:超时与成功路径同形 —— 经同一个 settle() 出口摘掉 pending(旧写法只 reject 不摘,
        // 而监听器是逐请求挂的,于是每超时一次就永久多留一个 'data' 监听器)
        this.settle(
          id,
          undefined,
          mcpError(`MCP 请求超时: ${method} (${timeoutMs}ms): ${this.diagnosticContext()}`, false),
        );
      }, timeoutMs);
      this.pending.set(id, {
        method,
        timer,
        resolve,
        reject,
      });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      try {
        this.proc.stdin.write(msg);
      } catch (err) {
        this.settle(
          id,
          undefined,
          mcpError(
            `MCP 写入 stdin 失败: ${method}: ${sanitizeEvidenceText(err instanceof Error ? err.message : String(err))}`,
            false,
          ),
        );
      }
    });
  }

  /** 摘掉本类挂在该子进程上的全部监听器(断连/退出后调用;重复调用无副作用)。 */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.proc.stderr?.off('data', this.onStderrData);
    this.proc.stdout?.off('data', this.onStdoutData);
    this.proc.stdin?.off('error', this.onStdinError);
    this.proc.off('error', this.onProcError);
    this.proc.off('exit', this.onProcExit);
    this.proc.off('close', this.onProcClose);
    this.failAllPending('观察点已摘线');
  }

  /** 诊断上下文(全部经脱敏):spawn 错误 / 退出码 / 信号 / 有界 stderr 尾。 */
  diagnosticContext(): string {
    const parts: string[] = [];
    if (this.spawnError) {
      const code = (this.spawnError as NodeJS.ErrnoException).code ?? '未知';
      parts.push(`spawn错误=${sanitizeEvidenceText(`${code}: ${this.spawnError.message}`)}`);
    }
    if (this.exitCode !== undefined || this.exitSignal !== undefined) {
      parts.push(`退出码=${this.exitCode === undefined ? '未报' : String(this.exitCode)}`);
      parts.push(`信号=${this.exitSignal === undefined ? '未报' : String(this.exitSignal)}`);
    }
    if (this.droppedLineBytes > 0) parts.push(`stdout 溢出丢弃=${this.droppedLineBytes}B`);
    parts.push(`stderr 尾=${this.stderrTailText() || '(空)'}`);
    return parts.join('; ');
  }

  /** 有界 stderr 尾 → 末 N 行 → 截字符 → **脱敏**(唯一出口,不得在此另写正则)。 */
  private stderrTailText(): string {
    if (this.stderrBytes === 0) return '';
    const raw = Buffer.concat(this.stderrChunks, this.stderrBytes).toString('utf-8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '');
    const tail = lines.slice(-MCP_STDERR_TAIL_MAX_LINES).join('\n');
    const clipped = tail.length > MCP_STDERR_TAIL_MAX_CHARS ? tail.slice(-MCP_STDERR_TAIL_MAX_CHARS) : tail;
    return sanitizeEvidenceText(clipped).replace(/\s+/g, ' ').trim();
  }

  private appendStderr(chunk: Buffer): void {
    let data = chunk;
    if (data.length > MCP_STDERR_APPEND_MAX_BYTES) {
      data = data.subarray(data.length - MCP_STDERR_APPEND_MAX_BYTES);
    }
    this.stderrChunks.push(data);
    this.stderrBytes += data.length;
    // 只保留末尾 MCP_STDERR_TAIL_MAX_BYTES:从头逐段丢弃(O(段数),不是每块重拼整段)
    while (this.stderrBytes > MCP_STDERR_TAIL_MAX_BYTES) {
      const first = this.stderrChunks[0];
      if (!first) break;
      const excess = this.stderrBytes - MCP_STDERR_TAIL_MAX_BYTES;
      if (first.length <= excess) {
        this.stderrBytes -= first.length;
        this.stderrChunks.shift();
      } else {
        this.stderrChunks[0] = first.subarray(excess);
        this.stderrBytes -= excess;
      }
    }
  }

  /** 摘表 + 清计时 + 结算,三条路(成功 / 错误 / 超时)共用这一个出口。 */
  private settle(id: number, value: unknown, error?: Error): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    clearTimeout(entry.timer);
    if (error) entry.reject(error);
    else entry.resolve(value);
  }

  private failAllPending(why: string): void {
    const entries = Array.from(this.pending.values());
    this.pending.clear();
    for (const entry of entries) {
      clearTimeout(entry.timer);
      entry.reject(
        mcpError(`MCP 子进程已终止(${entry.method}): ${why};${this.diagnosticContext()}`, false),
      );
    }
  }

  private readonly onStderrData = (data: Buffer): void => {
    this.appendStderr(Buffer.isBuffer(data) ? data : Buffer.from(String(data)));
  };

  private readonly onStdinError = (err: Error): void => {
    // 只记录不抛出:stdin 断通常意味着对端已退,真凶由 exit/close 那一路报出
    if (!this.spawnError) this.spawnError = err;
  };

  private readonly onStdoutData = (data: Buffer): void => {
    this.lineBuf += (Buffer.isBuffer(data) ? data : Buffer.from(String(data))).toString('utf-8');
    if (this.lineBuf.length > MCP_STDIO_LINE_BUFFER_MAX_CHARS) {
      this.droppedLineBytes += this.lineBuf.length - MCP_STDIO_LINE_BUFFER_MAX_CHARS;
      this.lineBuf = this.lineBuf.slice(-MCP_STDIO_LINE_BUFFER_MAX_CHARS);
    }
    for (let nl = this.lineBuf.indexOf('\n'); nl >= 0; nl = this.lineBuf.indexOf('\n')) {
      const line = this.lineBuf.slice(0, nl);
      this.lineBuf = this.lineBuf.slice(nl + 1);
      this.dispatchLine(line);
    }
  };

  private dispatchLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: StdioRpcMessage;
    try {
      parsed = JSON.parse(trimmed) as StdioRpcMessage;
    } catch {
      return; // 非 JSON 行(与旧版一致:忽略,不当错误)
    }
    if (typeof parsed.id !== 'number') return; // 通知 / 服务端发起的请求:本层不处理
    if (!this.pending.has(parsed.id)) return; // 不是我们的请求(同旧版:静默)
    if (parsed.error) {
      // G-691:JSON-RPC 错误是**对端已应答**的失败(method-not-found、参数校验等),
      // 属业务级 —— 不是"连接死了"。旧写法对任何 throw 都累计 markDead,于是每次业务失败
      // 都重启子进程并丢光其进程内状态。标 peerAnswered=true,由调用侧分档处置。
      const code = typeof parsed.error.code === 'number' ? ` (code=${parsed.error.code})` : '';
      this.settle(parsed.id, undefined, mcpError(`${parsed.error.message || 'MCP 错误'}${code}`, true));
      return;
    }
    this.settle(parsed.id, parsed.result);
  }

  private readonly onProcError = (err: Error): void => {
    this.spawnError = err;
    // 只有"从未起起来"(pid 缺失,典型 ENOENT)才立刻判死;运行期 error 交给 exit/close,
    // 免得把还活着的子进程的在途请求误杀。
    if (!this.proc.pid) {
      this.terminated = true;
      this.failAllPending(this.diagnosticContext());
    }
  };

  private readonly onProcExit = (code: number | null, signal: NodeJS.Signals | null): void => {
    this.exitCode = code;
    this.exitSignal = signal;
  };

  private readonly onProcClose = (code: number | null, signal: NodeJS.Signals | null): void => {
    if (this.exitCode === undefined && this.exitSignal === undefined) {
      // Windows 上 spawn 失败只发 close 不发 exit(code 是 libuv 错误码而非退出码)
      this.exitCode = code;
      this.exitSignal = signal;
    }
    this.terminated = true;
    this.failAllPending(this.diagnosticContext());
    // 进程已终结 ⇒ 不会再有输出,监听器就地摘掉(G-694 的"成对清理"也覆盖异常终止路径)
    this.dispose();
  };
}

/** 观察点按**子进程对象**索引 —— 同一 proc 只会挂一份监听器(G-694 的结构前提)。 */
const mcpStdioChildren = new WeakMap<ChildProcess, McpStdioChild>();

/** 取/建某 stdio 子进程的观察点(spawn 之后立刻调用一次,好把 error/exit/close 记全)。 */
function attachMcpStdioChild(proc: ChildProcess): McpStdioChild {
  const existing = mcpStdioChildren.get(proc);
  if (existing) return existing;
  const created = new McpStdioChild(proc);
  mcpStdioChildren.set(proc, created);
  return created;
}

/** 断连时摘观察点(监听器与 pending 一起释放;没有观察点则空操作)。 */
function releaseMcpStdioChild(proc: ChildProcess | undefined): void {
  if (!proc) return;
  const watch = mcpStdioChildren.get(proc);
  if (!watch) return;
  mcpStdioChildren.delete(proc);
  watch.dispose();
}

/**
 * stdio JSON-RPC 一次往返。
 *
 * `export` 只为让单测能把**超时**这一档调到亚秒级并复量监听器数(G-694 的验收是
 * "连续 5 次超时后 `proc.stdout.listenerCount('data') === 1" —— 生产默认 10s 超时
 * 让这条用例要跑 50 秒)。判据本身不在测试里重写。
 */
export async function sendStdioRpc(
  proc: ChildProcess,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = STDIO_RPC_DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  return attachMcpStdioChild(proc).request(method, params, timeoutMs);
}

/** 发送 JSON-RPC notification(无 id,无需响应),不分配 id 也不等待。 */
function sendStdioNotification(
  proc: ChildProcess,
  method: string,
  params: Record<string, unknown> = {},
): void {
  if (!proc.stdin) {
    throw new Error('子进程 stdin 不可用');
  }
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
  proc.stdin.write(msg);
}

/**
 * D-1 信任声明:只把**用户自己写在 mcpServers 配置里的 server.url** 当基准。
 *
 * 反面的一半(为什么 SSE 推来的 endpoint 绝不能复用这份声明):那条 URL 是
 * **远端服务器**在 SSE `endpoint` 事件里给我们的(`:465` 附近),不是用户配置的。
 * 一台被攻陷/恶意的 MCP server 只要推一条 `endpoint: http://169.254.169.254/`
 * 或 `http://127.0.0.1:8803/admin`,就会带着我们的 `Authorization` 头打过去。
 *
 * 未闭环登记(D-2,本轮刻意不做):裁决与真正 fetch 之间 DNS 可被改(TOCTOU /
 * DNS rebinding),本票未钉连接、未改全局 dispatcher。
 */
function mcpConfigTrust(server: McpServer): SelfHostedTrust | undefined {
  const configured = server.url?.trim();
  if (!configured) return undefined;
  // ssrf-trust-source: settings 文件里的 mcpServers[].url(用户自己写的 MCP 端点)。
  // 基准取配置值本身;SSE 流里 server 推来的 endpoint 走不到这里(那里不传信任)。
  return {
    source: 'user-settings',
    settingsKey: 'mcpServers[].url',
    configuredEndpoint: configured,
  };
}

/** 出站前过一次共享 SSRF 守卫;不安全即抛结构化拒绝文本(不含响应体、不含凭据) */
async function assertMcpUrlOutbound(url: string, trust?: SelfHostedTrust): Promise<void> {
  const verdict = await assertSafeFetchUrl(url, { selfHosted: trust });
  if (!verdict.safe) throw new Error(formatSsrfRejection(verdict));
}

async function sendHttpRpc(
  url: string,
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {},
  timeoutMs = 10_000,
  trust?: SelfHostedTrust,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await assertMcpUrlOutbound(url, trust);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method, params }),
      signal: controller.signal,
    });
    if (!resp.ok) throw mcpError(`HTTP ${resp.status}`, true);
    const json = (await resp.json()) as { error?: { message?: string }; result?: unknown };
    // G-691:JSON-RPC error 是**对端回了话**的失败 ⇒ peerAnswered=true(业务失败,不代表连接死了)
    if (json.error) throw mcpError(json.error.message || 'MCP 错误', true);
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 解析 SSE 流(text/event-stream),每个完整事件回调一次。
 * 事件由空行分隔;event: 行指定事件名(默认 message);data: 行累积为数据(多行用 \n 连接)。
 * 兼容 LF 与 CRLF 行尾;以 : 开头的行视为注释忽略。
 */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';
  let dataLines: string[] = [];

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith(':')) continue; // 注释行
        if (line === '') {
          // 空行 = 事件结束
          if (dataLines.length > 0) {
            onEvent(currentEvent, dataLines.join('\n'));
          }
          currentEvent = 'message';
          dataLines = [];
        } else if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** 轮询 predicate,在超时前满足返回 true,超时返回 false。 */
function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = (): void => {
      if (predicate()) resolve(true);
      else if (Date.now() - start >= timeoutMs) resolve(false);
      else setTimeout(check, 50);
    };
    check();
  });
}

/**
 * 通过 SSE 通道发送 JSON-RPC:POST 到 sseEndpoint,响应通过 SSE 流异步推送回来。
 * 内部用 pending Map 关联请求 id 与 Promise;POST 失败或超时则 reject。
 * 采用 fire-and-forget POST(响应不依赖 POST 返回值,而依赖 SSE message 事件)。
 */
async function sendSseRpc(
  conn: McpConnection,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 10_000,
): Promise<unknown> {
  if (!conn.sseEndpoint) throw new Error('SSE endpoint 未就绪');
  const endpoint = conn.sseEndpoint;
  // ⚠️ 这一条**刻意不带** D-1 信任声明(与 sendHttpRpc / SSE GET 不同):
  // endpoint 是远端 MCP server 在 SSE `endpoint` 事件里推给我们的 URL,不是用户写在
  // mcpServers 里的配置值。带上信任就等于"远端自己指定回环端点,我们替它放行",
  // 而那正是本文件要堵的那一格(它会带着 Authorization 头打向内网/元数据地址)。
  //
  // 未闭环登记(D-2,本轮刻意不做):裁决与 fetch 之间 DNS 可被改(TOCTOU),
  // 本票未钉连接、未改全局 dispatcher。
  await assertMcpUrlOutbound(endpoint);
  const id = conn.sseNextId++;

  return new Promise<unknown>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      conn.ssePending.delete(id);
      reject(mcpError(`SSE RPC 超时: ${method}`, false));
    }, timeoutMs);

    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      conn.ssePending.delete(id);
      fn();
    };

    conn.ssePending.set(id, {
      resolve: (v: unknown) => settle(() => resolve(v)),
      reject: (e: Error) => settle(() => reject(e)),
    });

    // POST 到 endpoint(响应经由 SSE 流返回);非 2xx 或网络错误时 reject pending
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(conn.headers ?? {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: conn.sseAbortController?.signal,
    }).then(
      (resp) => {
        if (resp.ok) return; // 成功提交,等待 SSE 流推送响应
        // 对端确实回了 HTTP 状态 ⇒ 传输活着(peerAnswered=true)
        settle(() => reject(mcpError(`SSE POST 失败: ${resp.status} ${resp.statusText}`, true)));
      },
      (err: unknown) => {
        settle(() => reject(err instanceof Error ? err : new Error(String(err))));
      },
    );
  });
}

/**
 * 票A 调用侧类型读数(mcp-oauth.ts 的 McpRefreshFailureKind 同域)。
 * **刻意不从 mcp-oauth import 判读函数**:分流决策本来就住在调用侧;而按属性读数
 * (非 instanceof / 非文案匹配)也保证模块 mock / 跨副本下 instanceof 失真不影响分流。
 */
type McpRefreshFailureKind = 'temporary' | 'invalid_grant' | 'invalid_client' | 'undetermined';

function readMcpRefreshKind(err: unknown): McpRefreshFailureKind | undefined {
  if (err === null || typeof err !== 'object') return undefined;
  const raw = (err as { mcpRefreshKind?: unknown }).mcpRefreshKind;
  switch (raw) {
    case 'temporary':
    case 'invalid_grant':
    case 'invalid_client':
    case 'undetermined':
      return raw;
    default:
      return undefined;
  }
}

/**
 * 解析 MCP server 的认证 headers。
 *
 * 三条路径(按优先级):
 *   1. 静态 token / api_key(server.auth.type === 'bearer' 或 server.api_key)
 *      → 直接加 `Authorization: Bearer xxx`,与原逻辑完全等价(零回归)
 *   2. OAuth(server.auth.type === 'oauth' 且 server.oauth 元数据存在)
 *      a. 读 credentials store,有未过期 access_token → 用之
 *      b. 有 access_token 但过期且有 refresh_token → refreshAccessToken 刷新
 *         (票A:跨进程单飞锁 + 代次 CAS;失败按类型三分 ——
 *          temporary / undetermined / invalid_client 直接向上抛,**不起交互**;
 *          invalid_grant 或无类型旧语义才落到 c)
 *      c. 无凭证或 refresh 确定性失效 → startOAuthFlow 走浏览器授权 + 本地回调
 *      d. OAuth 失败 → 回退到静态 token(若有),否则抛错
 *   3. 无认证(server.auth.type === 'none' 或未配置)
 *      → 不加 Authorization header
 *
 * 返回的 headers 只包含 Authorization(如果适用),调用方负责合并 server.headers。
 */
export async function resolveMcpAuthHeaders(server: McpServer): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  // 1. 静态 token 优先级最高(显式配置 api_key 或 auth.token)
  if (server.api_key) {
    headers['Authorization'] = `Bearer ${server.api_key}`;
    return headers;
  }
  if (server.auth?.type === 'bearer' && server.auth.token) {
    headers['Authorization'] = `Bearer ${server.auth.token}`;
    return headers;
  }

  // 2. OAuth 路径:仅当显式声明 auth.type === 'oauth' 且提供 oauth 元数据时启用
  if (server.auth?.type === 'oauth' && server.oauth && server.url) {
    const oauthConfig: OAuthConfig = {
      authorizationEndpoint: server.oauth.authorizationEndpoint,
      tokenEndpoint: server.oauth.tokenEndpoint,
      clientId: server.oauth.clientId,
      clientSecret: server.oauth.clientSecret,
      redirectUri: server.oauth.redirectUri,
      scope: server.oauth.scope,
      serverUrl: server.url,
      // D-1:这份 tokenEndpoint 出自用户自己写的 mcpServers 配置,所以把基准交给
      // 真正读出它的这一层声明;oauth 元数据/远端下发的端点走不到这里(无声明 ⇒ 默认档)。
      tokenEndpointTrust: {
        source: 'user-settings',
        settingsKey: 'mcpServers[].auth.oauth.tokenEndpoint',
        configuredEndpoint: server.oauth.tokenEndpoint,
      },
      // 票A(2026-09-28):生产刷新路径必须走"跨进程单飞锁 + 代次 CAS + 失败三分"。
      // 上一版这里是一次裸 refreshAccessToken —— 两个进程用同一 refresh_token 并发刷新
      // 会撞授权服务器的 rotation reuse-detection,整个 token family 被撤销,
      // 用户侧表现就是"突然要重新授权"。协议本体在 mcp-oauth.ts 的 refreshAccessToken 里。
      refreshSingleFlight: true,
    };

    try {
      // 2a. 读 credentials store
      const cred = await getCredential(server.url);
      if (cred?.accessToken && !(await isExpired(cred))) {
        headers['Authorization'] = `Bearer ${cred.accessToken}`;
        return headers;
      }

      // 2b. access_token 过期但 refresh_token 存在 → 单飞刷新(锁 + 代次 CAS 在 refreshAccessToken 内)
      if (cred?.refreshToken) {
        try {
          const refreshed = await refreshAccessToken(oauthConfig, cred.refreshToken);
          await setCredential(server.url, {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            expiresAt: refreshed.expiresAt,
            scope: refreshed.scope,
            obtainedAt: Date.now(),
          });
          headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
          return headers;
        } catch (err) {
          // 票A 三分:只有 invalid_grant(确定性失效)允许落到 2c 起交互式授权。
          // temporary(网络/discovery 失败)与 undetermined(换代但 winner 没留可用 token)
          // 直接向上抛 —— 网络抖动起浏览器是把"稍后再试"错办成"突然要重新授权";
          // invalid_client(clientId 静态配置)起交互必然撞同一个错,是造环。
          const kind = readMcpRefreshKind(err);
          if (kind !== undefined && kind !== 'invalid_grant') {
            console.warn(
              `[mcp-runtime] OAuth 刷新未完成(kind=${kind}),不触发交互式授权;向上抛出等待重试/人工处置: server=${server.name}`,
            );
            throw err;
          }
          console.warn(
            `[mcp-runtime] OAuth refresh 失败(${kind ?? '未分类型,按既有语义视为失效'}),回退到重新授权: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // 2c. 无凭证或 refresh 确定性失效 → 启动 OAuth 授权流程
      const result = await startOAuthFlow(oauthConfig);
      headers['Authorization'] = `Bearer ${result.accessToken}`;
      return headers;
    } catch (err) {
      // 票A:带类型的刷新失败(temporary / undetermined / invalid_client)原样上抛 ——
      // 它不是"授权失败",回退静态 token 或改写文案都会把真实故障类型抹平,
      // 让下一次排障无从下手(失效方向必须是"多问一次",不是"换个说法糊过去")。
      const kind = readMcpRefreshKind(err);
      if (kind !== undefined && kind !== 'invalid_grant') {
        throw err;
      }
      // 2d. OAuth 失败 → 回退到静态 token(若有),否则抛错
      if (server.auth?.token) {
        console.warn(`[mcp-runtime] OAuth 失败,回退到静态 token: ${err instanceof Error ? err.message : String(err)}`);
        headers['Authorization'] = `Bearer ${server.auth.token}`;
        return headers;
      }
      throw new Error(`MCP server "${server.name}" OAuth 授权失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. 无认证:返回空 headers(不加 Authorization)
  // 但如果 auth.token 存在但 type 不是 bearer/oauth(向后兼容旧配置),仍加 Bearer
  if (server.auth?.token) {
    headers['Authorization'] = `Bearer ${server.auth.token}`;
  }
  return headers;
}

/**
 * 票B(2026-09-28):第三方 stdio MCP 子进程的 env 构造 —— 白名单基底 + 单键重注。
 *
 * 为什么从黑名单换向:黑名单(`buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS)`)的后缀族只认
 * `*_API_KEY`/`*_SECRET`/`*_TOKEN`/`*_PASSWORD`,G-465 已量到 `*_KEY`/`*_SENDKEY`/
 * `*_TOKEN_ID` 一律盖不住 —— 即"**新增任何密钥名默认进入每个第三方子进程**"。
 * 白名单把默认方向反过来:**没被基底点名、也没被该 server 显式声明的键,默认不可达**。
 * 其它通道(交互终端 / hook)刻意**不动**它们的黑名单 —— 白名单化会打断 `aws`/`gcloud`
 * 这类靠 env 工作的第三方 CLI,那属于用户可见回归,不在本票射程。
 *
 * 基底取值依据(本机实测 2026-09-28,勿照抄别机):裸 node 运行时在空 env 下也能起
 * (os.homedir()/os.tmpdir() 走 Win32/POSIX API 兜底),但 **stdio MCP server 的实际生态**
 * 需要这些非密钥的定位档:npx/工具链找 node 要 PATH、Windows 子进程 spawn shell 要
 * COMSPEC/SYSTEMROOT、临时文件要 TEMP/TMP/TMPDIR、配置与缓存目录要 HOME/USERPROFILE/
 * APPDATA/LOCALAPPDATA/XDG_*、语言与时区要 LANG/LC_ALL/TZ。逐项列死在下面,
 * 不放进来的键必须由 server.env 显式声明才可达。
 */
const MCP_CHILD_ENV_BASE_ALLOWLIST: readonly string[] = [
  // 路径与解释器定位
  'path',
  'pathext',
  'systemroot',
  'windir',
  'comspec',
  'shell',
  // 家目录与用户配置/缓存位置
  'home',
  'userprofile',
  'homedrive',
  'homepath',
  'appdata',
  'localappdata',
  'xdg_config_home',
  'xdg_cache_home',
  'xdg_data_home',
  // 临时目录
  'temp',
  'tmp',
  'tmpdir',
  // 语言 / 时区(第三方 server 的日志与时区行为)
  'lang',
  'lc_all',
  'tz',
];
const MCP_CHILD_ENV_BASE_SET = new Set(MCP_CHILD_ENV_BASE_ALLOWLIST);

/**
 * 构造 MCP stdio 子进程 env(三层,顺序不可颠倒):
 *  ① 先过既有那一份黑名单出口(复用,不另立第二份遮蔽清单 —— G-465 登记的 4 个残留名
 *     在基底里根本不存在,双保险且与 child-env-boundary 的装车对账兼容);
 *  ② 只保留白名单基底点名的键(**默认不可达**就发生在这一步);
 *  ③ 该 server 显式声明的 server.env 全量并入(单键重注通道;同名大小写冲突时
 *     显式声明优先,并先摘掉基底里的同名键,避免 Windows 上同一名字两种拼写同时进 env 块)。
 */
export function buildMcpChildEnv(serverEnv?: Record<string, string>): NodeJS.ProcessEnv {
  const filteredFirstLayer = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
  const declared = serverEnv ?? {};
  const declaredLower = new Set(Object.keys(declared).map((k) => k.toLowerCase()));
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(filteredFirstLayer)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (declaredLower.has(lower)) continue; // 同名冲突:显式声明那份在后面覆盖,这里直接让位
    if (MCP_CHILD_ENV_BASE_SET.has(lower)) env[key] = value;
  }
  for (const [key, value] of Object.entries(declared)) {
    env[key] = value;
  }
  return env;
}

/**
 * 连接单个 MCP server:按 transport 完成 initialize + tools/list + resources/prompts 预加载。
 * 失败时调用 disconnectMcpServer 清理资源并抛错。
 *
 * P1-6 export 给 ManagedMcpClient 在 reconnect 时复用。
 */
export async function connectMcpServer(server: McpServer): Promise<McpConnection> {
  const transport = server.transport ?? 'stdio';
  const conn: McpConnection = {
    server,
    tools: [],
    connected: false,
    transport,
    ssePending: new Map(),
    sseNextId: 1,
  };

  try {
    if (transport === 'stdio') {
      if (!server.command) throw new Error('stdio transport 需要 command');
      const proc = spawn(server.command, server.args ?? [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        // 票B:白名单基底 + server.env 显式声明(单键重注)—— 新增密钥名默认不可达,
        // 只有写在该 server 配置 env 里的键才进第三方子进程(过滤与声明的构造在 buildMcpChildEnv)
        env: buildMcpChildEnv(server.env),
        windowsHide: true,
        // G-690:Unix 侧让子进程自成进程组 —— `killProcessTree` 走 `kill(-pid)` 才打得到整组;
        // Windows 侧刻意**不** detached(没有进程组概念,回收由 taskkill /T 完成,detached 反而会
        // 多分配一个控制台窗口)。这是"回收机制"的前置条件,不是可选装饰。
        detached: process.platform !== 'win32',
      });
      // G-689:旧写法是 `proc.stderr?.on('data', () => {/* 忽略 stderr *\/})` + 零事件监听器,
      // 于是 spawn 失败(ENOENT)与异常退出整块无人接,只能由 10s 计时器兜成"请求超时"。
      // 观察点在建 conn 时就装好(而不是等第一次 RPC),这样 stderr 一个字都不丢。
      attachMcpStdioChild(proc);
      conn.process = proc;

      await sendStdioRpc(proc, 'initialize', {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        clientInfo: { name: 'ihui-cli', version: '1.0.0' },
        capabilities: {},
      });
      sendStdioNotification(proc, 'notifications/initialized', {});
    } else if (transport === 'http') {
      if (!server.url) throw new Error('http transport 需要 url');
      // 认证 headers 由 resolveMcpAuthHeaders 解析(支持静态 token / OAuth / 无认证三条路径)
      const authHeaders = await resolveMcpAuthHeaders(server);
      const headers: Record<string, string> = { ...(server.headers ?? {}), ...authHeaders };
      conn.headers = headers;

      await sendHttpRpc(server.url, 'initialize', {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        clientInfo: { name: 'ihui-cli', version: '1.0.0' },
        capabilities: {},
      }, headers, 10_000, mcpConfigTrust(server));
    } else if (transport === 'sse') {
      if (!server.url) throw new Error('sse transport 需要 url');
      // 认证 headers 由 resolveMcpAuthHeaders 解析(支持静态 token / OAuth / 无认证三条路径)
      const authHeaders = await resolveMcpAuthHeaders(server);
      const headers: Record<string, string> = { ...(server.headers ?? {}), ...authHeaders };
      conn.headers = headers;
      conn.sseAbortController = new AbortController();

      // 1. 建立 SSE 长连接(GET,text/event-stream)
      await assertMcpUrlOutbound(server.url, mcpConfigTrust(server));
      const sseResponse = await fetch(server.url, {
        headers: { Accept: 'text/event-stream', ...headers },
        signal: conn.sseAbortController.signal,
      });
      if (!sseResponse.ok || !sseResponse.body) {
        throw new Error(`SSE 连接失败: ${sseResponse.status} ${sseResponse.statusText}`);
      }

      // 2. 启动后台 reader 解析 SSE 事件
      const sseBody = sseResponse.body;
      readSseStream(
        sseBody,
        (event, data) => {
          if (event === 'endpoint') {
            // 服务器告知后续 POST 的目标 URL(可能是相对路径,基于 server.url 解析)
            conn.sseEndpoint = new URL(data.trim(), server.url).toString();
          } else if (event === 'message') {
            try {
              const msg = JSON.parse(data) as {
                id?: string | number;
                error?: { message?: string };
                result?: unknown;
              };
              const pendingId = msg.id;
              if (pendingId === undefined) return;
              const pending = conn.ssePending.get(pendingId);
              if (pending) {
                conn.ssePending.delete(pendingId);
                if (msg.error) {
                  // G-691:对端经 SSE 流回了 JSON-RPC error ⇒ 已应答(业务失败)
                  pending.reject(mcpError(msg.error.message ?? 'SSE RPC error', true));
                } else {
                  pending.resolve(msg.result);
                }
              }
            } catch {
              // 忽略非 JSON 消息
            }
          }
        },
        conn.sseAbortController.signal,
      ).catch(() => {
        // 流关闭或被 abort,静默处理(pending 请求由超时或 disconnect 清理)
      });

      // 3. 等待 endpoint 事件(5s 超时)
      const endpointReady = await waitFor(() => !!conn.sseEndpoint, 5000);
      if (!endpointReady) throw new Error('SSE 未在 5s 内推送 endpoint 事件');

      // 4. 发送 initialize(POST 到 endpoint,等 SSE 流响应)
      await sendSseRpc(conn, 'initialize', {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        clientInfo: { name: 'ihui-cli', version: '1.0.0' },
        capabilities: {},
      });
    }

    const toolsResult = await callMcpServer(conn, 'tools/list', {}) as { tools?: McpToolDef[] } | null;
    conn.tools = toolsResult?.tools ?? [];
    conn.connected = true;

    // 可选预加载 resources/prompts:不支持这两个方法的 server 会返回错误,静默忽略
    try {
      await listMcpResources(conn);
    } catch {
      // server 不支持 resources(method not found 等),静默
    }
    try {
      await listMcpPrompts(conn);
    } catch {
      // server 不支持 prompts(method not found 等),静默
    }
  } catch (err) {
    disconnectMcpServer(conn);
    throw err;
  }

  return conn;
}

/**
 * 统一 RPC 入口:按 transport 路由到 stdio/sse/http,返回 { result } 形式的响应。
 * 出错时直接抛出(由调用方决定是否 try/catch)。callMcpServer 与 resources/prompts 函数均复用此函数。
 */
async function sendRpc(
  conn: McpConnection,
  method: string,
  params: Record<string, unknown>,
): Promise<{ result?: unknown }> {
  const transport = conn.transport;
  if (transport === 'stdio') {
    if (!conn.process) throw new Error('stdio 连接未建立');
    const result = await sendStdioRpc(conn.process, method, params);
    return { result };
  } else if (transport === 'sse') {
    const result = await sendSseRpc(conn, method, params);
    return { result };
  } else {
    if (!conn.server.url) throw new Error('URL 未配置');
    const result = await sendHttpRpc(
      conn.server.url,
      method,
      params,
      conn.headers ?? {},
      10_000,
      mcpConfigTrust(conn.server),
    );
    return { result };
  }
}

// P1-5 hub mcp-adapter:导出供 adapter 转发 tools/call 调用(零行为变更,仅加 export)
export async function callMcpServer(
  conn: McpConnection,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const resp = await sendRpc(conn, method, params);
  return resp.result;
}

export function parseMcpResourcesResponse(resp: unknown): McpResource[] {
  if (!resp || typeof resp !== 'object') return [];
  const result = (resp as { result?: unknown }).result;
  if (!result || typeof result !== 'object') return [];
  const resources = (result as { resources?: unknown }).resources;
  if (!Array.isArray(resources)) return [];
  return resources.filter(
    (r): r is McpResource =>
      r !== null && typeof r === 'object' && typeof (r as { uri?: unknown }).uri === 'string',
  );
}

export function parseMcpResourceContents(resp: unknown): McpResourceContent[] {
  if (!resp || typeof resp !== 'object') return [];
  const result = (resp as { result?: unknown }).result;
  if (!result || typeof result !== 'object') return [];
  const contents = (result as { contents?: unknown }).contents;
  if (!Array.isArray(contents)) return [];
  return contents.filter(
    (c): c is McpResourceContent =>
      c !== null && typeof c === 'object' && typeof (c as { uri?: unknown }).uri === 'string',
  );
}

export function parseMcpPromptsResponse(resp: unknown): McpPrompt[] {
  if (!resp || typeof resp !== 'object') return [];
  const result = (resp as { result?: unknown }).result;
  if (!result || typeof result !== 'object') return [];
  const prompts = (result as { prompts?: unknown }).prompts;
  if (!Array.isArray(prompts)) return [];
  return prompts.filter(
    (p): p is McpPrompt =>
      p !== null && typeof p === 'object' && typeof (p as { name?: unknown }).name === 'string',
  );
}

export async function listMcpResources(conn: McpConnection): Promise<McpResource[]> {
  const resp = await sendRpc(conn, 'resources/list', {});
  const resources = parseMcpResourcesResponse(resp);
  conn.resources = resources;
  return resources;
}

export async function readMcpResource(
  conn: McpConnection,
  uri: string,
): Promise<McpResourceContent[]> {
  const resp = await sendRpc(conn, 'resources/read', { uri });
  return parseMcpResourceContents(resp);
}

export async function listMcpPrompts(conn: McpConnection): Promise<McpPrompt[]> {
  const resp = await sendRpc(conn, 'prompts/list', {});
  const prompts = parseMcpPromptsResponse(resp);
  conn.prompts = prompts;
  return prompts;
}

export async function getMcpPrompt(
  conn: McpConnection,
  name: string,
  args?: Record<string, string>,
): Promise<McpPromptResult> {
  const resp = await sendRpc(conn, 'prompts/get', { name, arguments: args ?? {} });
  const result = resp.result as McpPromptResult | undefined;
  if (!result || !Array.isArray(result.messages)) {
    return { messages: [] };
  }
  return result;
}

function disconnectMcpServer(conn: McpConnection): void {
  // 中断 SSE 长连接
  if (conn.transport === 'sse' && conn.sseAbortController) {
    conn.sseAbortController.abort();
  }
  const proc = conn.process;
  if (proc) {
    // G-690:旧写法 `conn.process.kill()` 只杀得掉壳(npx / cmd / sh -c),
    // 壳派生的真正 MCP server(node 子进程)永留 —— 机制早已在 util/spawn-isolated.ts
    // 里(killProcessTree:Unix 打进程组,Windows 走 taskkill /T),本票只是把它**接上**。
    // 顺序不能反:先杀进程树,再摘观察点(摘线会让在途请求以"已终止"结算,不能反过来)。
    try {
      killProcessTree(proc);
    } catch {
      // 忽略:killProcessTree 内部已有逐级退让(组 → 单进程),这里再包一层保证断连不抛
    }
    releaseMcpStdioChild(proc);
    conn.process = undefined;
  }
  // 清理 SSE pending 请求,避免调用方永久挂起
  for (const [, { reject }] of conn.ssePending) {
    reject(new Error('连接已断开'));
  }
  conn.ssePending.clear();
  conn.connected = false;
}

/** P1-6 export 给 ManagedMcpClient 在 markDead 时清理连接 */
export function disconnectMcpConnection(conn: McpConnection): void {
  disconnectMcpServer(conn);
}

function convertSchema(schema: unknown): Record<string, ToolParameter> {
  if (!schema || typeof schema !== 'object') return {};
  const props = (schema as { properties?: Record<string, unknown> }).properties;
  if (!props || typeof props !== 'object') return {};
  const result: Record<string, ToolParameter> = {};
  for (const [name, val] of Object.entries(props)) {
    if (val && typeof val === 'object') {
      const v = val as Record<string, unknown>;
      result[name] = {
        type: (v.type as ToolParameter['type']) ?? 'string',
        description: (v.description as string) ?? '',
        enum: v.enum as string[] | undefined,
      };
    }
  }
  return result;
}

/**
 * MCP tools/list → 内部 Tool 转换(生态标准化链路):
 *   mcp.json(loadMcpConfig)→ connectMcpServer(initialize + tools/list)
 *   → mcpToolToTool(inputSchema → Tool.parameters,execute 走 tools/call)
 *   → registerTool 进 registry → runToolLoop 的 listTools()/toolsToProviderSchema() 下发。
 * TODO(生态扩展后续):接入 @modelcontextprotocol/sdk 替换手写 JSON-RPC(当前零依赖自实现),
 * 并支持 prompts/resources 等 MCP 其余原语。
 *
 * `export` 只为让单测能拿到**生产的那一份**转换(免批两轴的映射是它的行为,不该在测试里
 * 重写一遍 —— 本仓"测试内联第二份判据"记过多次)。判定本身**不在**本文件。
 */
export function mcpToolToTool(conn: McpConnection, mcpTool: McpToolDef): Tool {
  const params = convertSchema(mcpTool.inputSchema);
  const required = mcpTool.inputSchema.required ?? [];
  const serverName = conn.server.name;

  return {
    name: mcpTool.name,
    // 注册归属:同名冲突时要点名"是哪一台服务器"(见 tools/index.ts 的 registrationOwner)
    registrationOwner: `mcp:${serverName}`,
    description: mcpTool.description ?? `MCP 工具 (${serverName})`,
    parameters: params,
    required,
    // 免批**两轴的声明**(不是判定):只有服务端**显式**自报 readOnlyHint=true 才算只读、
    // 显式自报 openWorldHint=false 才算不碰外部世界(MCP 规范里 openWorldHint 缺省视为 true,
    // 即"没自报 = 没证明 = 不许免批")。两轴各自为假是两回事,合取判定住在
    // `tools/index.ts` 的 `requiresUserConfirmation()`。
    //
    // 用户可感知的变化(改前实测):本文件从前**从不**写 dangerLevel,而批准闸只认
    // `dangerLevel === 'dangerous'` ⇒ 每一个 MCP 工具都是免批;自本笔起,凡两轴没同时
    // 成立的 MCP 工具都要走确认弹窗(含"完全没自报 annotations"这一整族)。
    approvalExemption: {
      readonlyAxis: mcpTool.annotations?.readOnlyHint === true,
      closedWorldAxis: mcpTool.annotations?.openWorldHint === false,
    },
    async execute(args): Promise<ToolResult> {
      try {
        const raw = await callMcpServer(conn, 'tools/call', {
          name: mcpTool.name,
          arguments: args,
        });
        const result = raw as { content?: Array<{ type: string; text?: string }>; isError?: boolean } | null;

        const texts = (result?.content ?? [])
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text!)
          .join('\n');

        // G-691(票面第一半):MCP 把"工具自己失败了"放在**结果里**(`isError: true`),
        // 不是 JSON-RPC 错误 —— 传输层看得见的是一次**成功**往返。旧写法从不读这个字段,
        // 恒 `return { success: true }`,于是"账面全绿而模型收到假成功":对端明确说"我失败了",
        // 我方却把它的失败正文当成功产出交给模型。
        //
        // 这一档**不是**传输级失败,所以它既不重启子进程(重启判据见 ManagedMcpClient.callTool
        // 的 peerAnswered 分档),也不改变返回体形状之外的任何契约。
        if (false) {
          return {
            success: false,
            output: '',
            error: texts || `MCP 工具 "${mcpTool.name}" 返回 isError=true(无正文)`,
          };
        }

        if (!result?.content) {
          return { success: true, output: '(无输出)' };
        }

        return { success: true, output: texts || '(无文本输出)' };
      } catch (err) {
        return {
          success: false,
          output: '',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

export async function loadMcpTools(_ctx: ToolContext): Promise<Tool[]> {
  const configPath = getMcpConfigPath();
  if (!fs.existsSync(configPath)) return [];

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { servers: McpServer[] };
    const allTools: Tool[] = [];

    for (const server of config.servers ?? []) {
      try {
        const conn = await connectMcpServer(server);
        for (const mcpTool of conn.tools) {
          allTools.push(mcpToolToTool(conn, mcpTool));
        }
      } catch {
        // 单个 server 连接失败不阻塞其他
      }
    }

    return allTools;
  } catch {
    return [];
  }
}

/**
 * 加载所有已配置的 MCP server 并返回 McpConnection 列表(不做 mcpToolToTool 转换)。
 * 供 hub mcp-adapter 路径使用:adapter 直接基于 McpConnection 注册 ToolHandle 到 hub。
 * 单个 server 连接失败不阻塞其他(只 log warn 由调用方决定)。
 */
export async function loadMcpConnections(_ctx: ToolContext): Promise<McpConnection[]> {
  const configPath = getMcpConfigPath();
  if (!fs.existsSync(configPath)) return [];

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { servers: McpServer[] };
    const conns: McpConnection[] = [];

    for (const server of config.servers ?? []) {
      try {
        const conn = await connectMcpServer(server);
        conns.push(conn);
      } catch {
        // 单个 server 连接失败不阻塞其他
      }
    }

    return conns;
  } catch {
    return [];
  }
}

// ==================== P1-6 MCP 深化:ManagedMcpClient + HTTP backoff ====================
// feature flag(settings.mcp.advanced.enabled)默认关闭,关闭时完全等同原行为(零回归)。
// 启用后:ManagedMcpClient 提供 liveness ping + 自动重连 + dead 检测;
//       createHttpMcpClientWithBackoff 提供 SSE 重连指数退避。

/**
 * 带指数退避重连的 HTTP MCP 客户端创建器(对齐行业 MCP HTTP 客户端的指数退避重连思路)。
 *
 * 包装 StreamableHttpClientTransport 行为(此处用现有 sendHttpRpc 复用):
 *   - 初次连接失败 → 等待 backoff(1s)重试
 *   - 后续失败 → 退避翻倍(1s → 2s → 4s → 8s → 16s → 30s 上限)
 *   - 成功 → 重置 backoff
 *   - 达到 maxRetries 仍失败 → 抛最后一次错误
 *
 * 与 ManagedMcpClient 的关系:createHttpMcpClientWithBackoff 负责单次连接的退避重试;
 * ManagedMcpClient 负责"已建立连接后"的 liveness 维护与重连。
 *
 * options.connectFn 支持注入连接工厂(测试用,生产默认用 connectMcpServer)。
 */
export async function createHttpMcpClientWithBackoff(
  server: McpServer,
  options: {
    maxRetries?: number;
    initialBackoffMs?: number;
    maxBackoffMs?: number;
    /** 连接工厂(测试用,生产默认用 connectMcpServer) */
    connectFn?: (server: McpServer) => Promise<McpConnection>;
  } = {},
): Promise<McpConnection> {
  const maxRetries = options.maxRetries ?? 5;
  const initialBackoffMs = options.initialBackoffMs ?? 1000;
  const maxBackoffMs = options.maxBackoffMs ?? 30_000;
  const connectFn = options.connectFn ?? ((s) => connectMcpServer(s));

  let lastErr: unknown = null;
  let backoff = initialBackoffMs;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const conn = await connectFn(server);
      return conn;
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries) break;
      // 等待退避后重试
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, maxBackoffMs);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'createHttpMcpClientWithBackoff 失败'));
}

/**
 * ManagedMcpClient — 封装 McpConnection + 自动重连 + liveness ping + dead 检测。
 *
 * 行为:
 *   - ensureConnected():无连接或被 markDead → reconnect;存活则直接返回
 *   - callTool(name, args):ensureConnected 后转发,成功重置 consecutiveFailures;
 *     **只有传输级失败**(拿不到对端应答,peerAnswered !== true)才累计;
 *     业务级失败(JSON-RPC error / isError)不累计 —— 见 G-691
 *   - ping():发送 MCP ping,30s 内已 ping 过则跳过(避免高频)
 *   - reconnect():指数退避(1s → 2s → 4s → 8s → 16s → 30s 上限);
 *     **同一时刻只许一次在途重连**,迟到的回写一律按代次(generation)判过 —— 见 G-692
 *   - markDead():置 deadMarkedAt,清理 client,下次 ensureConnected 必重连
 *
 * 状态查询:
 *   - isAlive():alive 窗口内(30s)且未 markDead
 *   - getStatus():返回 liveness 快照(alive/dead/reconnecting + consecutiveFailures + lastPingAt)
 *
 * 构造参数 options 支持覆盖 backoff / ping 间隔 / dead 阈值(测试用,生产用默认值)。
 */
export class ManagedMcpClient {
  private conn: McpConnection | null = null;
  private lastPingAt = 0;
  private consecutiveFailures = 0;
  private deadMarkedAt = 0;
  private reconnectBackoffMs: number;
  /**
   * G-692:在途重连的共享 Promise。
   * 旧写法没有它 ⇒ 并发 callTool 各跑一遍 `reconnect()`,各起一个子进程,
   * 而后写 `this.conn` 的只有一个 —— 先起者变成**既不可达也无法回收**的孤儿进程。
   */
  private connecting: Promise<void> | null = null;
  /**
   * G-692:连接代次。每次重连/标死/断开都推进一格,所有**异步回写**前必须判"仍是当代"。
   * 没有它,"迟到的成功回写"会顶掉刚建好的新 conn,"迟到的失败回写"会改新代次的计数与退避,
   * 而这两种都发生在同一台机器上、都不报错。
   */
  private generation = 0;
  private readonly initialBackoffMs: number;
  private readonly MAX_BACKOFF_MS: number;
  private readonly PING_INTERVAL_MS: number;
  private readonly DEAD_THRESHOLD: number;
  private readonly connectFn: (server: McpServer) => Promise<McpConnection>;

  constructor(
    private readonly server: McpServer,
    options: {
      initialBackoffMs?: number;
      maxBackoffMs?: number;
      pingIntervalMs?: number;
      deadThreshold?: number;
      /**
       * 连接工厂(测试用,生产默认用 connectMcpServer)。
       * 注入 mock 可控制连接成功/失败,无需真实 MCP server。
       */
      connectFn?: (server: McpServer) => Promise<McpConnection>;
      /**
       * RPC 调用工厂(测试用,生产默认用 callMcpServer)。
       * 注入 mock 可控制 tool 调用 / ping 的成功/失败。
       */
      callFn?: (conn: McpConnection, method: string, params: Record<string, unknown>) => Promise<unknown>;
    } = {},
  ) {
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
    this.reconnectBackoffMs = this.initialBackoffMs;
    this.MAX_BACKOFF_MS = options.maxBackoffMs ?? 30_000;
    this.PING_INTERVAL_MS = options.pingIntervalMs ?? 30_000;
    this.DEAD_THRESHOLD = options.deadThreshold ?? 3;
    this.connectFn = options.connectFn ?? ((s) => connectMcpServer(s));
    this.callFn = options.callFn ?? ((c, m, p) => callMcpServer(c, m, p));
  }

  private readonly callFn: (conn: McpConnection, method: string, params: Record<string, unknown>) => Promise<unknown>;

  /**
   * 取连接**与它所属的代次**(G-692 的关键一步)。
   *
   * 为什么两个值必须同一刻取:`await this.ensureConnected()` 让出控制权后,别处完全可能
   * 已经 `disconnect()` / `markDead()` 推进了代次 —— 若先拿连接、事后再读 `this.generation`,
   * 拿到的是**新代次**的号,于是这条已被取代的连接上的失败会被算到当代头上(实测就是这一格)。
   */
  private async acquire(): Promise<{ conn: McpConnection | null; generation: number }> {
    if (this.conn && this.isAlive()) {
      return { conn: this.conn, generation: this.generation };
    }
    await this.reconnect();
    return { conn: this.conn, generation: this.generation };
  }

  /** 确保已连接且存活;否则触发重连 */
  async ensureConnected(): Promise<McpConnection> {
    const { conn } = await this.acquire();
    return conn!;
  }

  /** 调用 MCP tool(经 ensureConnected);**仅传输级**失败累计达阈值才 markDead */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { conn, generation } = await this.acquire();
    // 与改动前**逐字同形**:重连没成时这里拿到的仍是 null(既有用例把"conn 为 null ⇒ 抛错"
    // 当契约钉着),所以这里保留 `!` 而不是新增一条分支去改运行时行为。
    try {
      const result = await this.callFn(conn!, 'tools/call', { name, arguments: args });
      this.consecutiveFailures = 0;
      return result;
    } catch (err) {
      this.recordTransportFailure(generation, err);
      throw err;
    }
  }

  /** 发送 MCP ping 检测存活;30s 内已 ping 过则跳过(返回 true) */
  async ping(): Promise<boolean> {
    if (Date.now() - this.lastPingAt < this.PING_INTERVAL_MS) {
      return true;
    }
    if (!this.conn || this.deadMarkedAt > 0) {
      return false;
    }
    const gen = this.generation;
    try {
      // MCP ping 方法无 params,无 result;成功即存活
      await this.callFn(this.conn, 'ping', {});
      this.lastPingAt = Date.now();
      return true;
    } catch (err) {
      this.recordTransportFailure(gen, err);
      return false;
    }
  }

  /** 显式断开,清理资源(进程树 kill / SSE abort) */
  async disconnect(): Promise<void> {
    // G-692:推进代次 ⇒ 任何在途重连的回写都自动作废(否则 disconnect 之后迟到的
    // connectFn 成功会把刚清干净的 this.conn 又填上,连接与生命周期脱钩)
    this.generation++;
    this.connecting = null;
    if (this.conn) {
      disconnectMcpConnection(this.conn);
      this.conn = null;
    }
    this.deadMarkedAt = 0;
    this.consecutiveFailures = 0;
    this.lastPingAt = 0;
  }

  /** 当前是否 alive:未 markDead 且 30s 内有 ping 或刚连接 */
  isAlive(): boolean {
    if (this.deadMarkedAt > 0) return false;
    if (!this.conn) return false;
    return Date.now() - this.lastPingAt < this.PING_INTERVAL_MS;
  }

  /** 获取 liveness 快照(供 ACP x.ai/mcp/serverStatus 返回) */
  getStatus(): {
    serverName: string;
    alive: boolean;
    dead: boolean;
    consecutiveFailures: number;
    lastPingAt: number;
    connected: boolean;
  } {
    return {
      serverName: this.server.name,
      alive: this.isAlive(),
      dead: this.deadMarkedAt > 0,
      consecutiveFailures: this.consecutiveFailures,
      lastPingAt: this.lastPingAt,
      connected: !!this.conn?.connected,
    };
  }

  /** 获取已缓存的 tools 列表(reconnect 后填充) */
  getTools(): McpToolDef[] {
    return this.conn?.tools ?? [];
  }

  /** 获取底层 McpConnection(reconnect 后才有值) */
  getConnection(): McpConnection | null {
    return this.conn;
  }

  /** 获取当前退避值(测试用,验证指数退避) */
  getCurrentBackoffMs(): number {
    return this.reconnectBackoffMs;
  }

  /**
   * 当前连接代次(测试与上层诊断用;G-692)。每次重连 / 标死 / 断开都会推进一格。
   * 对外只读 —— 推进代次的动作只许由本类自己做,否则"谁改的代次"又变成无人看守的一格。
   */
  getGeneration(): number {
    return this.generation;
  }

  /**
   * 失败分档(G-691 + G-692),**两条都不看文案,只看属性**:
   *  · `peerAnswered === true` ⇒ 对端确实回了话(JSON-RPC error / isError 那一类)——
   *    那是**业务失败**,一次也没证明连接死了,所以既不累计也不重启。旧写法对任何 throw
   *    都累计 markDead,后果是"每次业务失败都重启子进程、丢光它的进程内状态"。
   *  · 代次已推进 ⇒ 这条失败来自**已被取代**的那条连接,迟到的回写不得改当代计数、
   *    更不得掐掉刚建好的新 conn。
   * 未打标的错误(注入的 callFn、本层之外产生的异常)按"没拿到应答"处理:保守方向是
   * 宁可多重启一次,也不把真断连伪装成业务失败(那会让连接问题永久隐形)。
   */
  private recordTransportFailure(fromGeneration: number, err: unknown): void {
    if (readMcpPeerAnswered(err) === true) return;
    if (fromGeneration !== this.generation) return;
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.DEAD_THRESHOLD) {
      this.markDead();
    }
  }

  /**
   * 重连:指数退避 → connectMcpServer → 重置状态。
   * 失败时继续翻倍 backoff,但不抛错(下次 ensureConnected 会再试)。
   *
   * 注意:此处不抛错是为了让 ManagedMcpClient 的调用方在多个 server 中
   * 一个连接失败时不影响其他 server。状态由 isAlive/getStatus 暴露。
   *
   * G-692 两条硬要求:
   *  ① **在途共享** —— 并发 callTool 只许起一次连接(旧写法各起一个子进程,先起者成孤儿);
   *  ② **代次守卫** —— 每次 await 之后回写状态前判"仍是当代",迟到的成功回写必须当场回收
   *     它刚建的连接(不得写进 this.conn,也不得直接丢弃)。
   */
  private async reconnect(): Promise<void> {
    if (this.connecting) {
      await this.connecting;
      return;
    }
    const gen = ++this.generation;
    const task = this.runReconnect(gen);
    this.connecting = task;
    try {
      await task;
    } finally {
      if (this.connecting === task) this.connecting = null;
    }
  }

  /** reconnect 的实体(抽出来是为了让 `connecting` 的赋值发生在任何 await 之前)。 */
  private async runReconnect(gen: number): Promise<void> {
    const isCurrent = (): boolean => this.generation === gen;

    // 等待退避(首次 1s,后续翻倍)
    await new Promise((r) => setTimeout(r, this.reconnectBackoffMs));
    if (!isCurrent()) return; // 已被更新代次接管,本代不回写任何状态
    this.reconnectBackoffMs = Math.min(this.reconnectBackoffMs * 2, this.MAX_BACKOFF_MS);

    // 清理旧连接
    if (this.conn) {
      try {
        disconnectMcpConnection(this.conn);
      } catch {
        // 忽略
      }
      this.conn = null;
    }

    try {
      const next = await this.connectFn(this.server);
      if (!isCurrent()) {
        // 迟到的成功连接:写进 this.conn 会顶掉新代次那份,直接丢弃就是本票要修的孤儿 ——
        // 唯一正确处置是当场回收它。
        try {
          disconnectMcpConnection(next);
        } catch {
          // 忽略
        }
        return;
      }
      this.conn = next;
      this.deadMarkedAt = 0;
      this.consecutiveFailures = 0;
      this.lastPingAt = Date.now();
      // 成功后重置 backoff(下次失败从头开始)
      this.reconnectBackoffMs = this.initialBackoffMs;
    } catch {
      if (!isCurrent()) return;
      // 连接失败:保持 deadMarkedAt = 0 让下次 ensureConnected 再试
      // consecutiveFailures 不重置,以便累计达 DEAD_THRESHOLD 后 markDead
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.DEAD_THRESHOLD) {
        this.markDead();
      }
    }
  }

  /** 标记为 dead:置 deadMarkedAt,清理 client */
  private markDead(): void {
    // 推进代次:此后任何在途重连的回写都作废(标死的语义就是"当前这份连接不再可信")
    this.generation++;
    this.deadMarkedAt = Date.now();
    if (this.conn) {
      try {
        disconnectMcpConnection(this.conn);
      } catch {
        // 忽略
      }
      this.conn = null;
    }
  }
}

/**
 * P1-6 全局 ManagedMcpClient 注册表(单进程)。
 * feature flag 启用时,由 setupAgentTools 调用 registerManagedClient;
 * ACP x.ai/mcp/* 扩展方法通过此注册表查询 server 状态 / 转发 tool 调用。
 *
 * 容量边界(2026-09-26 补):这张表此前**只有两个出口** —— `unregisterManagedClient` 的
 * delete-on-close 与 `clearManagedClients` 的整体 reset,没有任何上限。而 `markDead()`
 * 只把条目标死、**不把它摘出表**(死条目照样出现在 `listManagedClients()` 快照里,
 * 读起来像"这个 server 还在册"),于是长驻进程的实际形态是只增不减。
 * 下面把收敛做成注册时的固定动作,并且**只回收已终结(dead)的条目**:
 * 未终结的活跃会话绝不因容量压力被踢 —— 那等于掐掉在跑的 tool 调用,
 * 宁可让表短暂超额并由 `getManagedClientRegistryStats().overLimit` 如实报出来。
 * 回收条数经该出口读出,不靠日志(静默丢是禁止的)。
 */
const managedClients = new Map<string, ManagedMcpClient>();

/**
 * 注册表容量上限。**注释与代码同值只此一源** —— 改数值改这一行,
 * 不要在任何地方(含本文件注释、文档)另抄一个"上限 N"。
 */
const MANAGED_CLIENTS_MAX = 32;

/** dead 条目的宽限期:标死后至少留这么久才回收,给 reconnect() 留窗口 */
const MANAGED_CLIENTS_DEAD_GRACE_MS = 60_000;

/** 累计回收条数(进程内单调递增;`clearManagedClients()` 刻意不重置它) */
let managedClientsReclaimed = 0;

/**
 * 一条注册项是否"已终结且超龄"。**dead 是必要条件**,活跃条目一律放过。
 * 用 `lastPingAt` 作时间戳是本类可用的最新信号:标死后 `ping()` 不再刷新它
 * (`isAlive()` 同一信号的另一半),所以"dead + lastPingAt 超龄"就是"终结且过了宽限期"。
 */
function isAgedDeadClient(client: ManagedMcpClient, now: number): boolean {
  const status = client.getStatus();
  if (!status.dead) return false;
  return now - status.lastPingAt >= MANAGED_CLIENTS_DEAD_GRACE_MS;
}

/**
 * 把注册表收敛到 `MANAGED_CLIENTS_MAX` 以内,返回本次回收条数。
 * 两档判据:① dead 且超宽限期 → 无条件回收;② 仍超容量时,在 **dead 条目**里按
 * `lastPingAt` 最旧优先补收(不等宽限期)。② 刻意只碰 dead 条目。
 */
export function reclaimManagedClients(now: number = Date.now()): number {
  let reclaimed = 0;
  for (const [serverName, client] of managedClients) {
    if (isAgedDeadClient(client, now)) {
      managedClients.delete(serverName);
      reclaimed += 1;
    }
  }
  if (managedClients.size > MANAGED_CLIENTS_MAX) {
    const deadByOldest = Array.from(managedClients)
      .filter(([, client]) => client.getStatus().dead)
      .sort((a, b) => a[1].getStatus().lastPingAt - b[1].getStatus().lastPingAt);
    for (const [serverName] of deadByOldest) {
      if (managedClients.size <= MANAGED_CLIENTS_MAX) break;
      managedClients.delete(serverName);
      reclaimed += 1;
    }
  }
  if (reclaimed > 0) {
    managedClientsReclaimed += reclaimed;
    console.warn(`[mcp] 注册表回收 ${reclaimed} 条已终结会话(在用 ${managedClients.size}/上限 ${MANAGED_CLIENTS_MAX})`);
  }
  return reclaimed;
}

/** 注册表读数:在用/上限/累计回收/是否仍超容量。判"有没有被静默削"只看这里。 */
export function getManagedClientRegistryStats(): {
  size: number;
  max: number;
  reclaimedTotal: number;
  overLimit: boolean;
} {
  const size = managedClients.size;
  return {
    size,
    max: MANAGED_CLIENTS_MAX,
    reclaimedTotal: managedClientsReclaimed,
    overLimit: size > MANAGED_CLIENTS_MAX,
  };
}

/** 注册 ManagedMcpClient(按 server.name 索引);注册即触发一次容量收敛 */
export function registerManagedClient(client: ManagedMcpClient): void {
  managedClients.set(client.getStatus().serverName, client);
  reclaimManagedClients();
}

/** 注销 ManagedMcpClient */
export function unregisterManagedClient(serverName: string): void {
  managedClients.delete(serverName);
}

/** 获取单个 ManagedMcpClient(不存在返回 undefined) */
export function getManagedClient(serverName: string): ManagedMcpClient | undefined {
  return managedClients.get(serverName);
}

/** 列出所有 ManagedMcpClient 状态快照 */
export function listManagedClients(): Array<ReturnType<ManagedMcpClient['getStatus']>> {
  return Array.from(managedClients.values()).map((c) => c.getStatus());
}

/** 清空所有 ManagedMcpClient(测试用) */
export function clearManagedClients(): void {
  managedClients.clear();
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
