// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-13 票1(2026-09-30 立):帧水位与纪元 —— api-client 侧读环判据。
 *
 * **为什么本包有一份**:本包是零依赖包(package.json 只声明 @ihui/types),
 * 不得 import @ihui/shared(会成环:shared 的 agent-events 反向依赖本包);
 * 唯一语义出口在 `packages/shared/src/sse/agent-events.ts` 的
 * `readFrameWatermark` / `isFrameGap`,本文件是它的**逐字同形移植**
 * (先例:error-serialize.ts、帧级 traceId 同款判例表对账)。两份漂移由
 * `packages/api-client/tests/frame-watermark-parity-b76-13.test.ts` 钉住:
 * 同一张判例表跑两侧实现,结果必须全等。
 */

/** 帧水位字段(线格式;snapshot 帧 fromSeq 恒 0)。 */
export interface FrameWatermark {
  subscriptionId: string
  logEpoch: number
  fromSeq: number
  toSeq: number
}

/** 消费侧手上的水位游标(apply 成功后的状态归属证明)。 */
export interface FrameWatermarkCursor {
  subscriptionId: string
  logEpoch: number
  seq: number
}

/** gap 三条件(判到哪条报哪条;多条同犯时报第一条)。 */
export type FrameGapKind = 'generation-change' | 'epoch-change' | 'seq-discontinuity'

/** readFrameWatermark 的三态结论:**不得**把"未判定"伪装成 `{}` 或部分字段。 */
export type FrameWatermarkRead =
  | { verdict: 'ok'; watermark: FrameWatermark }
  | { verdict: 'undetermined' }
  | { verdict: 'invalid'; reason: string }

function isFiniteInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v)
}

function readWatermarkField(frame: Record<string, unknown>, camel: string, snake: string): unknown {
  const v = frame[camel]
  return v !== undefined ? v : frame[snake]
}

export function readFrameWatermark(frame: unknown): FrameWatermarkRead {
  if (frame === null || typeof frame !== 'object' || Array.isArray(frame)) {
    return { verdict: 'undetermined' }
  }
  const f = frame as Record<string, unknown>
  const subscriptionId = readWatermarkField(f, 'subscriptionId', 'subscription_id')
  const logEpoch = readWatermarkField(f, 'logEpoch', 'log_epoch')
  const fromSeq = readWatermarkField(f, 'fromSeq', 'from_seq')
  const toSeq = readWatermarkField(f, 'toSeq', 'to_seq')
  if (
    typeof subscriptionId !== 'string' ||
    subscriptionId.length === 0 ||
    !isFiniteInt(logEpoch) ||
    !isFiniteInt(fromSeq) ||
    !isFiniteInt(toSeq)
  ) {
    return { verdict: 'undetermined' }
  }
  if (logEpoch < 0 || fromSeq < 0 || toSeq < 0) {
    return { verdict: 'invalid', reason: '水位字段出现负值,不是合法的 (fromSeq, toSeq] 区间' }
  }
  if (toSeq < fromSeq) {
    return { verdict: 'invalid', reason: '区间倒挂(toSeq < fromSeq),判死,任何情况下不得应用' }
  }
  return { verdict: 'ok', watermark: { subscriptionId, logEpoch, fromSeq, toSeq } }
}

export function isFrameGap(
  cursor: FrameWatermarkCursor,
  watermark: FrameWatermark,
): FrameGapKind | null {
  if (cursor.subscriptionId !== watermark.subscriptionId) return 'generation-change'
  if (cursor.logEpoch !== watermark.logEpoch) return 'epoch-change'
  if (cursor.seq !== watermark.fromSeq) return 'seq-discontinuity'
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
