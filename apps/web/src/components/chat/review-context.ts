// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D06 结构化代码审查 —— 审查对象选择器的前端接口层(S18,2026-10-24)。
//
// 现状分工(本文件落地时刻):
//   · slash 通道(`apps/web/src/hooks/use-chat/slash-commands.ts` 的
//     `tryHandleReviewTargetSlash`)已覆盖 `/review uncommitted|branch|commit` 三档,
//     产出"内联 diff 的 LLM 文本",收集失败/空 diff 明说;
//   · 本文件补 UI 选择条那一格的类型与组装:`ReviewTargetSelector`(同目录 tsx)产出
//     `ReviewSourceSelection`(uncommitted / file / snippet 三源),发送层据此组装
//     本轮 review 上下文。
//
// 单一真相源纪律:
//   · 单轮内联上限**不另立第二份** —— 直接 import slash 通道的 `REVIEW_DIFF_LIMIT`
//     (12000);若该导出改名,typecheck 会在此处炸,属于预期的协同信号;
//   · uncommitted 档**不复制收集实现** —— `toReviewSlashText` 把它降维成已落地的
//     `/review uncommitted` 文本,走 `tryHandleReviewTargetSlash` 同一条腿收集 diff;
//   · file / snippet 档 slash 通道没有,由 `buildReviewContextInline` 组装内联块,
//     指令句形态与 slash 通道 `buildReviewTargetPrompt` 同族("Report findings with
//     path:line anchors");三档严重度分级判定归服务端 review prompt,前端不抄。
//
// ==== 接线 TODO(send-message.ts 持有席接,本席不碰该文件)====
// 1) 挂载:`message-input.tsx` 在输入框上方(与 InputNoticeBanner 同区)条件渲染
//    `<ReviewTargetSelector visible={currentMode === 'review'} …/>`;selection 状态由
//    输入层持有(或经 props 上抛给 use-chat),随窗格隔离(参照 mode store 的窗格分家)。
// 2) 发送:`send-message.ts` 的 `tryHandleReviewTargetSlash` 调用点(:209 邻域)之前,
//    若 selection ready(`isReviewSelectionReady`):
//      · `toReviewSlashText(selection)` 命中(uncommitted)⇒ 把发送文本改写为该
//        slash 命令,复用既有拦截链(勿在发送层重跑 git);
//      · 其余(file/snippet)⇒ `buildReviewContextInline` 追加到 llmText 尾部
//        (与 appendDiffComments 同一位置、同一"只影响发给 LLM 的内容"纪律);
//      · 发送成功后清空 selection(与 pendingDiffComments 清空同批)。
// 3) file 档收集:走 `@ihui/api-client` 的 `readFile({ path, workspacePath })`
//    (ide-workspace.ts:320 同一实现),只读;读不到 ⇒ 明说,不静默发空审查。

import { REVIEW_DIFF_LIMIT } from '@/hooks/use-chat/slash-commands'

/** 审查对象三源:工作区未提交改动 / 指定文件 / 粘贴片段。 */
export type ReviewSourceKind = 'uncommitted' | 'file' | 'snippet'

/**
 * UI 选择条的产出(受控值;`ReviewTargetSelector` 全受控,状态住调用方)。
 * - uncommitted:value 恒 null(diff 由 slash 通道收集);
 * - file:value = 工作区相对路径(收集由接线层 readFile);
 * - snippet:value = 粘贴的代码片段原文。
 */
export interface ReviewSourceSelection {
  kind: ReviewSourceKind
  value: string | null
}

/**
 * uncommitted 档降维成已落地的 slash 命令文本(单一收集实现);file/snippet 档
 * slash 通道不支持 ⇒ 返回 null,由 `buildReviewContextInline` 接手。
 */
export function toReviewSlashText(selection: ReviewSourceSelection): string | null {
  if (selection.kind === 'uncommitted') return '/review uncommitted'
  return null
}

/** 选择是否已可随请求消费(uncommitted 即选即用;file/snippet 须有非空内容)。 */
export function isReviewSelectionReady(selection: ReviewSourceSelection | null): boolean {
  if (!selection) return false
  if (selection.kind === 'uncommitted') return true
  return (selection.value ?? '').trim().length > 0
}

function reviewSourceLabel(selection: ReviewSourceSelection): string {
  if (selection.kind === 'file') return `file ${selection.value?.trim()}`
  if (selection.kind === 'snippet') return 'pasted snippet'
  return 'uncommitted changes'
}

/**
 * file / snippet 档发给模型的内联审查上下文(形态与 slash 通道
 * `buildReviewTargetPrompt` 同族:指令句 + 代码块 + 超限截断点名)。
 * uncommitted 档传入时返回空串(该档必须走 `toReviewSlashText` 的 slash 通道)。
 */
export function buildReviewContextInline(selection: ReviewSourceSelection): string {
  if (selection.kind === 'uncommitted') return ''
  const content = (selection.value ?? '').trim()
  if (!content) return ''
  const clipped = content.length > REVIEW_DIFF_LIMIT
  const body = clipped ? content.slice(0, REVIEW_DIFF_LIMIT) : content
  return [
    `Review the ${reviewSourceLabel(selection)} below. Report findings with path:line anchors.`,
    ...(clipped
      ? [
          `[snippet truncated at ${REVIEW_DIFF_LIMIT} characters; ` +
            `${content.length - REVIEW_DIFF_LIMIT} characters omitted]`,
        ]
      : []),
    '',
    // 路径已在上方指令句点名(reviewSourceLabel);fence 语言位不猜(内容语言未知)。
    '```',
    body,
    '```',
  ].join('\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
