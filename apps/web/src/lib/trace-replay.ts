// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 执行轨迹回放纯逻辑(P3 #39 执行轨迹即文档,2026-09-16 立)。
 *
 * 轨迹数据天然存在于 assistant 消息的 toolCalls(id/toolName/args/result/status/
 * durationMs 齐全),本模块只做**时序重演**:按原始顺序逐步高亮,重现 agent 的
 * 执行节奏——这是它与静态工具卡片列表(ToolCallsSection)的差异化价值。
 *
 * 节奏策略:不按真实 durationMs 等比播放(一个 30s 的工具调用会让回放卡死半分钟),
 * 而是**每步固定节奏**,长步骤按 durationMs 做温和加权(cap 上限),既保留
 * "这步很重"的体感又不拖垮回放。
 */

/** 每步基础时长(ms)。 */
export const TRACE_STEP_BASE_MS = 550

/** 单步加权上限(ms)——无论真实耗时多大,一步最多停留 1.8s。 */
export const TRACE_STEP_CAP_MS = 1800

/** 步骤停留时长:基础节奏 + 真实耗时的温和加权(log 压缩),cap 封顶。 */
export function traceStepDuration(durationMs: number | undefined): number {
  if (!durationMs || durationMs <= 0) return TRACE_STEP_BASE_MS
  const weighted = TRACE_STEP_BASE_MS + Math.min(Math.log10(Math.max(durationMs, 1)) * 220, 900)
  return Math.min(weighted, TRACE_STEP_CAP_MS)
}

/** 回放状态(纯数据,便于单测)。 */
export interface TracePlayback {
  /** 当前高亮步骤索引(0-based;-1 = 未开始) */
  cursor: number
  playing: boolean
  /** 是否已播完全部步骤 */
  finished: boolean
}

/** 初始状态:停在第一步之前(播放从 cursor 0 开始)。 */
export function initialPlayback(total: number): TracePlayback {
  return { cursor: total > 0 ? -1 : 0, playing: false, finished: total === 0 }
}

/**
 * 推进一步(纯函数)。
 *
 * @returns 到末尾后停止:finished=true,playing 归 false。
 */
export function advancePlayback(pb: TracePlayback, total: number): TracePlayback {
  if (total === 0) return { cursor: 0, playing: false, finished: true }
  const next = pb.cursor + 1
  if (next >= total) return { cursor: total - 1, playing: false, finished: true }
  return { cursor: next, playing: true, finished: false }
}
