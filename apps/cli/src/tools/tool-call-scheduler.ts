// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 工具批次调度(W4-14 的 native 并发轴)。
 *
 * 只做一件事:把一轮模型返回的工具调用按**有上限的批次**执行,并保持输入顺序。
 * 不在这里做权限、超时、重试 —— 那些仍由 `executeToolCall` / `executeWithinExecBudget`
 * 的单点负责。`maxParallelToolCalls=1` 退化为串行;每个批次开始前重新读上限,所以
 * 运行中改环境变量从下一批生效,不追溯已在飞的批次。
 */

/** 对齐 dsh-agent-loop 的默认值:一轮最多 10 枚工具同时在飞。 */
export const DEFAULT_MAX_PARALLEL_TOOL_CALLS = 10;

/** 硬上限:批次再大也不把整轮工具一次性打出去;超过按 64 收口。 */
export const MAX_PARALLEL_TOOL_CALLS = 64;

/** 运行期覆盖入口。每批开始前读取,改值从下一批生效。 */
export const MAX_PARALLEL_TOOL_CALLS_ENV = 'IHUI_MAX_PARALLEL_TOOL_CALLS';

function clampLimit(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), MAX_PARALLEL_TOOL_CALLS);
}

/**
 * 解析并行上限。优先级:显式 override > 环境变量 > 默认 10。
 * 非法值(0 / 负数 / 小数以外的非数 / 空串)一律退回默认,不把 0 静默当 1。
 */
export function resolveMaxParallelToolCalls(
  envValue: string | undefined,
  override?: number,
): number {
  if (override !== undefined) {
    return clampLimit(override, DEFAULT_MAX_PARALLEL_TOOL_CALLS);
  }
  const trimmed = envValue?.trim();
  if (trimmed === undefined || trimmed === '') return DEFAULT_MAX_PARALLEL_TOOL_CALLS;
  const parsed = Number(trimmed);
  return clampLimit(parsed, DEFAULT_MAX_PARALLEL_TOOL_CALLS);
}

function batchLimit(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), MAX_PARALLEL_TOOL_CALLS);
}

/**
 * 按批次执行,批次内 `Promise.all`,批次间串行。结果顺序与 `calls` 一致,
 * 不按完成先后重排。任一枚 reject 时整批 reject(与旧 `Promise.all` 语义一致),
 * 后续批次不再启动。
 */
export async function executeToolCallsInBatches<T, R>(
  calls: readonly T[],
  getLimit: () => number,
  worker: (call: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < calls.length; ) {
    const limit = batchLimit(getLimit());
    const batch = calls.slice(start, start + limit);
    const batchResults = await Promise.all(batch.map((call, offset) => worker(call, start + offset)));
    results.push(...batchResults);
    start += batch.length;
  }
  return results;
}
