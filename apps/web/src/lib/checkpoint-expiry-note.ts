// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「检查点为什么没了」判据(2026-10-29 立)。
 *
 * ## 病灶
 * 本轮变更卡在无可回退检查点时,按钮只写「无可用检查点」并置灰 —— 用户看到上面
 * 明明列着改过哪些文件,却点不动,也不知道这是磁盘治理(TTL 到期清理)还是别的故障。
 * 一句"没有"把原因和后果都省了。
 *
 * ## 为什么不直接问后端
 * `GET /api/checkpoints`(`apps/ai-service/app/routers/checkpoint_rewind.py` 的
 * `list_checkpoints`)走 `AgentCheckpointManager.list_checkpoints`,后者的过滤条件就是
 * `not cp.is_expired(now)` —— **过期行根本不出现在响应里**。所以"列表为空"这件事在
 * HTTP 层是"无未过期检查点",不携带"是过期清的、还是从来没落过、还是被删了"的区别。
 *
 * 本模块不改后端契约,而是用一条**可证的推理**补上这个区别:
 *
 *   检查点的 `expires_at = created_at + TTL`(见 `agent_checkpoint.py` 的
 *   `save_checkpoint`:`expires_at=now + self._ttl`),并且**不续期**
 *   (同文件 refresh 注释:"不重置存活期…ex 用剩余时间而不是 self._ttl")。
 *   而回退目标要求 `checkpoint.created_at < message.createdAt`。
 *
 *   ⇒ 若 `now - message.createdAt >= TTL`,则
 *      `created_at + TTL <= message.createdAt + TTL <= now` ⇒ 该消息之前的检查点**必然**已过期。
 *
 * 这是数学上的确定,不是"可能"。所以本模块的 `'expired'` 判定可以支撑一句不带
 * "可能/或许"的文案。
 *
 * ## 哪些情况**不**判过期(失效方向:不说)
 * · 探测还在飞 / 根本没发请求(无会话 id)
 * · 探测失败(catch 分支也把 hasCheckpoint 置 false,但那不是"没有检查点",是"没问到")
 * · 时间戳缺失/非有限值
 * · 消息距今短于 TTL(此时"列表空"可能因为从未落过检查点,原因不可知)
 *
 * 以上一律 `'unknown'` ⇒ 调用方保持既有文案,一个字都不多说。
 */

import { DEFAULT_CHECKPOINT_TTL } from '@ihui/shared/constants'

/** 列表探测的实际结局(与"有没有检查点"分开:问没问到 ≠ 有没有) */
export type CheckpointProbeOutcome =
  /** 尚未发起(首帧) */
  | 'idle'
  /** 未发起且不会发起:无会话 id —— 探不到,不代表没有 */
  | 'skipped'
  /** 请求成功返回(此时 hasCheckpoint 才是可信的"有/没有") */
  | 'done'
  /** 请求失败(hasCheckpoint 被置 false 只是兜底渲染,不构成事实) */
  | 'failed'

/** 三种判定 */
export type CheckpointProbeVerdict =
  /** 有可用检查点(回退入口可用) */
  | 'available'
  /** 可证:该消息之前的检查点已按保留期清理 */
  | 'expired'
  /** 判不出来(探测中 / 探测失败 / 时间戳不可信 / 尚未超过保留期) */
  | 'unknown'

export interface CheckpointProbeInput {
  /** 探测结果:true=有 / false=没有 / null=还在探测 */
  hasCheckpoint: boolean | null
  /** 列表探测的实际结局 */
  probeOutcome: CheckpointProbeOutcome
  /** 该条消息的创建时刻(毫秒,`ChatMessage.createdAt` 口径) */
  messageCreatedAtMs: number
  /** 判定时刻(毫秒,注入以便单测) */
  nowMs: number
  /** 保留期秒数,默认取共享层唯一真源 */
  ttlSeconds?: number
}

/** 判定:该消息之前的检查点是否可证已过期 */
export function judgeCheckpointExpiry(input: CheckpointProbeInput): CheckpointProbeVerdict {
  const { hasCheckpoint, probeOutcome, messageCreatedAtMs, nowMs } = input
  if (hasCheckpoint === true) return 'available'
  // 只有"真问过且问到了"才允许下"没有"的结论;其余一律不知道,不猜
  if (hasCheckpoint !== false || probeOutcome !== 'done') return 'unknown'

  const ttlSeconds = input.ttlSeconds ?? DEFAULT_CHECKPOINT_TTL
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return 'unknown'
  if (!Number.isFinite(messageCreatedAtMs) || !Number.isFinite(nowMs)) return 'unknown'

  const ageMs = nowMs - messageCreatedAtMs
  // 未来时间戳(时钟漂移)⇒ 判不出,不说
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'unknown'
  // 等于 TTL 即已过期:checkpoint.created_at 严格早于 messageCreatedAt ⇒ expires_at 严格早于 now
  return ageMs >= ttlSeconds * 1000 ? 'expired' : 'unknown'
}

/**
 * 把保留期秒数折成给用户看的整小时数。
 *
 * 只用于文案插值:数值与 `DEFAULT_CHECKPOINT_TTL` 同源,不另写"24"这种字面量
 * (改 TTL 时文案自动跟着走,不会出现"文案说 24 小时、实际 12 小时"的撒谎)。
 */
export function retentionHours(ttlSeconds: number = DEFAULT_CHECKPOINT_TTL): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return 0
  return Math.max(1, Math.round(ttlSeconds / 3600))
}

export const __test__ = { retentionHours }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
