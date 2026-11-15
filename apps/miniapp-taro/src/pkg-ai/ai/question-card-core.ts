// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D135(2026-11-14):小程序 AI 提问卡阻塞式答复编排 —— 与 web/RN 三端对等。
//
// 此前小程序提问卡只有最小可视态(选项写回输入框→用户点发送续流),缺阻塞式答复 POST /
// 结算帧摘卡 / 多选自由输入 / legacy 回退。本模块补齐**纯编排逻辑**(不碰 React、不碰
// Taro 组件),UI 在 chat-shell-extras.tsx 的 overlaySlot。
//
// 判定层**一行不重写**:响应形状处置 + 旧链路文本构造取 @ihui/shared/chat/question-response
// (web/RN 同一份,§0.6 单一真相源)。本文件只做小程序端的 HTTP 绑定 + 状态归约。

import {
  buildLegacyAnswerText,
  interpretQuestionResponse,
  questionResponsePath,
  type QuestionAnswerPayload,
  type QuestionResponseAction,
  type QuestionResponseStatus,
} from '@ihui/shared/chat/question-response'

export type { QuestionAnswerPayload, QuestionResponseAction, QuestionResponseStatus }

/** 提问卡待决条目(小程序端状态;字段与 web PendingQuestion 同族,不依赖具体 store 类型) */
export interface MiniQuestionEntry {
  questionId: string
  prompt: string
  options: Array<{ id: string; label: string }>
  allowCustom: boolean
  allowMultiple: boolean
  /** 卡片小标题(新帧可选;旧帧没有) */
  header?: string
  /** 答复截止时间(ISO 或毫秒;有则卡片走倒计时/超时只读) */
  expiresAt?: string | number
  /** 阻塞式提问所属的 ai-service 流会话 ID(旧帧没有 ⇒ 无阻塞式通道,如实走 legacy) */
  sessionId?: string
}

/** 卡片本地作答态:单选/多选选中项 + 自由输入 */
export interface MiniQuestionAnswer {
  selectedIds: string[]
  customText: string
}

/** 卡片提交相位:idle → submitting → 终态(answered/withdrawn/timeout);failed 可重试 */
export type MiniQuestionPhase =
  'idle' | 'submitting' | 'answered' | 'withdrawn' | 'timeout' | 'failed'

/** 编排结果:调用方据此更新 UI 相位(本模块不改 React 状态) */
export type MiniQuestionOutcome =
  | { kind: 'blocking'; status: QuestionResponseStatus }
  | { kind: 'legacy'; legacyText: string }
  | { kind: 'failed'; message: string }

/**
 * 提交/撤回一个阻塞式答复。
 * - `submitLock` 传调用方持有的防重锁;锁住或非 idle 相位 ⇒ 直接返回 null(双击只发一次)。
 * - answer 且无选中项且无自由输入 ⇒ 直接返回 null(无可提交内容)。
 * - 帧带 sessionId ⇒ 投阻塞式端点;404/失败回退旧链路(把答复文本交宿主 sendMessage 续流)。
 * - 帧无 sessionId ⇒ 阻塞式不可用,如实走旧链路(不猜一个会话发出去)。
 * - 返回 null = 未发起任何请求(调用方不更新相位);否则返回处置结果。
 */
export async function respondMiniQuestion(args: {
  entry: MiniQuestionEntry
  action: QuestionResponseAction
  answer: MiniQuestionAnswer
  phase: MiniQuestionPhase
  submitLock: boolean
  /** 旧链路回退:把答复文本交宿主发起回答续流(宿主复用 sendMessage,本层不复制)。 */
  sendLegacyAnswer: (text: string) => Promise<void>
  /** HTTP 出口(fetchAiServiceJson),由调用方注入以便单测替身。 */
  postJson: <T>(
    path: string,
    init: { method: string; body: string },
  ) => Promise<{ success: boolean; status?: number; error?: string; data?: T }>
}): Promise<MiniQuestionOutcome | null> {
  const { entry, action, answer, phase, submitLock, sendLegacyAnswer, postJson } = args
  if (submitLock || phase !== 'idle') return null
  const selectedIds = action === 'withdraw' ? [] : answer.selectedIds
  if (action === 'answer' && selectedIds.length === 0 && !answer.customText.trim()) return null

  const payload: QuestionAnswerPayload = {
    questionId: entry.questionId,
    action,
    selectedOptionIds: selectedIds,
    ...(action === 'answer' && answer.customText.trim()
      ? { customText: answer.customText.trim() }
      : {}),
  }

  let settled: QuestionResponseStatus | 'legacy' | 'failed' = 'failed'
  if (entry.sessionId) {
    try {
      const result = await postJson<{
        accepted?: boolean
        status?: string
        duplicate?: boolean
      }>(questionResponsePath(entry.sessionId), {
        method: 'POST',
        body: JSON.stringify({
          questionId: payload.questionId,
          action: payload.action,
          selectedOptionIds: payload.selectedOptionIds,
          ...(payload.customText ? { customText: payload.customText } : {}),
        }),
      })
      if (!result.success) {
        settled = result.status === 404 ? 'legacy' : 'failed'
      } else {
        const outcome = interpretQuestionResponse(result.status, result.data)
        if (outcome.kind === 'failed') settled = 'failed'
        else if (outcome.kind === 'legacy') settled = 'legacy'
        else settled = outcome.status
      }
    } catch {
      settled = 'failed'
    }
  } else {
    // 无 sessionId = 阻塞式不可用,如实走旧链路(不猜会话发出去)
    settled = 'legacy'
  }

  if (settled === 'failed') return { kind: 'failed', message: 'question-response failed' }
  if (settled === 'legacy') {
    if (action !== 'withdraw') {
      await sendLegacyAnswer(buildLegacyAnswerText(entry, payload))
    }
    return { kind: 'legacy', legacyText: '' }
  }
  return { kind: 'blocking', status: settled }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
