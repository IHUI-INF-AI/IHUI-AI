// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 云会话写入客户端 — 把 CLI 侧 agent 运行记录写入 ai-service 云会话存储(/api/cloud-runs)。
 *
 * P0-7 补全端闭环:CLI 运行 agent 时通过 HTTP 调 ai-service 写入口,让运行记录能在
 * /cloud-agent 页面被看到与恢复(此前仅 web HTTP streaming 路径落盘)。
 *
 * 设计要点:
 *   - 地址:环境变量 AI_SERVICE_URL 优先,默认 http://localhost:8803(ai-service 端口)。
 *   - 鉴权:复用 ai-service 的 JWT(get_current_user_id),CLI 携带 settings 里的登录 token
 *     (Authorization: Bearer)。未登录 / token 无效时写失败。
 *   - 降级**可见**(2026-09-26 改,原为"任何失败静默 return null"):失败仍不抛出、
 *     不影响 agent 主流程退出码,但每次失败必须计入台账并固化结构化原因
 *     (getCloudRunDegradeFacts),首次立即向 stderr 喊话,连续失败按节流窗口复读并报累计数。
 *     旧形态把"没人用"与"一直在写失败"压成同一表现 —— 失败必须响,静默降级等于伪造完整性。
 *   - 超时:4s,避免阻塞长任务收尾。
 */

import { randomUUID } from 'node:crypto';

// 原因码词表复用 inflight-ledger 的封闭集作为基底(它是本仓"失败固化成可归因事实"的既有出口)。
// 两条刻意的边界:
//  ① **不**扩 LEDGER_FAILURE_CODES 本身 —— token-manager 的 Record<LedgerFailureCode,…>
//    与 token-refresh-failure-surface.test.ts 对四档的逐字断言都钉在旧集合上,扩一档越出本票边界;
//    'server'(服务端拒绝)是本写入面的补档:台账刻意不猜成因(toLedgerFailure 一律标 network),
//    把 HTTP 状态翻译成原因码本就是调用方的分类职责。
//  ② **不**复用 InflightLedger.run() —— 云写入每次都是新 runId,把某一次的失败固化 30s
//    会让下一次本该真实发起的尝试被旧答案吞掉,等于用去重表再造一层静默。
import { LEDGER_FAILURE_CODES } from './util/inflight-ledger.js';

export interface CloudRunStartInput {
  task: string;
  agentType?: string;
  sessionAlias?: string;
  /** CLI 登录 JWT(settings.json apiKey / --api-key)。为空则无法写云会话。 */
  apiKey?: string;
  /** 外部取消信号:取消与超时**不得同码**(cancelled / timeout 分档)。 */
  signal?: AbortSignal;
}

export interface CloudRunCompleteInput {
  runId: string;
  status: 'done' | 'error';
  output?: string;
  error?: string;
  /** CLI 登录 JWT(settings.json apiKey / --api-key)。为空则无法写云会话。 */
  apiKey?: string;
  /** 外部取消信号:取消与超时**不得同码**。 */
  signal?: AbortSignal;
}

/** 云写入失败原因码 = 台账封闭集四档 + 'server'(非 401/403 的服务端拒绝)。 */
export const CLOUD_RUN_FAILURE_CODES = [...LEDGER_FAILURE_CODES, 'server'] as const;

export type CloudRunFailureCode = (typeof CLOUD_RUN_FAILURE_CODES)[number];

/** 一条结构化的失败事实。message 恒为 ASCII 诊断文本(不落新的中文文案,见测试词表锁)。 */
export interface CloudRunFailure {
  readonly code: CloudRunFailureCode;
  readonly message: string;
  readonly atMs: number;
}

export interface CloudRunDegradeOpFacts {
  /** 该操作累计的降级次数 —— "没人用"与"一直在写失败"从此不长得一样 */
  failures: number;
  lastFailure: CloudRunFailure | null;
}

const TIMEOUT_MS = 4000;
/** 连续失败复读喊话的最小间隔:首次立即,之后每个窗口至多一次(带累计数),不刷屏。 */
const DEGRADE_NOTICE_THROTTLE_MS = 60_000;

type CloudRunOp = 'start' | 'complete';

const degradeFacts: Record<
  CloudRunOp,
  { failures: number; lastFailure: CloudRunFailure | null; lastNoticeAtMs: number }
> = {
  start: { failures: 0, lastFailure: null, lastNoticeAtMs: 0 },
  complete: { failures: 0, lastFailure: null, lastNoticeAtMs: 0 },
};

/**
 * 降级留痕的唯一落点:计数 + 固化原因 + 首次/节流后的可见喊话。
 * 返回给调用方的仍是旧的 string | null / boolean 契约(不砸主流程,也不动 index.ts
 * 在飞的调用点),成因从 getCloudRunDegradeFacts() 查。
 */
function recordDegrade(op: CloudRunOp, code: CloudRunFailureCode, message: string): void {
  const s = degradeFacts[op];
  s.failures += 1;
  const now = Date.now();
  s.lastFailure = { code, message, atMs: now };
  if (s.failures === 1 || now - s.lastNoticeAtMs >= DEGRADE_NOTICE_THROTTLE_MS) {
    s.lastNoticeAtMs = now;
    console.warn(
      `[cloud-run] ${op} write degraded (main flow unaffected): failures=${s.failures} code=${code} ${message}`,
    );
  }
}

/** 查询降级事实(遥测/诊断出口)。返回副本,外部改不动内部计数。 */
export function getCloudRunDegradeFacts(): Record<CloudRunOp, CloudRunDegradeOpFacts> {
  return {
    start: {
      failures: degradeFacts.start.failures,
      lastFailure: degradeFacts.start.lastFailure,
    },
    complete: {
      failures: degradeFacts.complete.failures,
      lastFailure: degradeFacts.complete.lastFailure,
    },
  };
}

/** 清零计数(仅供测试用例之间隔离;生产路径不调用)。 */
export function resetCloudRunDegradeFacts(): void {
  degradeFacts.start = { failures: 0, lastFailure: null, lastNoticeAtMs: 0 };
  degradeFacts.complete = { failures: 0, lastFailure: null, lastNoticeAtMs: 0 };
}

/** 解析 ai-service 基地址(环境变量 AI_SERVICE_URL 优先,默认 8803)。 */
export function resolveCloudRunBase(): string {
  return (process.env.AI_SERVICE_URL || 'http://localhost:8803').replace(/\/+$/, '');
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

type SendResult = { ok: true } | { ok: false; code: CloudRunFailureCode; message: string };

/**
 * 带超时的 fetch。绝不抛出(降级语义保留),但失败不再折叠成一个 false ——
 * 按 timeout / cancelled / auth / server / network 分档返回结构化原因。
 * 超时与取消不得同码:内部定时器先触发记 timeout,外部 signal 记 cancelled。
 */
async function send(
  method: 'POST' | 'PATCH',
  url: string,
  body: unknown,
  timeoutMs: number,
  apiKey?: string,
  signal?: AbortSignal,
): Promise<SendResult> {
  if (signal?.aborted) {
    return { ok: false, code: 'cancelled', message: 'aborted before request' };
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    // 401/403 = 登录态问题(处置=重新登录),其余非 2xx = 服务端拒绝(处置=查服务)——两档动作不同
    const code: CloudRunFailureCode = res.status === 401 || res.status === 403 ? 'auth' : 'server';
    return { ok: false, code, message: `HTTP ${res.status}` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (timedOut) return { ok: false, code: 'timeout', message: `timeout after ${timeoutMs}ms: ${detail}` };
    if (signal?.aborted) return { ok: false, code: 'cancelled', message: `cancelled: ${detail}` };
    return { ok: false, code: 'network', message: detail };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 启动一次云运行记录(状态 running)。成功返回生成的 run_id;失败仍返回 null
 * (对外契约不变、绝不抛出),但成因已计入 getCloudRunDegradeFacts() 并按首次/节流喊话。
 */
export async function startCloudRun(input: CloudRunStartInput): Promise<string | null> {
  const runId = randomUUID().replace(/-/g, '');
  const result = await send(
    'POST',
    `${resolveCloudRunBase()}/api/cloud-runs/run`,
    {
      run_id: runId,
      task: (input.task || '').slice(0, 2000),
      agent_type: input.agentType || 'loop_v2',
      session_alias: input.sessionAlias || runId,
    },
    TIMEOUT_MS,
    input.apiKey,
    input.signal,
  );
  if (result.ok) return runId;
  recordDegrade('start', result.code, result.message);
  return null;
}

/**
 * 结束一次云运行记录(状态 done/error)。仍不抛出,但失败与 start 同样留痕、分档。
 */
export async function completeCloudRun(input: CloudRunCompleteInput): Promise<boolean> {
  const result = await send(
    'PATCH',
    `${resolveCloudRunBase()}/api/cloud-runs/run/${encodeURIComponent(input.runId)}`,
    {
      status: input.status === 'error' ? 'error' : 'done',
      output: input.output || '',
      error: input.error || '',
    },
    TIMEOUT_MS,
    input.apiKey,
    input.signal,
  );
  if (result.ok) return true;
  recordDegrade('complete', result.code, result.message);
  return false;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
