// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 回退影响预览的纯逻辑(可单测):把后端返回的影响文件清单整理为展示用结构。
// 后端已在 50 个处截断并标记 truncated;此函数再对传入清单做一次确定性截断,
// 作为前端展示的权威口径(即便后端未截断也能正确收敛)。

import type { CheckpointImpactFile, CheckpointMeta } from '@/api/checkpoint-api'

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

/**
 * 从会话的 checkpoint 清单里挑出"回退到某条消息时应落到的那一枚"。
 *
 * 判据:**不晚于该消息创建时刻的最后一枚**(created_at 为服务端时间戳,升序推进)。
 * 找不到 = 该消息之前没有可回退点 ⇒ 渲染层据此隐藏入口(返回 null,不用"最近一枚"顶替,
 * 否则会把用户回退到未来的状态)。
 */
export function pickRevertCheckpoint(
  checkpoints: CheckpointMeta[],
  createdAt: number,
): CheckpointMeta | null {
  let best: CheckpointMeta | null = null
  for (const c of checkpoints) {
    if (c.created_at > createdAt) continue
    if (!best || c.created_at > best.created_at) best = c
  }
  return best
}

/**
 * 从某个 checkpoint 时刻起,受影响的对话轮数(以用户消息计)。
 *
 * 一轮 = 一条 user 消息及其后的响应;因此从该时刻起的 user 消息条数即受影响轮数。
 * 若该时刻之后只剩助手消息(少见:回退点落在流式响应中途),按 1 轮计 —— 宁可多提示一轮,
 * 也不显示"0 轮受影响"来骗用户点确认。
 */
export function countAffectedTurns(
  messages: Array<{ role: string; createdAt: number }>,
  checkpointCreatedAt: number,
): number {
  const after = messages.filter((m) => m.createdAt >= checkpointCreatedAt)
  const userTurns = after.filter((m) => m.role === 'user').length
  if (userTurns > 0) return userTurns
  return after.length > 0 ? 1 : 0
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
