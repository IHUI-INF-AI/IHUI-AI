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
import { assertSafeFetchUrl, formatSsrfRejection, type SelfHostedTrust } from '@ihui/shared/utils/ssrf-guard';
// G-689:脱敏走共享层的**唯一出口**(票面点名)。不另写一套正则 ——
// 对端 stderr 是任意内容,原样拼进 error.message 就等于把它泄进日志/上报链路。
import { sanitizeEvidenceText } from '@ihui/shared/utils/redact';
import { getMcpConfigPath, type McpServer } from '../commands/mcp-config.js';
// G-690:进程树回收的**制造者**已经存在于 util/spawn-isolated.ts(机制 + export 都在那里,
// 且它的注释就点名了"调用端配合条件:detached 只在 Unix 侧有意义")。
// 这里只做**装车**:不另抄一份 taskkill/kill(-pid) 逻辑 —— 两处算同一件事必漂移。
import { killProcessTree } from '../util/spawn-isolated.js';
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

/**
 * MCP stdio 子进程 stderr 尾缓冲上限(**字节**)—— 对齐上游 `MCP_STDIO_STDERR_LOG_MAX_CHARS`
 * (adapters/src/mcp/index.ts:97)的量级,不比它大。上游按字符切,这里按字节切,
 * 免得一个多字节字符被腰斩成 U+FFFD 混进诊断文本。
 */
const MCP_STDIO_STDERR_TAIL_MAX_BYTES = 4_000;

/**
 * 尾缓冲的一次读数。四个字段**全是真实量值**,没有一个是恒真:
 * `truncated` 由 `bytesRead > sizeBytes` 比较得出(而不是写死 true/false),
 * 所以"超长时标 (truncated)、量值可信"这条判据有牙 —— 恒真标注会被用例咬出来。
 */
export interface McpStderrTailReading {
  /** 已读到的 stderr 总字节数(**含**被上限丢掉的那部分) */
  bytesRead: number;
  /** 此刻实际保留在缓冲里的字节数 */
  sizeBytes: number;
  /** 保留的尾部文本。空串就是"对端一个字都没写",不得当成"有内容" */
  text: string;
  /** 真的截断过(= bytesRead > sizeBytes) */
  truncated: boolean;
}

export interface McpStderrTailBuffer {
  append(chunk: Buffer | string): void;
  read(): McpStderrTailReading;
}

/**
 * 有界尾缓冲:超上限丢头留尾,并如实记账"读了多少 / 留了多少 / 有没有丢"。
 *
 * 尾块按 Buffer 存,只在 `read()` 时解码 —— 从不腰斩多字节字符。
 */
function createStderrTailBuffer(maxBytes: number): McpStderrTailBuffer {
  const chunks: Buffer[] = [];
  let sizeBytes = 0;
  let bytesRead = 0;
  return {
    append(chunk: Buffer | string): void {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
      if (!buf || buf.length === 0) return;
      bytesRead += buf.length;
      chunks.push(buf);
      sizeBytes += buf.length;
      // 丢头留尾:从头砍,砍到不超上限为止(单块就超限时只留它的尾部)
      while (sizeBytes > maxBytes && chunks.length > 0) {
        const excess = sizeBytes - maxBytes;
        const head = chunks[0]!;
        if (head.length <= excess) {
          chunks.shift();
          sizeBytes -= head.length;
        } else {
          chunks[0] = head.subarray(excess);
          sizeBytes -= excess;
        }
      }
    },
    read(): McpStderrTailReading {
      return {
        bytesRead,
        sizeBytes,
        text: Buffer.concat(chunks).toString('utf8'),
        truncated: bytesRead > sizeBytes,
      };
    },
  };
}

interface StdioDiagnostics {
  tail: McpStderrTailBuffer;
  /** 子进程已退出时的退出码/信号(未退出为 null) */
  exit: { code: number | null; signal: NodeJS.Signals | null } | null;
  /** 异步 spawn 失败(ENOENT 等);未发生为 null */
  spawnError: NodeJS.ErrnoException | null;
  /** 在途 sendStdioRpc 的失败通知(每请求一份,结算即摘 —— 不留悬挂闭包) */
  waiters: Set<(reason: Error) => void>;
  /** 成对摘线(断连时把本文件挂上去的三个监听器一次摘干净) */
  detach: () => void;
}

const stdioDiagnostics = new WeakMap<ChildProcess, StdioDiagnostics>();

/**
 * G-691/G-694:**收到过对端应答帧**这件事必须能从错误对象上读出来。
 *
 * 为什么需要这个标记:一次 `tools/call` 失败有两种完全相反的性质 ——
 * ① 对端回了一帧 `error`(如 `method-not-found`)=**对端健在**,只是不认这条方法;
 *② 传输层失败(超时 / 管道断 / 子进程退出)= 对端可能已经死了。
 * 两者都表现为"抛 Error",上层若一律当传输失败处理,就会在**每个业务性失败**上
 * 重启 MCP 子进程,把进程内状态(会话、订阅、缓存)全部丢掉。
 *
 * 载体选**不可枚举属性** `mcpPeerAnswered`(G-691 判据:读侧按属性读数,不做
 * instanceof / 文案匹配):不可枚举 ⇒ 不漏进 JSON 序列化与用户可见输出;
 * 按属性读 ⇒ 该标记与对象同生共死,跨 re-throw / 结构化克隆边界后仍可对账
 * (WeakSet 在克隆边界后读不出,会把"对端健在"误判成传输失败)。
 * 读不存在的属性天然是 `undefined` ⇒ "未知",而不是猜一个默认值。
 */

/** 给错误打上"对端已应答"标记,返回同一个对象(便于在构造处内联)。 */
export function markPeerAnswered(error: Error): Error {
  Object.defineProperty(error, 'mcpPeerAnswered', {
    value: true,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return error;
}

/**
 * 这个错误是否意味着"对端已应答"。
 *
 * 按属性读数(G-691):裸 Error / 非对象 / 字符串一律 `false`(fail-closed):
 * 读成 `true` 会让上层在真传输失败上反而**不**重启子进程,把坏连接留在原地。
 */
export function readMcpPeerAnswered(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { mcpPeerAnswered?: unknown }).mcpPeerAnswered === true
  );
}

/**
 * 读某个 stdio 子进程当前挂着的尾缓冲读数(测试与诊断用;没挂过则 undefined)。
 *
 * 暴露读数而不是只把文本拼进消息 —— 否则"截断标注是不是恒真""空缓冲是不是被当成
 * 有内容"这两条判据就只能靠字符串猜,没有可对账的量值出口。
 */
export function readMcpStderrTail(proc: ChildProcess | undefined): McpStderrTailReading | undefined {
  if (!proc) return undefined;
  return stdioDiagnostics.get(proc)?.tail.read();
}

/**
 * G-689:给 stdio 子进程挂上 stderr 尾缓冲 + `error`/`exit` 监听(**幂等**)。
 *
 * 改前这条链是:一个空回调把 stderr 整块丢弃(该行至今仍被本票的验收 grep 记为基线),
 * 且全文件**零** `error`/`exit` 监听器 ⇒ ENOENT 走**异步** `error` 事件而无人接,
 * 只能等满 `initialize` 的 10s 计时器,报成"MCP 请求超时: initialize" —— 真凶(命令不存在?
 * 启动即崩? 端口不通?)一个字都留不下。现在三件事都有落点:尾缓冲留证据、error 立刻定性、
 * exit 把退出码记进诊断。
 */
function ensureStdioDiagnostics(proc: ChildProcess): StdioDiagnostics {
  const existing = stdioDiagnostics.get(proc);
  if (existing) return existing;

  const diag: StdioDiagnostics = {
    tail: createStderrTailBuffer(MCP_STDIO_STDERR_TAIL_MAX_BYTES),
    exit: null,
    spawnError: null,
    waiters: new Set(),
    detach: () => {},
  };

  const onStderrData = (chunk: Buffer): void => {
    diag.tail.append(chunk);
  };
  const onError = (err: NodeJS.ErrnoException): void => {
    diag.spawnError = err;
    const reason = new Error(
      `MCP stdio 子进程启动失败: ${err.message}${formatStdioDiagnostics(proc)}`,
    );
    for (const waiter of [...diag.waiters]) waiter(reason);
  };
  const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
    diag.exit = { code, signal };
    const reason = new Error(`MCP stdio 子进程已退出${formatStdioDiagnostics(proc)}`);
    for (const waiter of [...diag.waiters]) waiter(reason);
  };

  proc.stderr?.on('data', onStderrData);
  proc.on('error', onError);
  proc.on('exit', onExit);
  diag.detach = (): void => {
    proc.stderr?.off('data', onStderrData);
    proc.off('error', onError);
    proc.off('exit', onExit);
    diag.waiters.clear();
  };

  stdioDiagnostics.set(proc, diag);
  return diag;
}

/**
 * 把尾缓冲读数渲染成错误消息里的一段诊断。
 *
 * 脱敏**只走共享唯一出口** `sanitizeEvidenceText`(packages/shared/src/utils/redact.ts):
 * 对端可以在 stderr 里写任意内容,不脱敏就等于把它抄进 error.message 再泄进日志/上报。
 * 本文件不建第二套正则(票面点名 + AGENTS 的"两处算同一件事必漂移")。
 */
function formatStderrTail(reading: McpStderrTailReading): string {
  // 空缓冲显式写 <空> —— 反例锁:不得让"没有内容"看起来像"有内容"
  const body = reading.text ? sanitizeEvidenceText(reading.text) : '<空>';
  const mark = reading.truncated ? ', truncated' : '';
  return `stderr 尾=${body} (bytesRead=${reading.bytesRead} sizeBytes=${reading.sizeBytes}${mark})`;
}

/** 诊断尾巴(尾缓冲 + 退出码 + spawn 失败原因);没挂过诊断的进程返回空串 */
function formatStdioDiagnostics(proc: ChildProcess): string {
  const diag = stdioDiagnostics.get(proc);
  if (!diag) return '';
  const parts = [formatStderrTail(diag.tail.read())];
  if (diag.exit) {
    parts.push(`子进程已退出(退出码=${diag.exit.code ?? 'null'},信号=${diag.exit.signal ?? 'null'})`);
  }
  if (diag.spawnError) {
    parts.push(`spawn 失败(${diag.spawnError.code ?? 'UNKNOWN'}: ${diag.spawnError.message})`);
  }
  return ` | ${parts.join(' | ')}`;
}

/**
 * G-694(第二形态,单常驻分派器):每个 stdio 子进程的 `stdout` 上**恒只有一个**
 * `data` 监听器(分派器),所有在途 RPC 以 pending 表项的形式挂在它身上。
 *
 * 病灶有两代:最初 `stdout.off('data', onData)` 只挂在"收到匹配 id"那一支,每超时一次
 * 永久留下一个监听器;第一版修复改成"每请求挂、任何终态都摘",泄漏是止住了,但形态
 * 仍是"每请求一个监听器" —— 判据(mcp-runtime.test.ts)要的是**分派器**形状:
 * 连接建立后、以及任意次超时后,`listenerCount('data')` 都必须恒等于 1。
 * 分派器形状还有两个正收益:每条 stdout 帧只做一次 `split` + `JSON.parse`(不再替
 * 死监听器白跑);服务器主动推送(notification / 服务端请求)有了常驻的落点。
 *
 * 请求级的成对清理不变:无论从哪条路终结(成功 / 协议错误帧 / 子进程异步失败 / 超时 /
 * 写失败),都必须摘掉 pending 表项、摘掉诊断等待者、停掉计时器 —— 收敛成
 * **唯一终态出口 `settle()`**,`settled` 闩保证只生效一次,并防住
 * "应答帧与超时撞车"的竞态。摘除分派器本身只发生在 `disconnectMcpServer`(成对)。
 */

/** 在途 RPC 的表项:应答帧按帧语义结算;断连等强制了结走 fail。 */
interface StdioPendingEntry {
  onFrame: (frame: { error?: { message?: string }; result?: unknown }) => void;
  fail: (error: Error) => void;
}

/** 每个 stdio 子进程一份;`stdout` 上的唯一 `data` 监听器按 id 分派给 pending 表项。 */
interface StdioDispatcher {
  pending: Map<number, StdioPendingEntry>;
  detach: () => void;
}

const stdioDispatchers = new WeakMap<ChildProcess, StdioDispatcher>();

/** 惰性挂载该子进程的 stdout 分派器(幂等):首个 RPC 到来时装上,断连时摘下。 */
function ensureStdioDispatcher(proc: ChildProcess): StdioDispatcher {
  const existing = stdioDispatchers.get(proc);
  if (existing) return existing;

  const pending = new Map<number, StdioPendingEntry>();
  function onData(data: Buffer): void {
    const text = data.toString();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let parsed: { id?: number; error?: { message?: string }; result?: unknown };
      try {
        parsed = JSON.parse(line) as { id?: number; error?: { message?: string }; result?: unknown };
      } catch {
        continue; // 忽略非 JSON 行
      }
      if (parsed.id === undefined) continue;
      const entry = pending.get(parsed.id);
      if (!entry) continue; // 未知 id 的帧(notification / 迟到已超时请求)不投递
      pending.delete(parsed.id);
      entry.onFrame(parsed);
    }
  }

  proc.stdout?.on('data', onData);
  const dispatcher: StdioDispatcher = {
    pending,
    detach: (): void => {
      proc.stdout?.off('data', onData);
      pending.clear();
    },
  };
  stdioDispatchers.set(proc, dispatcher);
  return dispatcher;
}

export async function sendStdioRpc(
  proc: ChildProcess,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 10_000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!proc.stdin || !proc.stdout) {
      reject(new Error('子进程 stdin/stdout 不可用'));
      return;
    }
    const id = nextId();
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';

    // G-689:错误消息必须带诊断尾(stderr 尾 / 退出码 / spawn 失败原因),
    // 否则只剩一句"请求超时",排查时无从下手。
    const withDiagnostics = (text: string): string => `${text}${formatStdioDiagnostics(proc)}`;

    // G-689:把本次在途请求挂到子进程的诊断上 —— ENOENT 这类**异步** error / 提前 exit
    // 发生时立刻以真因 reject,而不是干等满 timeoutMs 报"超时"(改前的行为)。
    const diag = ensureStdioDiagnostics(proc);
    // G-694:挂到常驻分派器(幂等),本请求只占一个 pending 表项。
    const dispatcher = ensureStdioDispatcher(proc);

    let settled = false;
    let timer: NodeJS.Timeout | undefined = undefined;

    /** 唯一终态出口:摘干净本次请求的一切(表项/等待者/计时器),只结算一次。 */
    const settle = (outcome: { ok: true; value: unknown } | { ok: false; error: Error }): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      dispatcher.pending.delete(id);
      diag.waiters.delete(onChildFailure);
      if (outcome.ok) resolve(outcome.value);
      else reject(outcome.error);
    };

    const onChildFailure = (reason: Error): void => {
      settle({ ok: false, error: reason });
    };
    diag.waiters.add(onChildFailure);

    timer = setTimeout(() => {
      settle({ ok: false, error: new Error(withDiagnostics(`MCP 请求超时: ${method} (${timeoutMs}ms)`)) });
    }, timeoutMs);

    dispatcher.pending.set(id, {
      onFrame: (frame): void => {
        if (frame.error) {
          // G-691/G-694:协议错误帧是"对端已应答、就是这条方法不被支持"⇒
          // 带 `peerAnswered` 标记(供上层判"该不该 markDead"),不是传输层失败。
          settle({
            ok: false,
            error: markPeerAnswered(
              new Error(withDiagnostics(frame.error.message || 'MCP 错误')),
            ),
          });
        } else {
          settle({ ok: true, value: frame.result });
        }
      },
      fail: (error): void => {
        settle({ ok: false, error });
      },
    });

    proc.stdin.write(msg, (err) => {
      // G-694:写失败(管道已销毁 / EPIPE)是**没有 id、也没有超时**的终态。
      // 改前它只能等满计时器才报"超时"。
      if (err) {
        settle({ ok: false, error: new Error(withDiagnostics(`MCP 请求写入失败: ${method} (${err.message})`)) });
      }
    });
  });
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
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = (await resp.json()) as { error?: { message?: string }; result?: unknown };
    if (json.error) throw new Error(json.error.message || 'MCP 错误');
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
      reject(new Error(`SSE RPC 超时: ${method}`));
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
        settle(() => reject(new Error(`SSE POST 失败: ${resp.status} ${resp.statusText}`)));
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
        // G-690:`killProcessTree` 的调用端配合条件 —— Unix 侧靠 `kill(-pid)` 打整个进程组,
        // 而进程组只在 child 自成组leader(`detached: true`)时存在;Windows 没有进程组概念,
        // 回收走 `taskkill /T`,此时 detached 只会多分配一个控制台窗口 ⇒ 两边分档。
        detached: process.platform !== 'win32',
      });
      // G-689:stderr 不再整块丢弃 —— 挂有界尾缓冲 + error/exit 监听(ENOENT 这类异步
      // 失败从此有真因可报,而不是等满 10s 计时器报"请求超时")。
      ensureStdioDiagnostics(proc);
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
                  pending.reject(new Error(msg.error.message ?? 'SSE RPC error'));
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
  if (conn.process) {
    const child = conn.process;
    try {
      // G-690:整棵进程树回收,而不是只杀直接子进程 ——
      // npx/cmd 那层壳被杀掉不等于它派生的 node 子进程也死了(壳一死,子进程被 reparent
      // 成孤儿,永留 ⇒ 端口/内存/文件句柄全泄漏)。
      killProcessTree(child);
    } catch {
      // 回收失败不阻断断连语义(下面照样清状态)
    }
    // G-692 保底补刀(收窄版):killProcessTree 对"无法认领"的进程 —— 没有 pid 的
    // 连接桩(测试 mock)/ 尚未 spawn 成功的 child —— 走 fail-closed 直接 return,
    // 连"回收被调用"都观察不到(G-692 判据靠 kill 记账断言孤儿被当场回收)。
    // 补刀只打在这一档:有 pid 的真进程永远走主路,这里碰不到它(G-690 反向锁:
    // ChildProcess.killed 只由 child.kill() 置真,断连不得走它);有退出证据
    // (exitCode/signalCode 非 null/undefined)的进程同跳过 —— 与 killProcessTree 的
    // G-998130 PID 复用防护同款,原 PID 可能已被无关进程认领,补刀无的放矢。
    const hasExitEvidence =
      (child.exitCode !== null && child.exitCode !== undefined) ||
      (child.signalCode !== null && child.signalCode !== undefined);
    if (!child.pid && !hasExitEvidence) {
      try {
        child.kill('SIGTERM');
      } catch {
        // 忽略
      }
    }
    // G-689:成对摘线 —— 断连时把本文件挂上去的 stderr/error/exit 监听器摘干净,
    // 否则子进程若仍存活(回收失败),这些闭包会一直挂在它身上。
    stdioDiagnostics.get(child)?.detach();
    // G-694:stdout 常驻分派器同样成对摘除;在途 stdio 请求立刻以"连接已断开"了结,
    // 不留到各自的超时计时器空等满程。
    const dispatcher = stdioDispatchers.get(child);
    if (dispatcher) {
      for (const [, entry] of dispatcher.pending) {
        entry.fail(new Error('连接已断开'));
      }
      dispatcher.detach();
    }
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
/**
 * G-691:把一次 `tools/call` 的**结果**翻译成本仓 `ToolResult`。
 *
 * **为什么抽成纯函数**:改前这段判定内联在 `mcpToolToTool(...).execute()` 里,
 * 要测它就得把整条 `callMcpServer` 依赖链mock 一遍 —— 而 ESM 的具名导出
 * **`vi.spyOn` 根本拦不住**(实测:spy 不生效,用例读到的是真调用报的
 * "stdio 连接未建立")⇒ 那一格只能靠"跑真子进程"或"改实现结构"才测得到。
 * 抽出来之后,这条判据本身可被直接对账,且与"怎么发请求"彻底解耦。
 *
 * 判据本体(**只读 `isError`,不猜**):
 * - `isError === true` ⇒ 失败。**优先于"有没有文本"** ——
 *   远端常把错误信息放在 `content` 里回传,那时文本非空但**它是错误正文**,
 *   读成成功等于把错误提示当正常结果交给模型。
 * - 其余按改前形态:`content` 缺失 ⇒ `(无输出)`;无文本 ⇒ `(无文本输出)`。
 */
/**
 * G-691 判据本体:`tools/call` 结果 → `{ ok, output, error? }` 的解读出口。
 *
 * 独立成单参纯函数的理由:判据对 `isError` 的读法要能被**不经任何传输/连接
 * 依赖**地直接对账(单测第一组),而带 `toolName` 的生产包装属于第二层。
 * 成功档返回形状恰好是 `{ ok, output }` 两键(error 不出现),判据测试用
 * `toEqual` 逐键钉死 —— 多余的键会让"判据偷偷多做了什么"无处遁形。
 */
export function interpretMcpToolCallResult(
  raw: unknown,
  toolName?: string,
): {
  ok: boolean;
  output: string;
  error?: string;
} {
  const result = raw as {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  } | null;

  const texts = result?.content
    ?.filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n');
  const output = texts || '(无文本输出)';

  if (result?.isError === true) {
    return {
      ok: false,
      output,
      // isError 但一行业务文本都没有 ⇒ 兜底原因点名工具,不依赖对端文案
      error:
        output === '(无文本输出)'
          ? `MCP 工具${toolName ? ` ${toolName}` : ''}返回 isError(错误正文没有文本内容)`
          : output,
    };
  }

  if (!result?.content) {
    return { ok: true, output: '(无输出)' };
  }

  return { ok: true, output };
}

/**
 * 生产包装:在判据本体之上补 `toolName` 语境与 ToolResult 形状。
 * 失败档的 `errorType` 恒为 `'mcp_tool_error'` —— 刻意**不是**
 * network/timeout/rate_limited 那三档:业务失败被自动重试等于把同一个错
 * 再打一遍服务器(G-691 判据测试钉死了这一条)。
 */
export function mcpToolResultToToolResult(
  raw: unknown,
  toolName: string,
): Pick<ToolResult, 'success' | 'output'> & { error?: string; errorType?: string } {
  const r = interpretMcpToolCallResult(raw, toolName);
  if (r.ok) {
    return { success: true, output: r.output };
  }
  return { success: false, output: r.output, error: r.error, errorType: 'mcp_tool_error' };
}

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
        // G-691:isError 的判定与出口都在纯函数里(见mcpToolResultToToolResult 的
        // 判据说明),此处只做转发 —— 两处算同一件事必漂移。
        return mcpToolResultToToolResult(raw, mcpTool.name);
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
 *     失败累计 ≥ DEAD_THRESHOLD → markDead(后续 ensureConnected 触发重连)
 *   - ping():发送 MCP ping,30s 内已 ping 过则跳过(避免高频)
 *   - reconnect():指数退避(1s → 2s → 4s → 8s → 16s → 30s 上限)
 *   - markDead():置 deadMarkedAt,清理 client,下次 ensureConnected 必重连
 *
 * G-692(在途合并 + 代次守卫):
 *   - 同一时刻至多一次重连在途(并发 ensureConnected 合并到同一次尝试);
 *   - 连接代次(generation)在每次发起连接尝试或显式 disconnect 时推进;
 *     旧代次迟到的成功(不覆盖当代 conn、当场回收)、迟到的失败(不动当代计数)
 *     一律不作数 —— 否则两个并发 callTool 各起一个子进程,先起者成永不可达的孤儿。
 *
 * 状态查询:
 *   - isAlive():alive 窗口内(30s)且未 markDead
 *   - getStatus():返回 liveness 快照(alive/dead/reconnecting + consecutiveFailures + lastPingAt)
 *   - getGeneration()/getConnection():G-692 验收出口(代次读数与连接读数)
 *
 * 构造参数 options 支持覆盖 backoff / ping 间隔 / dead 阈值(测试用,生产用默认值)。
 */
export class ManagedMcpClient {
  private conn: McpConnection | null = null;
  /** G-692:连接代次 —— 每次发起连接尝试或显式 disconnect 时推进 */
  private generation = 0;
  /**
   * G-692:this.conn 所属的代次(与 conn 在同一同步段内成对写)。
   * callTool/ping 在 await 恢复点读它判"这次调用属于哪一代" —— 直接读 this.generation
   * 会被"disconnect 在恢复点之前插队"骗过(读到的已是推进后的新代)。
   * conn 为 null 时无代次可言,置 -1。
   */
  private connGeneration = -1;
  /** G-692:在途重连;成功/失败都必须清空(finally 里身份比较,防旧代清新代的指针) */
  private connecting: Promise<void> | null = null;
  private lastPingAt = 0;
  private consecutiveFailures = 0;
  private deadMarkedAt = 0;
  private reconnectBackoffMs: number;
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

  /** 确保已连接且存活;否则触发重连 */
  async ensureConnected(): Promise<McpConnection> {
    if (this.conn && this.isAlive()) {
      return this.conn;
    }
    await this.reconnect();
    return this.conn!;
  }

  /** G-692 验收出口:当前连接代次 */
  getGeneration(): number {
    return this.generation;
  }

  /** G-692 验收出口:当前连接(可能为 null) */
  getConnection(): McpConnection | null {
    return this.conn;
  }

  /** 调用 MCP tool(经 ensureConnected);失败累计达阈值则 markDead */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const conn = await this.ensureConnected();
    // G-692:调用所属代次取 conn 的绑定代次(不是 this.generation —— 后者在
    // await 恢复点可能已被插队的 disconnect 推进,守卫会被骗过)
    const gen = this.connGeneration;
    try {
      const result = await this.callFn(conn, 'tools/call', { name, arguments: args });
      if (gen === this.generation) {
        this.consecutiveFailures = 0;
      }
      return result;
    } catch (err) {
      // G-692:已被取代的代次 —— 错误原样上抛(不静默),但不改当代计数
      if (gen !== this.generation) {
        throw err;
      }
      // G-691:只有**传输层**失败才累计到 markDead。收到过对端应答帧
      // (method-not-found / 参数不合法 / 工具业务报错)说明这条连接健在,
      // 改前照样累计 ⇒ 每个业务性失败都会把子进程重启一遍,
      // 进程内状态(会话、订阅、缓存)全部丢掉。
      // 反向也要fail-closed:标记读成 false 时才累计,读不出的一律当传输失败。
      if (!readMcpPeerAnswered(err)) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.DEAD_THRESHOLD) {
          this.markDead();
        }
      } else {
        // 对端健在 ⇒ 失败计数必须归零,否则早先攒下的传输失败会一直挂着,
        // 在下一次真传输失败时**立刻**越过阈值把好连接误杀。
        this.consecutiveFailures = 0;
      }
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
    // G-692:ping 同样携带代次 —— 旧代次迟到的失败不得判死当代新连接
    const gen = this.connGeneration;
    try {
      // MCP ping 方法无 params,无 result;成功即存活
      await this.callFn(this.conn, 'ping', {});
      if (gen === this.generation) {
        this.lastPingAt = Date.now();
      }
      return true;
    } catch {
      if (gen !== this.generation) {
        return false;
      }
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.DEAD_THRESHOLD) {
        this.markDead();
      }
      return false;
    }
  }

  /** 显式断开,清理资源(进程 kill / SSE abort) */
  async disconnect(): Promise<void> {
    // G-692:显式断开宣告当前代作废 —— 在途重连的迟到结果一律不作数
    this.generation++;
    this.connecting = null;
    if (this.conn) {
      disconnectMcpConnection(this.conn);
      this.conn = null;
    }
    this.connGeneration = -1;
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

  /** 获取当前退避值(测试用,验证指数退避) */
  getCurrentBackoffMs(): number {
    return this.reconnectBackoffMs;
  }

  /**
   * 重连:指数退避 → connectMcpServer → 重置状态。
   * 失败时继续翻倍 backoff,但不抛错(下次 ensureConnected 会再试)。
   *
   * G-692:在途合并 —— 并发调用合并到同一次尝试(同一时刻至多一个子进程在被起);
   * 成功/失败都必须清空在途指针(否则合并会变成"永不重连"的通道)。
   * 注意:此处不抛错是为了让 ManagedMcpClient 的调用方在多个 server 中
   * 一个连接失败时不影响其他 server。状态由 isAlive/getStatus 暴露。
   */
  private reconnect(): Promise<void> {
    if (this.connecting) {
      return this.connecting;
    }
    const attempt = this.doReconnect().finally(() => {
      // 身份比较:只有仍是本代在途指针时才清 —— 旧代迟到的收尾不得清掉新代的指针
      if (this.connecting === attempt) {
        this.connecting = null;
      }
    });
    this.connecting = attempt;
    return attempt;
  }

  /** G-692:真重连体(reconnect 负责在途合并,这里负责退避/清理/代次守卫) */
  private async doReconnect(): Promise<void> {
    // 等待退避(首次 1s,后续翻倍)
    await new Promise((r) => setTimeout(r, this.reconnectBackoffMs));
    this.reconnectBackoffMs = Math.min(this.reconnectBackoffMs * 2, this.MAX_BACKOFF_MS);

    // G-692:发起即推进代次 —— 上一代的一切迟到结果从此不作数
    const gen = ++this.generation;

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
      const fresh = await this.connectFn(this.server);
      if (gen !== this.generation) {
        // G-692:旧代次迟到的成功 —— 不覆盖当代 conn,且当场**整链回收**(kill + 置
        // connected=false + 拒决在途表项),不是只 kill 一刀了事;判据在两处都读数。
        try {
          disconnectMcpConnection(fresh);
        } catch {
          // 忽略
        }
        return;
      }
      this.conn = fresh;
      this.connGeneration = gen;
      this.deadMarkedAt = 0;
      this.consecutiveFailures = 0;
      this.lastPingAt = Date.now();
      // 成功后重置 backoff(下次失败从头开始)
      this.reconnectBackoffMs = this.initialBackoffMs;
    } catch {
      // G-692:旧代次迟到的失败 —— 不动当代计数(否则刚接上的新连接会被上一代判死)
      if (gen !== this.generation) {
        return;
      }
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
    this.deadMarkedAt = Date.now();
    if (this.conn) {
      try {
        disconnectMcpConnection(this.conn);
      } catch {
        // 忽略
      }
      this.conn = null;
    }
    this.connGeneration = -1;
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
