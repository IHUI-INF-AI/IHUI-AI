// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话面(surface)最小投影 —— 影子回放 + 压缩结果物化。
 *
 * 立因(2026-11-26 四程序对标 W4-10 / P0-C):同类产品的压缩不是在消息数组上"改完覆盖",
 * 而是在一条**只追加的事件序列**上做替换:历史不动,模型看见的是投影(surface),
 * 替换是带 opId 的显式操作,重放幂等。这样压缩前后的计价、审计、回滚才有同一份底稿。
 *
 * 本模块只做四件事,且全部是纯函数:
 *   1. `projectSurface(events)`：事件序列 → 可见节点(只追加 + 插入/替换/移除标记);
 *   2. `applyReplaceOps(nodes, ops)`：把替换操作应用到投影上,同 opId 重复应用无副作用;
 *   3. `surfaceToMessages(nodes)`：投影 → 模型可见消息(过滤移除节点);
 *   4. `measureSurface(nodes)` / `measureReplacement(before, after)`：绝对计价与**带符号增量价**
 *      (2026-11-26 第六轮按 §3 拆到 `surface-metrics.ts`,判据仍只有一份);
 *   5. `reconcileSurface(projected, live)`：与现有消息数组对账,只报差异不改数据。
 *
 * 2026-11-26 第五轮:P0-C 的 `message.inserted` 补进来 —— 压缩产出的摘要在原会话里
 * 是"插在锚点之后、保留尾部之前"的新节点,没有插入事件就只能整体重排,历史节点身份会丢。
 * 插入只允许落在 `0..nodes.length`(含两端),越界一律抛。
 */

import type { ChatMessage } from './types.js'

/** 会话事件:只允许这五种,新增必须先改本联合类型 */
export type SessionEvent =
  | { seq: number; type: 'message.added'; message: ChatMessage }
  | { seq: number; type: 'message.inserted'; index: number; message: ChatMessage }
  | { seq: number; type: 'message.replaced'; targetSeq: number; message: ChatMessage; opId: string }
  | { seq: number; type: 'message.removed'; targetSeq: number; opId: string }

/** 替换/移除操作(与事件同构,单独导出便于压缩产出 op 列表) */
export interface ReplaceOp {
  opId: string
  kind: 'replace' | 'remove'
  targetSeq: number
  message?: ChatMessage
}

/** 投影节点:来源 seq 稳定,替换只改 `message`,不换节点身份 */
export interface SurfaceNode {
  nodeId: string
  seq: number
  message: ChatMessage
  /** 最后一次替换的 opId(未替换为空) */
  replacedBy?: string
  /** 已应用过的 opId(用于幂等判定) */
  appliedOpIds: readonly string[]
  /** 被移除的节点仍留在投影里,只是不参与 `surfaceToMessages` */
  removed?: boolean
}

/** 对账差异:只描述"第几条、哪个维度不同",不试图修复 */
export interface SurfaceDivergence {
  index: number
  reason: 'length' | 'role' | 'content' | 'tool-call-id' | 'tool-call-set'
  projected?: ChatMessage
  live?: ChatMessage
}

function assertSeq(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`session-surface: ${name} 必须是非负整数,收到 ${String(value)}`)
  }
}

function cloneNode(node: SurfaceNode, patch: Partial<SurfaceNode>): SurfaceNode {
  return {
    ...node,
    ...patch,
    appliedOpIds: patch.appliedOpIds === undefined ? [...node.appliedOpIds] : [...patch.appliedOpIds],
  }
}

/**
 * 事件序列 → 可见节点。同一条事件重复回放必须得到逐字段相同的结果。
 *
 * 约束:事件 seq 必须严格递增(乱序/重复一律抛),否则"最后一次替换"没有确定含义。
 */
export function projectSurface(events: readonly SessionEvent[]): SurfaceNode[] {
  const nodes: SurfaceNode[] = []
  const indexBySeq = new Map<number, number>()
  let lastSeq = -1
  for (const event of events) {
    assertSeq('seq', event.seq)
    if (event.seq <= lastSeq) {
      throw new Error(`session-surface: 事件 seq 必须严格递增,${event.seq} 出现在 ${lastSeq} 之后`)
    }
    lastSeq = event.seq
    if (event.type === 'message.added') {
      const node: SurfaceNode = {
        nodeId: `n:${event.seq}`,
        seq: event.seq,
        message: event.message,
        appliedOpIds: [],
      }
      indexBySeq.set(event.seq, nodes.length)
      nodes.push(node)
      continue
    }
    if (event.type === 'message.inserted') {
      if (!Number.isInteger(event.index) || event.index < 0 || event.index > nodes.length) {
        throw new Error(
          `session-surface: 插入下标必须是 0..${nodes.length} 的整数,收到 ${String(event.index)}`,
        )
      }
      const node: SurfaceNode = {
        nodeId: `n:${event.seq}`,
        seq: event.seq,
        message: event.message,
        appliedOpIds: [],
      }
      nodes.splice(event.index, 0, node)
      // 插入会让后续节点下标整体后移:重建一次索引,避免 replace/remove 打到错位节点。
      indexBySeq.clear()
      nodes.forEach((item, index) => indexBySeq.set(item.seq, index))
      continue
    }
    const at = indexBySeq.get(event.targetSeq)
    if (at === undefined) {
      throw new Error(`session-surface: 目标 seq ${event.targetSeq} 不存在(投影已损坏)`)
    }
    const node = nodes[at]
    if (node === undefined) throw new Error(`session-surface: 目标下标 ${at} 越界`)
    if (node.appliedOpIds.includes(event.opId)) continue
    if (event.type === 'message.replaced') {
      nodes[at] = cloneNode(node, {
        message: event.message,
        replacedBy: event.opId,
        appliedOpIds: [...node.appliedOpIds, event.opId],
      })
    } else {
      nodes[at] = cloneNode(node, {
        removed: true,
        appliedOpIds: [...node.appliedOpIds, event.opId],
      })
    }
  }
  return nodes
}

/**
 * 应用替换/移除操作 —— 按顺序、按 opId 幂等。
 *
 * 同一 opId 第二次进来时直接跳过;不同 opId 指向同一节点则后者生效(历史仍可回放)。
 */
export function applyReplaceOps(nodes: readonly SurfaceNode[], ops: readonly ReplaceOp[]): SurfaceNode[] {
  const output = nodes.map((node) => cloneNode(node, {}))
  const indexBySeq = new Map<number, number>()
  output.forEach((node, index) => indexBySeq.set(node.seq, index))
  for (const op of ops) {
    assertSeq('targetSeq', op.targetSeq)
    if (typeof op.opId !== 'string' || op.opId === '') {
      throw new Error('session-surface: opId 必须是非空字符串')
    }
    const at = indexBySeq.get(op.targetSeq)
    if (at === undefined) throw new Error(`session-surface: 目标 seq ${op.targetSeq} 不存在`)
    const node = output[at]
    if (node === undefined) throw new Error(`session-surface: 目标下标 ${at} 越界`)
    if (node.appliedOpIds.includes(op.opId)) continue
    if (op.kind === 'replace') {
      if (op.message === undefined) throw new Error(`session-surface: replace 操作 ${op.opId} 缺少 message`)
      output[at] = cloneNode(node, {
        message: op.message,
        replacedBy: op.opId,
        appliedOpIds: [...node.appliedOpIds, op.opId],
      })
    } else {
      output[at] = cloneNode(node, {
        removed: true,
        appliedOpIds: [...node.appliedOpIds, op.opId],
      })
    }
  }
  return output
}

/** 投影 → 模型可见消息(过滤掉被移除节点,保留顺序) */
export function surfaceToMessages(nodes: readonly SurfaceNode[]): ChatMessage[] {
  return nodes.filter((node) => node.removed !== true).map((node) => node.message)
}

/**
 * 影子对账:现有消息数组 vs 投影结果。
 *
 * 只报第一处差异的定位与维度,不尝试"合并/修复";调用方据此决定是否切主路径。
 * 返回空数组 = 两者逐条一致。
 */
export function reconcileSurface(
  projected: readonly SurfaceNode[],
  live: readonly ChatMessage[],
): SurfaceDivergence[] {
  const messages = surfaceToMessages(projected)
  const divergences: SurfaceDivergence[] = []
  const common = Math.min(messages.length, live.length)
  for (let index = 0; index < common; index += 1) {
    const a = messages[index]
    const b = live[index]
    if (a === undefined || b === undefined) continue
    if (a.role !== b.role) {
      divergences.push({ index, reason: 'role', projected: a, live: b })
      return divergences
    }
    if (a.content !== b.content) {
      divergences.push({ index, reason: 'content', projected: a, live: b })
      return divergences
    }
    if ((a.tool_call_id ?? '') !== (b.tool_call_id ?? '')) {
      divergences.push({ index, reason: 'tool-call-id', projected: a, live: b })
      return divergences
    }
    const aIds = (a.tool_calls ?? []).map((call) => call.id).join('\u0001')
    const bIds = (b.tool_calls ?? []).map((call) => call.id).join('\u0001')
    if (aIds !== bIds) {
      divergences.push({ index, reason: 'tool-call-set', projected: a, live: b })
      return divergences
    }
  }
  if (messages.length !== live.length) {
    divergences.push({ index: common, reason: 'length' })
  }
  return divergences
}
