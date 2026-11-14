// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `query()` —— 以子进程方式驱动一个 ACP agent（`ihui acp`），把 NDJSON 线协议
 * 翻译成调用方可消费的事件流，并在 `session/request_permission` 上接回
 * `canUseTool` 决策。
 *
 * 生命周期口径：
 * - 正常：initialize → session/new → session/prompt → 关 stdin 收子进程；
 * - abort：发 `session/cancel`，宽限 `abortGraceMs` 后 SIGTERM，再 `killGraceMs`
 *   后 SIGKILL（agent 卡死也不能把调用方挂住）；
 * - 非零退出 / 提前退出：未完成请求由 `JsonRpcPeer.close()` 一次性 reject，
 *   `query()` 以 `AgentSdkError('AGENT_EXIT')` 抛错，错误里带退出码与 stderr 尾部。
 */

import { spawn, type ChildProcess } from 'node:child_process';
import {
  AgentSdkError,
  JsonRpcPeer,
  NdjsonDecoder,
  type ContentBlock,
  type PermissionOption,
  type SessionUpdate,
  type StopReason,
} from './protocol.js';

/** 与服务端 `PERMISSION_TIMEOUT_MS` 对齐：编辑器不回审批时按取消降级。 */
export const DEFAULT_PERMISSION_TIMEOUT_MS = 60_000;
export const DEFAULT_ABORT_GRACE_MS = 2_000;
export const DEFAULT_KILL_GRACE_MS = 1_000;
export const DEFAULT_STDERR_LIMIT = 8_192;

/**
 * 交给 `canUseTool` 的审批请求。
 *
 * `toolUseId` 是审批回写与工具卡的唯一关联键，**类型层必填** ——
 * 线协议里拿不到 `toolCallId` 时本 SDK 直接按取消处理，不会伪造一个 id。
 */
export interface ToolPermissionRequest {
  readonly toolUseId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly options: readonly PermissionOption[];
  /** 查询被取消时同步 abort，供审批实现自行收尾。 */
  readonly signal: AbortSignal;
}

export type PermissionDecision =
  | { behavior: 'allow'; optionId?: string }
  | { behavior: 'deny'; optionId?: string; message?: string };

export type CanUseTool = (request: ToolPermissionRequest) => Promise<PermissionDecision>;

export interface QueryOptions {
  /** ACP 会话工作目录（必填，服务端要求绝对路径）。 */
  cwd: string;
  /** 本轮用户提示词；字符串会包成单个 text 内容块。 */
  prompt: string | readonly ContentBlock[];
  /** 默认 `IHUI_CLI_BIN` 或 `ihui`。 */
  command?: string;
  /** 默认 `['acp']`。 */
  args?: string[];
  /** 追加/覆盖到 `process.env` 上的环境变量。 */
  env?: NodeJS.ProcessEnv;
  canUseTool?: CanUseTool;
  signal?: AbortSignal;
  permissionTimeoutMs?: number;
  abortGraceMs?: number;
  killGraceMs?: number;
  /** stderr 保留的尾部字节数（默认 8KB），同时经 `onStderr` 实时透传。 */
  stderrLimit?: number;
  onStderr?: (chunk: string) => void;
  /** 子进程创建后立即回调（测试断言生命周期用）。 */
  onSpawn?: (child: ChildProcess) => void;
}

export type AgentEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'message'; text: string }
  | { type: 'thought'; text: string }
  | { type: 'tool_call'; toolCallId: string; title: string; kind?: string; status?: string; input: unknown }
  | { type: 'tool_update'; toolCallId: string; title?: string; status?: string; output: unknown }
  | { type: 'protocol_error'; lineNumber: number; raw: string; message: string };

export interface QueryResult {
  sessionId: string | null;
  stopReason: StopReason;
  exitCode: number | null;
  stderr: string;
}

interface ExitInfo {
  code: number | null;
  signal: NodeJS.Signals | null;
}

interface IncomingPermissionParams {
  sessionId?: unknown;
  toolCall?: {
    toolCallId?: unknown;
    title?: unknown;
    rawInput?: unknown;
  };
  options?: unknown;
}

const CANCELLED_OUTCOME = { outcome: { outcome: 'cancelled' as const } };

function isPermissionOption(value: unknown): value is PermissionOption {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.optionId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.kind === 'string'
  );
}

function textOf(content: ContentBlock | undefined): string | null {
  return content && content.type === 'text' && typeof content.text === 'string' ? content.text : null;
}

function toPromptBlocks(prompt: string | readonly ContentBlock[]): ContentBlock[] {
  return typeof prompt === 'string' ? [{ type: 'text', text: prompt }] : [...prompt];
}

const STOP_REASONS: readonly string[] = [
  'end_turn',
  'max_tokens',
  'max_turn_requests',
  'refusal',
  'cancelled',
];

function normalizeStopReason(reason: unknown): StopReason {
  if (typeof reason === 'string' && STOP_REASONS.includes(reason)) return reason as StopReason;
  throw new AgentSdkError('PROTOCOL', `session/prompt 返回了非法的 stopReason: ${String(reason)}`);
}

/** allow 优先精确点名，其次 allow_once/allow_always；deny 对称。 */
function pickOption(
  options: readonly PermissionOption[],
  decision: PermissionDecision,
): PermissionOption | null {
  if (decision.optionId) {
    const nominated = options.find((option) => option.optionId === decision.optionId);
    if (nominated) return nominated;
  }
  const wanted =
    decision.behavior === 'allow'
      ? (['allow_once', 'allow_always'] as const)
      : (['reject_once', 'reject_always'] as const);
  for (const kind of wanted) {
    const hit = options.find((option) => option.kind === kind);
    if (hit) return hit;
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  if (ms <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * 启动并驱动一个 ACP agent。事件通过异步迭代产出，最终返回值是 `QueryResult`。
 *
 * ```ts
 * for await (const event of query({ cwd, prompt, canUseTool })) { ... }
 * ```
 */
export async function* query(options: QueryOptions): AsyncGenerator<AgentEvent, QueryResult> {
  const command = options.command ?? process.env.IHUI_CLI_BIN ?? 'ihui';
  const args = options.args ?? ['acp'];
  const abortGraceMs = options.abortGraceMs ?? DEFAULT_ABORT_GRACE_MS;
  const killGraceMs = options.killGraceMs ?? DEFAULT_KILL_GRACE_MS;
  const permissionTimeoutMs = options.permissionTimeoutMs ?? DEFAULT_PERMISSION_TIMEOUT_MS;
  const stderrLimit = options.stderrLimit ?? DEFAULT_STDERR_LIMIT;

  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  options.onSpawn?.(child);

  const stdin = child.stdin;
  const stdout = child.stdout;
  const stderrStream = child.stderr;
  if (!stdin || !stdout || !stderrStream) {
    child.kill('SIGKILL');
    throw new AgentSdkError('SPAWN', 'ACP 子进程 stdio 未按 pipe 建立');
  }

  const events: AgentEvent[] = [];
  let wake: (() => void) | null = null;
  let failure: unknown = null;
  let result: QueryResult | null = null;
  let sessionId: string | null = null;
  let stopReason: StopReason | null = null;
  let exitInfo: ExitInfo | null = null;
  let shuttingDown = false;
  let aborted = false;
  let stderrBuffer = '';

  const signalChange = (): void => {
    const resolve = wake;
    wake = null;
    resolve?.();
  };
  const waitForChange = (): Promise<void> =>
    new Promise((resolve) => {
      wake = resolve;
    });
  const pushEvent = (event: AgentEvent): void => {
    events.push(event);
    signalChange();
  };
  const fail = (error: unknown): void => {
    if (!failure) failure = error;
    signalChange();
  };

  const decoder = new NdjsonDecoder();
  const peer = new JsonRpcPeer({
    sendLine: (line) => {
      if (stdin.destroyed || stdin.writableEnded) return;
      try {
        stdin.write(line);
      } catch {
        // 子进程已退出：由 exit/close 事件统一结算，不在写入侧抛错。
      }
    },
  });
  stdin.on('error', () => {
    // 子进程提前关闭 stdin：由 exit/close 事件统一结算。
  });

  stdout.setEncoding('utf8');
  stdout.on('data', (chunk: string) => {
    for (const decoded of decoder.push(chunk)) {
      if (decoded.kind === 'error') {
        pushEvent({
          type: 'protocol_error',
          lineNumber: decoded.lineNumber,
          raw: decoded.raw,
          message: decoded.message,
        });
        continue;
      }
      peer.handleMessage(decoded.message);
    }
  });

  stderrStream.setEncoding('utf8');
  stderrStream.on('data', (chunk: string) => {
    stderrBuffer = (stderrBuffer + chunk).slice(-stderrLimit);
    options.onStderr?.(chunk);
  });

  const exitPromise = new Promise<void>((resolve) => {
    child.once('exit', (code, signal) => {
      exitInfo = { code, signal };
      resolve();
      signalChange();
    });
  });

  const waitExit = async (ms: number): Promise<boolean> => {
    if (child.exitCode !== null || child.signalCode !== null) return true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), ms);
      timer.unref?.();
    });
    const exited = await Promise.race([exitPromise.then(() => true), timeout]);
    if (timer) clearTimeout(timer);
    return exited;
  };

  const hardKill = async (): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      child.kill('SIGTERM');
    } catch {
      // 已退出
    }
    if (await waitExit(killGraceMs)) return;
    try {
      child.kill('SIGKILL');
    } catch {
      // 已退出
    }
    await waitExit(killGraceMs);
  };

  const shutdownChild = async (): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      stdin.end();
    } catch {
      // stdin 已关闭
    }
    if (await waitExit(killGraceMs)) return;
    await hardKill();
  };

  peer.onNotification('session/update', (params) => {
    const update = (params as { update?: SessionUpdate } | undefined)?.update;
    if (!update || typeof update.sessionUpdate !== 'string') return;
    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        const text = textOf(update.content);
        if (text !== null) pushEvent({ type: 'message', text });
        break;
      }
      case 'agent_thought_chunk': {
        const text = textOf(update.content);
        if (text !== null) pushEvent({ type: 'thought', text });
        break;
      }
      case 'tool_call': {
        if (typeof update.toolCallId !== 'string' || update.toolCallId === '') return;
        pushEvent({
          type: 'tool_call',
          toolCallId: update.toolCallId,
          title: typeof update.title === 'string' ? update.title : update.toolCallId,
          kind: typeof update.kind === 'string' ? update.kind : undefined,
          status: typeof update.status === 'string' ? update.status : undefined,
          input: update.rawInput,
        });
        break;
      }
      case 'tool_call_update': {
        if (typeof update.toolCallId !== 'string' || update.toolCallId === '') return;
        pushEvent({
          type: 'tool_update',
          toolCallId: update.toolCallId,
          title: typeof update.title === 'string' ? update.title : undefined,
          status: typeof update.status === 'string' ? update.status : undefined,
          output: update.rawOutput ?? update.content,
        });
        break;
      }
      default:
        break;
    }
  });

  peer.onRequest('session/request_permission', async (params) => {
    const request = params as IncomingPermissionParams | undefined;
    const toolCall = request?.toolCall;
    const toolUseId = typeof toolCall?.toolCallId === 'string' ? toolCall.toolCallId : '';
    const offered = Array.isArray(request?.options)
      ? request.options.filter(isPermissionOption)
      : [];
    // toolUseId 缺失或没有审批实现：安全默认=取消（与 ACP 服务端的降级口径一致）。
    if (!toolUseId || !options.canUseTool) return CANCELLED_OUTCOME;

    const controller = new AbortController();
    const onParentAbort = (): void => controller.abort();
    options.signal?.addEventListener('abort', onParentAbort, { once: true });
    try {
      const decision = await withTimeout(
        options.canUseTool({
          toolUseId,
          toolName:
            typeof toolCall?.title === 'string' && toolCall.title !== '' ? toolCall.title : toolUseId,
          input: toolCall?.rawInput,
          options: offered,
          signal: controller.signal,
        }),
        permissionTimeoutMs,
      );
      if (!decision) return CANCELLED_OUTCOME;
      const picked = pickOption(offered, decision);
      if (!picked) return CANCELLED_OUTCOME;
      return { outcome: { outcome: 'selected', optionId: picked.optionId } };
    } catch {
      return CANCELLED_OUTCOME;
    } finally {
      options.signal?.removeEventListener('abort', onParentAbort);
    }
  });

  const onAbort = (): void => {
    if (aborted || result) return;
    aborted = true;
    if (sessionId) {
      try {
        peer.notify('session/cancel', { sessionId });
      } catch {
        // 子进程已退出
      }
    }
    const timer = setTimeout(() => {
      void hardKill();
    }, abortGraceMs);
    timer.unref?.();
    signalChange();
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });
  if (options.signal?.aborted) onAbort();

  child.once('error', (error) => {
    fail(new AgentSdkError('SPAWN', `无法启动 ACP agent（${command}）: ${error.message}`, { cause: error }));
    peer.close('ACP agent spawn failed');
  });

  child.once('close', (code, signal) => {
    exitInfo ??= { code, signal };
    for (const decoded of decoder.flush()) {
      if (decoded.kind === 'error') {
        pushEvent({
          type: 'protocol_error',
          lineNumber: decoded.lineNumber,
          raw: decoded.raw,
          message: decoded.message,
        });
        continue;
      }
      peer.handleMessage(decoded.message);
    }
    if (!shuttingDown && !result && !aborted) {
      fail(
        new AgentSdkError(
          'AGENT_EXIT',
          `ACP agent 在回合结束前退出（code ${String(code)}, signal ${String(signal)}）`,
          { exitCode: code, stderr: stderrBuffer },
        ),
      );
    }
    peer.close(`ACP agent exited (code ${String(code)}, signal ${String(signal)})`);
    signalChange();
  });

  const run = async (): Promise<void> => {
    let runError: unknown = null;
    try {
      if (!aborted) {
        await peer.request('initialize', { protocolVersion: 1, clientCapabilities: {} });
        const newSession = await peer.request<{ sessionId?: unknown }>('session/new', {
          cwd: options.cwd,
          mcpServers: [],
        });
        const id = newSession?.sessionId;
        if (typeof id !== 'string' || id === '') {
          throw new AgentSdkError('PROTOCOL', 'session/new 未返回合法 sessionId');
        }
        sessionId = id;
        pushEvent({ type: 'session', sessionId: id });

        const promptResponse = await peer.request<{ stopReason?: unknown }>('session/prompt', {
          sessionId: id,
          prompt: toPromptBlocks(options.prompt),
        });
        stopReason = normalizeStopReason(promptResponse?.stopReason);
      }
    } catch (error) {
      runError = error;
    }

    shuttingDown = true;
    await shutdownChild();

    if (runError && !aborted) {
      fail(
        runError instanceof AgentSdkError
          ? runError
          : new AgentSdkError('PROTOCOL', runError instanceof Error ? runError.message : String(runError), {
              cause: runError,
              exitCode: exitInfo?.code ?? child.exitCode,
              stderr: stderrBuffer,
            }),
      );
      return;
    }

    result = {
      sessionId,
      stopReason: stopReason ?? (aborted ? 'cancelled' : 'end_turn'),
      exitCode: exitInfo?.code ?? child.exitCode,
      stderr: stderrBuffer,
    };
    signalChange();
  };

  try {
    void run();
    for (;;) {
      const event = events.shift();
      if (event) {
        yield event;
        continue;
      }
      if (failure) throw failure;
      if (result) return result;
      await waitForChange();
    }
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    if (!result) {
      shuttingDown = true;
      peer.close('query() disposed');
      await shutdownChild();
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
