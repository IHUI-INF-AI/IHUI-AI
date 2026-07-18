/**
 * Inference Metrics — 推理延迟统计(P47-A)。
 *
 * 灵感来源:参考行业 LLM serving 框架的 inter-token latency 统计。
 * 简化策略(做减法):
 *   - 0 新依赖,纯 TS
 *   - 输入:推理开始时间 + 每个 token 的绝对时间戳 + 当前时间
 *   - 输出:ITL (Inter-Token Latency) 的 P50/P99/Max/Mean + chunkCount
 *   - TTFT (Time To First Token) = firstToken - start
 *   - 总耗时 = now - start
 *   - ITL = 相邻 token 之间的时间差
 *
 * 使用场景:
 *   - ttft-monitor.ts 的 end() 方法产出单次推理 stats
 *   - 流式 LLM 调用的延迟分布监控
 */

/** 推理延迟统计结果 */
export interface InferenceLatencyStats {
  /** 首 token 延迟(ms) */
  ttftMs: number
  /** 总耗时(ms) */
  totalMs: number
  /** Inter-Token Latency P50(ms) */
  itlP50Ms: number
  /** Inter-Token Latency P99(ms) */
  itlP99Ms: number
  /** Inter-Token Latency 最大值(ms) */
  itlMaxMs: number
  /** Inter-Token Latency 平均值(ms) */
  itlMeanMs: number
  /** token 数量(不含 TTFT 起点时间戳) */
  chunkCount: number
  /** 尝试次数(由调用方设置,默认 0) */
  attempts: number
}

/**
 * 分位数计算(线性插值,与 numpy.percentile 默认一致)。
 *
 * @param sortedAsc 已升序排序的数组
 * @param p 百分位 [0, 100]
 */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0
  if (sortedAsc.length === 1) return sortedAsc[0]!
  const rank = (p / 100) * (sortedAsc.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sortedAsc[lo]!
  const frac = rank - lo
  return sortedAsc[lo]! + (sortedAsc[hi]! - sortedAsc[lo]!) * frac
}

/**
 * 从绝对时间戳序列计算推理延迟统计。
 *
 * @param startMs 推理开始时间(ms,绝对时间戳)
 * @param tokenTimestampsMs 每个 token 的绝对时间戳(ms),已按时间顺序排列
 * @param nowMs 当前时间(ms,绝对时间戳),用于计算总耗时
 * @returns InferenceLatencyStats
 *
 * 行为:
 *   - tokenTimestampsMs 为空 → TTFT = now - start, ITL 全 0, chunkCount=0
 *   - 只有 1 个 token → TTFT = token - start, ITL 全 0, chunkCount=1
 *   - ≥2 个 token → 计算 ITL 序列(token[i] - token[i-1]),产出 P50/P99/Max/Mean
 */
export function inferenceLatencyFromTimestamps(
  startMs: number,
  tokenTimestampsMs: number[],
  nowMs: number,
): InferenceLatencyStats {
  const totalMs = Math.max(0, nowMs - startMs)

  if (tokenTimestampsMs.length === 0) {
    return {
      ttftMs: totalMs,
      totalMs,
      itlP50Ms: 0,
      itlP99Ms: 0,
      itlMaxMs: 0,
      itlMeanMs: 0,
      chunkCount: 0,
      attempts: 0,
    }
  }

  const ttftMs = Math.max(0, tokenTimestampsMs[0]! - startMs)

  if (tokenTimestampsMs.length === 1) {
    return {
      ttftMs,
      totalMs,
      itlP50Ms: 0,
      itlP99Ms: 0,
      itlMaxMs: 0,
      itlMeanMs: 0,
      chunkCount: 1,
      attempts: 0,
    }
  }

  // 计算相邻 token 的时间差(ITL 序列)
  const itls: number[] = []
  for (let i = 1; i < tokenTimestampsMs.length; i++) {
    const diff = tokenTimestampsMs[i]! - tokenTimestampsMs[i - 1]!
    itls.push(Math.max(0, diff))
  }

  const sortedAsc = [...itls].sort((a, b) => a - b)
  const sum = itls.reduce((s, x) => s + x, 0)
  const mean = itls.length > 0 ? sum / itls.length : 0

  return {
    ttftMs,
    totalMs,
    itlP50Ms: percentile(sortedAsc, 50),
    itlP99Ms: percentile(sortedAsc, 99),
    itlMaxMs: sortedAsc[sortedAsc.length - 1] ?? 0,
    itlMeanMs: mean,
    chunkCount: tokenTimestampsMs.length,
    attempts: 0,
  }
}
