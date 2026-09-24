// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D64 ⑤(G-82,2026-09-24 立)—— 反馈**问卷化**卡。
//
// 现状自证:D49① 的反馈是右键菜单里的点赞/点踩 + `toast.success('toast.feedbackSaved')`
// 兜底(`apps/web/src/components/chat/message-list/use-message-list-context-menu.tsx:127`),
// 只有一枚布尔票,**没有任何"有没有帮上忙"的结构化信息**。本卡把它升成三选问题
// 「这次回复有没有帮你解决问题?」+ 可选评论 + 可跳过。
//
// **两条边界(刻意为之)**:
// 1. **不取数、不落库**:判据 `feedbackSurveyPayload` 只产载荷,**发不发、发到哪**由宿主
//    (`onSubmit`)决定。现有端点 `/api/chat/messages/feedback` 仅收
//    `{ messageId, rating:'like'|'dislike' }`(`packages/api-client/src/endpoints/chat.ts:545`),
//    三选 + 评论 + 跳过**无处可落** → 建端点/加字段属后端另票,本卡不自行开。
// 2. **免打扰判定在判定层**:`shouldShowSurvey`(已答过 / 已问过 / 失败轮次 → 一律不弹),
//    端内不写第二套;「问过」这件事的持久化归宿主(`onAsked`)。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  FEEDBACK_SURVEY_STATE,
  SURVEY_ANSWERS,
  feedbackSurveyPayload,
  shouldShowSurvey,
  surveyAnswerKey,
  type FeedbackSurveyContext,
  type FeedbackSurveyPayload,
  type SurveyAnswer,
} from '@ihui/shared/chat/element-pack'

export interface FeedbackSurveyCardProps {
  /** 被评价的那条回复的 id(空/空白 ⇒ 判定层拒建载荷,本卡不渲染) */
  messageId: string
  /** 免打扰判据三元组(已答过 / 本会话已问过 / 失败轮次) */
  context: FeedbackSurveyContext
  /** 提交回调:宿主负责落库与记「已问过」;本卡不直接打接口 */
  onSubmit?: (payload: FeedbackSurveyPayload) => void
  className?: string
  'data-testid'?: string
}

export function FeedbackSurveyCard({
  messageId,
  context,
  onSubmit,
  className,
  'data-testid': testId = 'feedback-survey-card',
}: FeedbackSurveyCardProps) {
  const t = useTranslations('ai.pane.elementPack')
  const [answer, setAnswer] = React.useState<SurveyAnswer | null>(null)
  const [comment, setComment] = React.useState<string>('')
  const [done, setDone] = React.useState<boolean>(false)

  // 判定层说不该问(已答 / 已问过 / 失败轮次),或载荷根本建不出来(空 messageId)⇒ 不渲染
  if (!shouldShowSurvey(context)) return null
  if (!feedbackSurveyPayload({ messageId })) return null

  const submit = (skipped: boolean) => {
    const payload = feedbackSurveyPayload({
      messageId,
      answer: skipped ? null : answer,
      comment: skipped ? null : comment,
      skipped,
    })
    if (!payload) return
    setDone(true)
    onSubmit?.(payload)
  }

  if (done) {
    return (
      <p
        className={cn('text-[11px] text-muted-foreground', className)}
        data-testid={testId}
        data-feedback-survey="submitted"
      >
        {t(FEEDBACK_SURVEY_STATE.submittedKey)}
      </p>
    )
  }

  return (
    <div
      role="group"
      aria-label={t(FEEDBACK_SURVEY_STATE.questionKey)}
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-feedback-survey="open"
    >
      <p
        className="text-xs font-medium"
        data-feedback-survey-question="true"
        data-testid="feedback-survey-question"
      >
        {t(FEEDBACK_SURVEY_STATE.questionKey)}
      </p>

      <div className="flex flex-wrap gap-1" role="radiogroup" data-feedback-survey-options="true">
        {SURVEY_ANSWERS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={answer === option}
            data-feedback-answer={option}
            onClick={() => setAnswer(option)}
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-[11px] transition-colors',
              answer === option
                ? 'bg-primary/15 text-primary'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(surveyAnswerKey(option))}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t(FEEDBACK_SURVEY_STATE.commentKey)}
        aria-label={t(FEEDBACK_SURVEY_STATE.commentKey)}
        className="h-7 rounded-sm bg-background px-1.5 text-[11px] outline-none placeholder:text-muted-foreground/60"
        data-feedback-comment="true"
      />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={answer === null}
          data-feedback-action="submit"
          className={cn(
            'rounded-sm px-1.5 py-0.5 text-[11px] transition-colors',
            answer === null
              ? 'cursor-not-allowed bg-muted/40 text-muted-foreground/50'
              : 'bg-primary/15 text-primary hover:bg-primary/25',
          )}
        >
          {t(FEEDBACK_SURVEY_STATE.submitKey)}
        </button>
        {/* 可跳过:明确记「未答」而不是假装答过 */}
        <button
          type="button"
          onClick={() => submit(true)}
          data-feedback-action="dismiss"
          className="rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          {t(FEEDBACK_SURVEY_STATE.dismissKey)}
        </button>
      </div>
    </div>
  )
}

export default FeedbackSurveyCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
