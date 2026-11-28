// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 压缩结果的会话面物化 —— 主路径的第一步(2026-11-26 W4-10)。
 *
 * 压缩在语义上就是三件事:`system` 保留、锚点原文保留、中段换成一条摘要、尾部保留。
 * 本模块不重算任何压缩判据,只把**已经算好的布局**表达成会话事件:
 *
 *   added(system*) → added(anchors*) → inserted(摘要, index=system+anchors) → added(keep*)
 *
 * 为什么不从原始消息"先 added 再 remove 再 insert":`compressContext` 会把 system
 * 统一提到最前,而原始顺序里 system 可能不在最前;surface 没有 move 事件,强行重排
 * 只能删掉再加,锚点节点身份就丢了。这里直接按**最终布局**物化,节点身份与最终输出
 * 一一对应,不制造假历史。
 *
 * 产出 `messages` 由 `surfaceToMessages` 导出 —— 压缩结果从此不是"手拼数组",
 * 而是同一套投影契约的产物;后续要做增量替换,只需在这条事件序列上追加 op。
 */

import {
  applyReplaceOps,
  projectSurface,
  surfaceToMessages,
  type ReplaceOp,
  type SessionEvent,
  type SurfaceNode,
} from './session-surface.js'
import { SUMMARY_MARKER } from './markers.js'
import type { ChatMessage } from './types.js'

/** 压缩布局:与 `compressContext` 的内部三块一一对应,不另造语义 */
export interface CompactionLayout {
  readonly system: readonly ChatMessage[]
  readonly anchors: readonly ChatMessage[]
  readonly summary: ChatMessage
  readonly keep: readonly ChatMessage[]
}

/** 物化结果:事件序列是底稿,surface 是投影,messages 是模型可见面 */
export interface MaterializedCompaction {
  readonly messages: ChatMessage[]
  readonly surface: SurfaceNode[]
  readonly events: SessionEvent[]
}

/**
 * 把压缩布局物化成会话面。
 *
 * seq 从 1 开始严格递增;摘要的插入下标 = system 条数 + anchors 条数,
 * 与 `compressContext` 的 `[...system, ...anchors, summary, ...keep]` 逐位一致。
 */
export function materializeCompactionLayout(layout: CompactionLayout): MaterializedCompaction {
  let seq = 0
  const events: SessionEvent[] = []
  const emitAdded = (message: ChatMessage): void => {
    seq += 1
    events.push({ seq, type: 'message.added', message })
  }

  for (const message of layout.system) emitAdded(message)
  for (const message of layout.anchors) emitAdded(message)

  seq += 1
  events.push({
    seq,
    type: 'message.inserted',
    index: layout.system.length + layout.anchors.length,
    message: layout.summary,
  })

  for (const message of layout.keep) emitAdded(message)

  const surface = projectSurface(events)
  return { messages: surfaceToMessages(surface), surface, events }
}

/** 摘要节点的唯一识别:正文以 `SUMMARY_MARKER` 开头(不锁 role,历史摘要形态兼容) */
function isSummaryNode(node: SurfaceNode): boolean {
  return node.removed !== true && node.message.content.startsWith(SUMMARY_MARKER)
}

/**
 * 增量刷新摘要:只追加一条 replace 操作,锚点与尾部节点身份全部保留。
 *
 * 与"重新 materialize 一份布局"的区别:
 *   - 节点 `nodeId` / `seq` 不变,历史位置可回放;
 *   - 操作带 `opId`,同一 opId 重复应用无副作用;
 *   - 其余消息对象一个都不换(引用级保留)。
 *
 * 前置:当前投影里必须**恰好一条**未移除的摘要。0 条 ⇒ 没压缩过,不该刷新;
 * 多条 ⇒ 摘要套摘要,先修上一步,不在这里猜"哪条是最新"。
 */
export function replaceCompactionSummary(
  surface: readonly SurfaceNode[],
  summary: ChatMessage,
  opId: string,
): SurfaceNode[] {
  const targets = surface.filter(isSummaryNode)
  if (targets.length !== 1) {
    throw new Error(
      `compaction-surface: 刷新摘要要求恰好 1 条未移除摘要,实际 ${targets.length} 条`,
    )
  }
  const target = targets[0]!
  return applyReplaceOps(surface, [{ opId, kind: 'replace', targetSeq: target.seq, message: summary }])
}

/** 二次压缩输入:当前消息里已有一条摘要,新摘要只替换它,其余压缩区按引用移除 */
export interface RecompactInput {
  readonly messages: readonly ChatMessage[]
  readonly summary: ChatMessage
  /** 要被压缩掉的旧消息(必须排除那条旧摘要:它由 replace 复用,不参与 remove) */
  readonly remove: readonly ChatMessage[]
  readonly opId: string
}

/**
 * 二次压缩的增量路径:旧摘要节点原地换正文,压缩区其余消息按引用移除。
 *
 * 与重新 materialize 的区别:旧摘要的 `nodeId`/`seq` 保留,历史回放能看出
 * "这一条一直是摘要,只是正文更新了";`remove` 里的消息逐条带独立 opId,
 * 同一批操作重放幂等。`remove` 引用了不在当前投影里的消息 ⇒ 抛错,不静默跳过
 * (那通常意味着调用方的 head 切分与 messages 不是同一份)。
 */
export function recompactWithSummary(input: RecompactInput): MaterializedCompaction {
  let seq = 0
  const events: SessionEvent[] = []
  for (const message of input.messages) {
    seq += 1
    events.push({ seq, type: 'message.added', message })
  }
  const seeded = projectSurface(events)

  const replaced = replaceCompactionSummary(seeded, input.summary, `${input.opId}:summary`)

  const seqByRef = new Map<ChatMessage, number[]>()
  for (const node of seeded) {
    if (node.removed === true) continue
    const list = seqByRef.get(node.message)
    if (list === undefined) seqByRef.set(node.message, [node.seq])
    else list.push(node.seq)
  }

  const removals: ReplaceOp[] = []
  for (const message of input.remove) {
    const seqs = seqByRef.get(message)
    if (seqs === undefined || seqs.length === 0) {
      throw new Error('compaction-surface: remove 引用了不在当前会话面里的消息')
    }
    for (const targetSeq of seqs) {
      removals.push({ opId: `${input.opId}:remove:${targetSeq}`, kind: 'remove', targetSeq })
    }
  }

  const surface = applyReplaceOps(replaced, removals)
  return { messages: surfaceToMessages(surface), surface, events }
}
