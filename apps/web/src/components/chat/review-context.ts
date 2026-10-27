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
//     `ReviewSourceSelection`(票面三目标 uncommitted / branch / commit + file / snippet 两档
//     补充),发送层据此组装本轮 review 上下文。
//
// 单一真相源纪律:
//   · 单轮内联上限**不另立第二份** —— 直接 import slash 通道的 `REVIEW_DIFF_LIMIT`
//     (12000);若该导出改名,typecheck 会在此处炸,属于预期的协同信号;
//   · 改动的三个 git 目标(uncommitted / branch / commit)**不复制收集实现** ——
//     `toReviewSlashText` 把它们降维成已落地的 `/review uncommitted|branch <ref>|commit <sha>`
//     文本,走 `tryHandleReviewTargetSlash` 同一条腿只读收集 diff;ref 形状(分支/SHA)
//     也直接问 slash 通道的 `parseReviewTargetArgs`,本文件不复制正则;
//   · file / snippet 档 slash 通道没有,由 `buildReviewContextInline` 组装内联块,
//     指令句形态与 slash 通道 `buildReviewTargetPrompt` 同族("Report findings with
//     path:line anchors");三档严重度分级判定归服务端 review prompt,前端不抄。
//
// ==== 接线现状(2026-10-27 装车)====
// 挂载:`message-input.tsx` 在输入卡内、`<div ref={inputAreaRef}>` 之前条件渲染
//   `<ReviewTargetSelector visible={currentMode === 'review'} …/>`(档位取
//   `usePaneModeStore()`,随窗格隔离);selection 住输入层 state。
// 发送(全在 `message-input.tsx` 的 `submitAndDismissLinkPreview` 里,经
// `./review-target-send.ts` 的 `planReviewSend` 出唯一判定):
//   · slash 档(uncommitted / branch / commit)⇒ 本轮正文改写为 slash 命令,交给
//     `send-message.ts` 既有的 `tryHandleReviewTargetSlash` 拦截链收集 diff;用户已输入的
//     正文不会被吞(发送后回填输入框,不静默丢稿);
//   · file / snippet 档 ⇒ `buildReviewContextInline` 追加到正文尾部(只影响发给 LLM 的正文);
//   · 发送 resolve 后清空 selection(失败回填正文时保留,避免重发还要重选)。
// 遗留(不属本席可改面):把 selection 直接并进 `llmText`、以及成功位回传,归
//   `send-message.ts` 持有席;当前实现不改 hooks/use-chat 任何文件。
// 已知弱点(票面三目标之外,本席未扩面):file 档目前把输入值原样当片段内联,**不**读文件内容;
//   要补须在接线层走 `readFile({ path, workspacePath })` 只读取文,并在读不到时明说不静默发。

import { parseReviewTargetArgs, REVIEW_DIFF_LIMIT } from '@/hooks/use-chat/slash-commands'

/**
 * 审查对象来源五档:
 * - `uncommitted` / `branch` / `commit` = 票面「审查对象选择器」的三类目标(只读 git 收集);
 * - `file` / `snippet` = 无 git 目标的补充两档(内联片段)。
 */
export type ReviewSourceKind = 'uncommitted' | 'branch' | 'commit' | 'file' | 'snippet'

/** 需经 slash 通道做只读 git 收集的三档(票面三类目标)。 */
export type ReviewGitTargetKind = 'uncommitted' | 'branch' | 'commit'

/**
 * UI 选择条的产出(受控值;`ReviewTargetSelector` 全受控,状态住调用方)。
 * - uncommitted:value 恒 null(diff 由 slash 通道收集);
 * - branch:value = 分支名(收集由 slash 通道 `git diff <ref>...HEAD`);
 * - commit:value = SHA(收集由 slash 通道 `git show <sha>`);
 * - file:value = 工作区相对路径(内容由接线层收集,见头注已知弱点);
 * - snippet:value = 粘贴的代码片段原文。
 */
export interface ReviewSourceSelection {
  kind: ReviewSourceKind
  value: string | null
}

/** slash 通道支持的三档(判定单一入口,供 UI/组装层共用)。 */
function isGitTargetKind(kind: ReviewSourceKind): kind is ReviewGitTargetKind {
  return kind === 'uncommitted' || kind === 'branch' || kind === 'commit'
}

/**
 * git 目标档降维成已落地的 slash 命令文本(单一收集实现);file/snippet 档
 * slash 通道不支持 ⇒ 返回 null,由 `buildReviewContextInline` 接手。
 * branch/commit 的 ref 形状直接问 slash 通道的 `parseReviewTargetArgs`(不复制正则):
 * 非法 ref 返回 null —— 宁可这一轮不带目标,也不把畸形命令发进收集链。
 */
export function toReviewSlashText(selection: ReviewSourceSelection): string | null {
  if (selection.kind === 'uncommitted') return '/review uncommitted'
  if (selection.kind === 'branch' || selection.kind === 'commit') {
    const ref = (selection.value ?? '').trim()
    if (!ref) return null
    return parseReviewTargetArgs(`${selection.kind} ${ref}`)
      ? `/review ${selection.kind} ${ref}`
      : null
  }
  return null
}

/** 选择是否已可随请求消费(uncommitted 即选即用;其余须有非空且合法的值)。 */
export function isReviewSelectionReady(selection: ReviewSourceSelection | null): boolean {
  if (!selection) return false
  if (isGitTargetKind(selection.kind)) return toReviewSlashText(selection) !== null
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
 * 三个 git 目标档传入时返回空串(必须走 `toReviewSlashText` 的 slash 通道)。
 */
export function buildReviewContextInline(selection: ReviewSourceSelection): string {
  if (isGitTargetKind(selection.kind)) return ''
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
