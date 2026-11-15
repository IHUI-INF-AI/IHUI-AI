// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '../../../src/i18n'

/**
 * 扩展侧栏「AI 主动提问」卡(2026-11-13 立)。
 *
 * 链路事实:ai-service 在工具循环里需要用户澄清时,发一帧 SSE `question`(阻塞式),
 * **流挂着等你答**;答复必须 POST 到 `/llm/complete/stream/:sessionId/question-response`
 * 才会续跑,否则等到超时按 `timeout` 收场。本端此前对该帧 0 命中 —— 提问卡整条闭环缺失,
 * AI 想问用户时侧栏毫无动静,而那一条流已经卡住。
 *
 * 与 `ToolApprovalBanner` 同构(两者都是"卡住等用户输入"的场景),所以沿用它的两条纪律:
 *  ① **注入式**:本组件不 import 传输层,回传由宿主 `onRespond` 注入 ⇒ 判据可在 node 环境纯测;
 *  ② **缺 sessionId 时渲染技术标识而非猜一个**:没有会话主键就寻址不到端点,编一个只会更糟。
 *
 * 判据(什么算"能提交")留在纯函数里:`canSubmitQuestionAnswer` / `buildAnswerSelection`,
 * 与共享层 `@ihui/shared/chat/question-response` 的端点契约同源 —— 端内不复制字段名。
 */

/** 提问卡载荷(与后端 `Question.to_dict()` 及共享 sse-parse 的 questionResolved 同形) */
export interface PendingQuestionPayload {
  questionId: string
  prompt: string
  options: Array<{ id: string; label: string }>
  /** 允许自行输入(选项之外) */
  allowCustom: boolean
  /** 允许多选 */
  allowMultiple: boolean
}

/** 卡片可渲染的最小上下文:提问本体 + 寻址会话 */
export interface QuestionCardModel {
  question: PendingQuestionPayload
  /** 归属会话;缺省 ⇒ 无法寻址端点,渲染技术标识而不是猜 */
  sessionId?: string
}

/**
 * 能否提交:撤回永远可以(用户有权关掉);作答必须至少选一项或填了自定义文本。
 * 纯函数,可在 node 环境直接测。
 */
export function canSubmitQuestionAnswer(input: {
  action: 'answer' | 'withdraw'
  selectedOptionIds: readonly string[]
  customText?: string
  submitting?: boolean
}): boolean {
  if (input.submitting === true) return false
  if (input.action === 'withdraw') return true
  if (input.selectedOptionIds.length > 0) return true
  return (input.customText ?? '').trim().length > 0
}

/**
 * 点选行为:单选时替换、多选时切换。
 * 抽成纯函数是因为"单选却点出两个 id"会让服务端把答案读成多选 —— 静默给错语义。
 */
export function toggleOptionSelection(
  current: readonly string[],
  optionId: string,
  allowMultiple: boolean,
): string[] {
  if (!allowMultiple) {
    // 单选:再点一次同一项 = 取消(否则用户无法改主意)
    return current.length === 1 && current[0] === optionId ? [] : [optionId]
  }
  return current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : [...current, optionId]
}

export interface QuestionCardProps {
  model: QuestionCardModel
  selectedOptionIds: readonly string[]
  customText: string
  submitting: boolean
  onToggleOption: (optionId: string) => void
  onCustomTextChange: (text: string) => void
  onSubmit: () => void
  onWithdraw: () => void
}

/**
 * 提问卡本体。样式沿用侧栏既有卡片语言(与 ToolApprovalBanner 同一族),
 * 不新立视觉体系。
 */
export function QuestionCard({
  model,
  selectedOptionIds,
  customText,
  submitting,
  onToggleOption,
  onCustomTextChange,
  onSubmit,
  onWithdraw,
}: QuestionCardProps) {
  const { t } = useI18n()
  const { question, sessionId } = model
  const canSubmit = canSubmitQuestionAnswer({
    action: 'answer',
    selectedOptionIds,
    customText,
    submitting,
  })

  return (
    <div className="bg-cta/10 text-primary px-2.5 py-2 rounded-md border border-brand-accent-deep my-2 text-xs">
      <div className="font-medium">{t('chat.questionTitle')}</div>
      <div className="mt-1 whitespace-pre-wrap">{question.prompt}</div>
      {/* 缺会话主键:渲染技术标识(可搜),不猜一个端点地址 —— 与 ToolApprovalBanner 同纪律 */}
      {sessionId ? null : (
        <div className="mt-1 text-destructive" data-testid="question-no-session">
          {t('chat.questionNoSession')}
        </div>
      )}
      <div className="mt-2 space-y-1">
        {question.options.map((opt) => {
          const checked = selectedOptionIds.includes(opt.id)
          return (
            <button
              key={opt.id}
              type="button"
              className={`block w-full text-left px-2 py-1 rounded border ${
                checked ? 'border-brand-accent-deep bg-cta/10' : 'border-border'
              }`}
              onClick={() => onToggleOption(opt.id)}
              disabled={submitting}
              aria-pressed={checked}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {question.allowCustom ? (
        <textarea
          className="mt-2 w-full px-2 py-1 rounded border border-border bg-surface"
          rows={2}
          placeholder={t('chat.questionCustomPlaceholder')}
          value={customText}
          onChange={(e) => onCustomTextChange(e.target.value)}
          disabled={submitting}
        />
      ) : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="px-2 py-1 rounded bg-cta text-cta-foreground disabled:opacity-50"
          onClick={onSubmit}
          disabled={!canSubmit || !sessionId}
        >
          {submitting ? t('chat.questionSubmitting') : t('chat.questionSubmit')}
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded border border-border disabled:opacity-50"
          onClick={onWithdraw}
          disabled={submitting}
        >
          {t('chat.questionWithdraw')}
        </button>
      </div>
      {question.allowMultiple ? (
        <div className="mt-1 text-muted-foreground">{t('chat.questionMultiHint')}</div>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
