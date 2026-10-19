// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ============================================================================
// G-816030:帧归属屏障(ACK 之前按订阅所有权有界暂存,越界整批丢弃并让订阅明确失败)
// ============================================================================
//
// 故障形态(上游 packages/ui/src/v4/ackActivationBarrier.ts:105-132 同型):通知先于
// RPC 响应(ACK)抵达时,半截批次被当完整快照投影。上游 :114-128 注释原话:"通过
// shift 头部来维持上限会留下一个看似可激活、实际缺片的 physical batch。越界必须整批
// 清空并让 subscribe 明确失败"。
//
// 三条判据(本票验收):
// ① ACK 前暂存的帧在 ACK 时**按原序**交付(不是丢弃、不是乱序);
// ② 暂存超上限后再来一帧 ⇒ activate 必须抛错且**一帧都不交付** —— 只判"上限内可激活"
//    等于允许"shift 保上限"的实现蒙混,而 shift 保上限正是上游点名要防的缺陷;
// ③ activate 抛错前必须已反向退订(上游 agentConversationTransport.ts:227-245:收到
//    抛错后反向 unsubscribe 刚拿到的 host subscription,不返回"可 activate 的 ACK")。
//
// 所有权判定:仅 activeByTopic.get(frame.topic) === frame.subscriptionId 才算本订阅的
// 帧(上游 :105-132 的 activeByTopic 同形);未激活/不归属 ⇒ 有界暂存。
// 双上限:MAX_STAGED_FRAMES / MAX_STAGED_BYTES(上游 :10-16 同形),任一越界即溢出。
//
// 落点说明:本出口是唯一判据源;packages/api-client 因零依赖包边界不得 import 本包,
// 其读环内的同形移植(frame-ownership-barrier.ts)由
// packages/api-client/tests/frame-barrier-parity-g816030.test.ts 的判例表对账钉住
// (先例:frame-watermark / error-serialize / stream-trace-id)。
//
// ============================================================================
// G-276:单向代际守卫(建连 await 窗口代际重验的收尾格)
// ============================================================================
// 主判据(cffa4242)已入库:ws-client.ts 两道 await 后重验 + disposeStaleSocket。
// 仍开的一格 = **迟到帧不得回写所有权映射**。上游锚:上游仓
// replaceableConversationTransport.ts:84-99 的单向代际守卫(本仓无该文件,仅参考
// 语义):代际递增后,旧代际的迟到帧只丢弃、不投递、不回写任何代际状态。
//
// 落法:帧与 ACK 都可选携带单调递增的 generation(缺省不判 —— 未下发代际的旧
// 生产端零行为变化);activate(ACK)是唯一推进当前代际的出口,代际只升不降
// (reset 除外)。守卫两格:
//  · 迟到帧(generation 早于当前代际)⇒ 只丢弃:不投递('pass' 不可能)、不暂存
//    (防被后续 ACK 冲刷误投)、不回写任何状态;
//  · 迟到 ACK ⇒ 不回写所有权映射(activeByTopic 不动)、不冲刷暂存,返回空批。
// 当前代际(及未携带代际)的帧行为逐字不变;ACK 冲刷时对暂存帧同样按代际过滤,
// 换代前已暂存的旧代际帧不得借新 ACK 之手投递。

/** 暂存帧上限(条数)。 */
export const FRAME_BARRIER_MAX_STAGED_FRAMES = 512
/** 暂存帧字节上限(双上限之一;帧未报 byteSize 按 0 计)。 */
export const FRAME_BARRIER_MAX_STAGED_BYTES = 1 << 20

/** 带订阅归属的帧(topic 上的所有权由 activeByTopic 判)。 */
export interface BarrierFrame<TFrame = unknown> {
  /** 帧所属 topic(订阅所有权键) */
  topic: string
  /** 帧声称的订阅代际 */
  subscriptionId: string
  /**
   * G-276:帧声称的建连代际(单调递增)。缺省不判 —— 未下发代际的旧生产端
   * 零行为变化;携带且早于屏障当前代际 ⇒ 迟到帧,只丢弃、不投递、不暂存。
   */
  generation?: number
  /** 字节面计重(缺省按 0 计) */
  byteSize?: number
  /** 载荷(消费方自己的帧形状) */
  frame: TFrame
}

/** offer 的四态:pass = 所有权已确立,调用方直接交付;staged = 有界暂存;overflow = 溢出,整批已清空;stale = 迟到帧(G-276),只丢弃。 */
export type FrameBarrierDeliveryKind = 'pass' | 'staged' | 'overflow' | 'stale'

/** activate 的入参:激活哪条订阅对哪些 topic 的所有权。 */
interface FrameBarrierActivateInput {
  subscriptionId: string
  topics: readonly string[]
  /**
   * G-276:本 ACK 携带的建连代际。缺省不判(旧行为);早于屏障当前代际 ⇒
   * 迟到 ACK:不回写所有权映射、不冲刷暂存、返回空批;高于当前代际 ⇒ 单向推进。
   */
  generation?: number
  /**
   * 反向退订钩子:越界时 activate **先调用它再抛错**(保证"抛错后必须已反向退订"
   * 可被断言 —— 断退订调用次数,不看日志文案)。
   */
  unsubscribe?: () => void
}

/** 越界错误:reason 指明哪条上限被击穿,droppedCount 记整批丢弃的帧数。 */
export class FrameBarrierOverflowError extends Error {
  readonly reason: 'frames' | 'bytes'
  readonly droppedCount: number

  constructor(reason: 'frames' | 'bytes', droppedCount: number) {
    super(
      `frame ownership barrier overflow (${reason}); staged batch dropped entirely: ${droppedCount} frames`,
    )
    this.name = 'FrameBarrierOverflowError'
    this.reason = reason
    this.droppedCount = droppedCount
  }
}

export interface FrameOwnershipBarrier<TFrame = unknown> {
  /**
   * 收一帧:所有权已确立(activeByTopic 命中)⇒ 'pass'(调用方直接交付);
   * 未确立 ⇒ 有界暂存('staged');越界 ⇒ **整批清空 + 标记溢出**('overflow'),
   * 绝不 shift 保上限;代际早于当前代际(G-276)⇒ 'stale',只丢弃、不投递不暂存。
   */
  offer(frame: BarrierFrame<TFrame>): FrameBarrierDeliveryKind
  /**
   * ACK:确立订阅对 topics 的所有权;成功 ⇒ 返回暂存帧中归属已激活 topic 的部分
   * (**按原序**,调用方逐条交付);越界 ⇒ 先反向退订再抛 FrameBarrierOverflowError;
   * 代际早于当前代际(G-276)⇒ 迟到 ACK:不回写映射、不冲刷暂存,返回空批。
   */
  activate(input: FrameBarrierActivateInput): BarrierFrame<TFrame>[]
  /** 仅 activeByTopic.get(topic) === subscriptionId 才算本订阅的帧。 */
  isOwned(topic: string, subscriptionId: string): boolean
  stagedCount(): number
  stagedBytes(): number
  /** 该订阅是否已溢出(溢出后 activate 必抛、offer 恒拒,直到 reset)。 */
  overflowOf(subscriptionId: string): boolean
  /** 清空全部状态(重连/换代/测试隔离用)。 */
  reset(): void
}

export function createFrameOwnershipBarrier<TFrame = unknown>(options?: {
  maxStagedFrames?: number
  maxStagedBytes?: number
}): FrameOwnershipBarrier<TFrame> {
  const maxFrames = options?.maxStagedFrames ?? FRAME_BARRIER_MAX_STAGED_FRAMES
  const maxBytes = options?.maxStagedBytes ?? FRAME_BARRIER_MAX_STAGED_BYTES

  let activeByTopic = new Map<string, string>()
  let staged: BarrierFrame<TFrame>[] = []
  let bytes = 0
  let overflow: {
    subscriptionId: string
    reason: 'frames' | 'bytes'
    droppedCount: number
  } | null = null
  // G-276:屏障当前代际。activate(ACK)是唯一推进出口,单向只升(reset 归零除外);
  // 携带更早代际的帧/ACK 一律按迟到处理。
  let currentGeneration = 0

  const byteSizeOf = (frame: BarrierFrame<TFrame>): number =>
    typeof frame.byteSize === 'number' && Number.isFinite(frame.byteSize) && frame.byteSize > 0
      ? frame.byteSize
      : 0

  // 迟到判定:仅对显式携带 generation 且为安全整数的输入判;缺省(旧生产端)不判。
  const isStaleGeneration = (generation: number | undefined): boolean =>
    typeof generation === 'number' &&
    Number.isSafeInteger(generation) &&
    generation < currentGeneration

  const clearStaged = (): void => {
    staged = []
    bytes = 0
  }

  return {
    offer(frame) {
      if (overflow !== null && overflow.subscriptionId === frame.subscriptionId) {
        // 已溢出的订阅:后续帧一律拒收(整批已清,不再零星收)
        return 'overflow'
      }
      if (isStaleGeneration(frame.generation)) {
        // G-276:迟到帧只丢弃 —— 不投递('pass' 不可能)、不暂存(否则会被后续
        // ACK 冲刷误投)、不回写任何代际状态。
        return 'stale'
      }
      if (activeByTopic.get(frame.topic) === frame.subscriptionId) {
        return 'pass'
      }
      // 越界判定在入队前:再收这一帧就会超上限 ⇒ 整批(含本帧)清空并标记溢出。
      // 刻意不用"shift 头部保上限" —— 那会留下看似可激活、实际缺片的批次。
      if (staged.length + 1 > maxFrames || bytes + byteSizeOf(frame) > maxBytes) {
        const reason: 'frames' | 'bytes' = staged.length + 1 > maxFrames ? 'frames' : 'bytes'
        overflow = { subscriptionId: frame.subscriptionId, reason, droppedCount: staged.length + 1 }
        clearStaged()
        return 'overflow'
      }
      staged.push(frame)
      bytes += byteSizeOf(frame)
      return 'staged'
    },

    activate(input) {
      const { subscriptionId, topics, unsubscribe } = input
      if (overflow !== null && overflow.subscriptionId === subscriptionId) {
        // 上游 :227-245:先反向退订刚拿到的 host subscription,再上抛 ——
        // 不返回"可 activate 的 ACK"。"抛错后已反向退订"由此保证。
        try {
          unsubscribe?.()
        } catch {
          // 退订自身失败不掩盖越界错误
        }
        throw new FrameBarrierOverflowError(overflow.reason, overflow.droppedCount)
      }
      if (isStaleGeneration(input.generation)) {
        // G-276:迟到 ACK —— 不回写所有权映射(activeByTopic 不动)、不冲刷暂存,
        // 返回空批。暂存帧属于当前/更新代际,不得借旧 ACK 之手投递。
        return []
      }
      if (
        typeof input.generation === 'number' &&
        Number.isSafeInteger(input.generation) &&
        input.generation > currentGeneration
      ) {
        // 单向推进:代际只升不降,落后于已推进代际的帧从此按迟到处理。
        currentGeneration = input.generation
      }
      for (const topic of topics) {
        activeByTopic.set(topic, subscriptionId)
      }
      // 按原序交还归属已激活 topic 的暂存帧;其余订阅的暂存帧保留等它们自己的 ACK;
      // 暂存帧里的迟到代际帧(G-276:换代前暂存、ACK 时已落后)只丢弃,不冲刷不保留。
      const flushable: BarrierFrame<TFrame>[] = []
      const rest: BarrierFrame<TFrame>[] = []
      const activeTopics = new Set(topics)
      for (const frame of staged) {
        if (isStaleGeneration(frame.generation)) continue
        if (activeTopics.has(frame.topic)) flushable.push(frame)
        else rest.push(frame)
      }
      staged = rest
      bytes = rest.reduce((sum, frame) => sum + byteSizeOf(frame), 0)
      return flushable
    },

    isOwned(topic, subscriptionId) {
      return activeByTopic.get(topic) === subscriptionId
    },

    stagedCount() {
      return staged.length
    },

    stagedBytes() {
      return bytes
    },

    overflowOf(subscriptionId) {
      return overflow !== null && overflow.subscriptionId === subscriptionId
    },

    reset() {
      activeByTopic = new Map()
      clearStaged()
      overflow = null
      currentGeneration = 0
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
