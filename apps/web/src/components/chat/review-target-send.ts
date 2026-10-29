// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D06 审查对象选择器 —— 选择条 → 本轮发送正文的**唯一判定点**(2026-10-27 装车)。
//
// 为什么单列一个纯函数:
//   · 装车那一刻最容易退化的不是 UI,而是"选择条在、发送时被绕过";把判定抽成纯函数,
//     单测可以逐档钉死"选择 → 正文"的映射(含反向:未选/未 ready ⇒ 正文逐字不变);
//   · `message-input.tsx` 只负责调用与发送后清状态,不再各写一份 if。
//
// 形态(与 `./review-context.ts` 头注同一份口径):
//   · slash 档(uncommitted / branch / commit)⇒ 正文**改写**为 `/review <target>`,
//     交给 `send-message.ts` 既有拦截链只读收集 diff(单一收集实现,前端不跑 git);
//     用户已输入的草稿不随命令送出,`restoreDraft` 原样带回供发送后回填(不静默丢稿);
//   · file / snippet 档 ⇒ 内联审查块追加到草稿尾部(只影响发给 LLM 的正文);
//   · 其余(未选 / 未 ready)⇒ plain,正文逐字不变。

import {
  buildReviewContextInline,
  toReviewSlashText,
  type ReviewSourceSelection,
} from './review-context'

/** 本轮发送正文的三种形态。 */
export type ReviewSendPlan =
  /** 无审查对象消费:正文原样 */
  | { mode: 'plain'; text: string }
  /** git 目标档:正文改为 slash 命令;`restoreDraft` = 用户原有草稿(发送后回填) */
  | { mode: 'slash'; text: string; restoreDraft: string }
  /** file/snippet 档:正文尾部追加内联审查块 */
  | { mode: 'inline'; text: string }

/**
 * 组装本轮正文。
 * @param base    输入框当前正文(或调用方显式覆盖的正文)
 * @param selection 选择条当前值(受控)
 * @param enabled 是否消费本选择(生产 = 当前模式为 review 且 `isReviewSelectionReady`)
 */
export function planReviewSend(
  base: string,
  selection: ReviewSourceSelection | null,
  enabled: boolean,
): ReviewSendPlan {
  if (!enabled || !selection) return { mode: 'plain', text: base }

  const slash = toReviewSlashText(selection)
  if (slash) {
    return { mode: 'slash', text: slash, restoreDraft: base.trim() }
  }

  const inline = buildReviewContextInline(selection)
  if (!inline) return { mode: 'plain', text: base }
  const head = base.trim()
  return { mode: 'inline', text: head ? `${head}\n\n${inline}` : inline }
}
