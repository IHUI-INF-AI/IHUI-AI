// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ============================================================================
// G-816030:帧归属屏障(api-client 侧同形移植;判据源在 @ihui/shared)
// ============================================================================
//
// **为什么本包有一份**:本包是零依赖包(package.json 只声明 @ihui/types),
// 不得 import @ihui/shared(会成环:shared 的 agent-events 反向依赖本包);
// 唯一语义出口在 `packages/shared/src/sse/frame-ownership-barrier.ts`,本文件是
// 它的**逐字同形移植**(先例:frame-watermark / error-serialize / stream-trace-id
// 的判例表对账模式)。两份漂移由
// `packages/api-client/tests/frame-barrier-parity-g816030.test.ts` 钉住:
// 同一张判例表跑两侧实现、核心代码标记逐字同族 —— 任何一侧改规则而另一侧
// 不同步,该侧就红。故障形态与三条判据(ACK 前按原序交付 / 越界整批清空
// 不得 shift 保上限 / 抛错前已反向退订)的完整论证见判据源头部注释。

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
  /** 字节面计重(缺省按 0 计) */
  byteSize?: number
  /** 载荷(消费方自己的帧形状) */
  frame: TFrame
}

/** offer 的三态:pass = 所有权已确立,调用方直接交付;staged = 有界暂存;overflow = 溢出,整批已清空。 */
export type FrameBarrierDeliveryKind = 'pass' | 'staged' | 'overflow'

/** activate 的入参:激活哪条订阅对哪些 topic 的所有权。 */
export interface FrameBarrierActivateInput {
  subscriptionId: string
  topics: readonly string[]
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
   * 绝不 shift 保上限。
   */
  offer(frame: BarrierFrame<TFrame>): FrameBarrierDeliveryKind
  /**
   * ACK:确立订阅对 topics 的所有权;成功 ⇒ 返回暂存帧中归属已激活 topic 的部分
   * (**按原序**,调用方逐条交付);越界 ⇒ 先反向退订再抛 FrameBarrierOverflowError。
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
  let overflow: { subscriptionId: string; reason: 'frames' | 'bytes'; droppedCount: number } | null =
    null

  const byteSizeOf = (frame: BarrierFrame<TFrame>): number =>
    typeof frame.byteSize === 'number' && Number.isFinite(frame.byteSize) && frame.byteSize > 0
      ? frame.byteSize
      : 0

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
      for (const topic of topics) {
        activeByTopic.set(topic, subscriptionId)
      }
      // 按原序交还归属已激活 topic 的暂存帧;其余订阅的暂存帧保留等它们自己的 ACK
      const flushable: BarrierFrame<TFrame>[] = []
      const rest: BarrierFrame<TFrame>[] = []
      const activeTopics = new Set(topics)
      for (const frame of staged) {
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
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
