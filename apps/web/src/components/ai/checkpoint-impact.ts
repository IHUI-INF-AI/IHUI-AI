// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 回退影响预览的纯逻辑(可单测):把后端返回的影响文件清单整理为展示用结构。
// 后端已在 50 个处截断并标记 truncated;此函数再对传入清单做一次确定性截断,
// 作为前端展示的权威口径(即便后端未截断也能正确收敛)。

import type { CheckpointImpactFile } from '@/api/checkpoint-api'

/** 影响文件清单默认截断上限(对标 Trae:列前 N 个 + "等 M 个文件") */
export const IMPACT_FILE_LIMIT = 50

export interface PreparedImpact {
  /** 实际展示的文件(已截断到 limit) */
  display: CheckpointImpactFile[]
  /** 是否发生了截断(原始清单超过 limit) */
  truncated: boolean
  /** 被隐藏的文件数 */
  remaining: number
}

/** 把完整影响文件清单收敛为展示结构。 */
export function prepareImpactFiles(
  files: CheckpointImpactFile[],
  limit: number = IMPACT_FILE_LIMIT,
): PreparedImpact {
  if (files.length <= limit) {
    return { display: files, truncated: false, remaining: 0 }
  }
  return {
    display: files.slice(0, limit),
    truncated: true,
    remaining: files.length - limit,
  }
}

// ---------------------------------------------------------------------------
// 「恢复到本轮之前」的影响面(2026-10-29 立)
//
// 为什么需要:确认弹窗原先只说"共 N 个文件改动将回退",但 `restoreCheckpoint(..., 'both')`
// 恢复的是**整个会话的消息快照** —— 目标 checkpoint 时点之后的所有对话轮次都会消失。
// 用户被告知的(几个文件)与真正失去的(若干轮对话)不是一个量级,确认键就成了"信息缺一半"
// 的不可撤销操作。下列两个纯函数把这两件事算清楚,供确认文案如实呈现。
//
// 判据只认既有契约字段(checkpoint.created_at / message.createdAt / role),不新造口径。
// ---------------------------------------------------------------------------

/** 「恢复到本轮之前」要落到哪个 checkpoint:严格早于该消息、且**最晚**的那一个 */
export function pickRevertCheckpoint<T extends { created_at: number }>(
  checkpoints: readonly T[],
  messageCreatedAt: number,
): T | null {
  let best: T | null = null
  for (const c of checkpoints) {
    if (!(c.created_at < messageCreatedAt)) continue
    if (!best || c.created_at >= best.created_at) best = c
  }
  return best
}

/**
 * 这次恢复会连带撤销多少轮对话。
 *
 * 口径 = 恢复后将从历史里消失的 assistant 轮次数(含本轮):
 * 即 createdAt 不早于目标 checkpoint 时点的 assistant 消息条数 ——
 * 恢复把消息历史整体换成该 checkpoint 的快照,那时点之后的一切都不再存在。
 *
 * 注意这是**前端当前已加载消息**的读数(历史分页时可能偏小)。调用方必须把它当
 * "至少这么多轮"呈现,不能据此声称"仅影响这些";取不到(无 checkpoint)则返回 null,
 * 由文案退化成不带数字的形态 —— 绝不用 0 冒充"没有涟漪"。
 */
export function countAffectedTurns(
  messages: readonly { role: string; createdAt?: number }[],
  checkpointCreatedAt: number,
): number | null {
  let turns = 0
  let known = 0
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    if (typeof m.createdAt !== 'number') continue
    known += 1
    if (m.createdAt >= checkpointCreatedAt) turns += 1
  }
  // 一条带时间戳的 assistant 消息都没有 ⇒ 算不出来,不猜
  return known === 0 ? null : turns
}

/** 确认弹窗要呈现的撤销影响面 */
export interface RevertImpact {
  /** 目标 checkpoint;null = 无可用检查点(恢复入口本身应已禁用) */
  checkpoint: { checkpoint_id: string; created_at: number } | null
  /** 会连带撤销的轮次数;null = 算不出来(消息未加载齐 / 无 checkpoint) */
  turnCount: number | null
}

/** 一次算清「恢复到本轮之前」到底会动什么(目标 checkpoint + 连带轮次) */
export function resolveRevertImpact<
  C extends { checkpoint_id: string; created_at: number },
  M extends { role: string; createdAt?: number },
>(checkpoints: readonly C[], messageCreatedAt: number, messages: readonly M[]): RevertImpact {
  const checkpoint = pickRevertCheckpoint(checkpoints, messageCreatedAt)
  if (!checkpoint) return { checkpoint: null, turnCount: null }
  return {
    checkpoint: { checkpoint_id: checkpoint.checkpoint_id, created_at: checkpoint.created_at },
    turnCount: countAffectedTurns(messages, checkpoint.created_at),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
