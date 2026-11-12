// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@ihui/ui-react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PendingQuestion } from '@/stores/chat'
import type {
  QuestionAnswerPayload,
  QuestionResponseAction,
  QuestionResponseStatus,
} from '@/hooks/use-chat/question-response'

/** 卡片终态:answered/withdrawn 由本地提交决定;timeout 由 expiresAt 倒计时决定 */
type CardPhase = 'idle' | 'submitting' | 'answered' | 'withdrawn' | 'timeout'

export interface InlineQuestionCardProps {
  /** 挂起中的提问;null 时不渲染(两种聊天面共用同一组件) */
  question: PendingQuestion | null
  /** 结构化应答:阻塞式端点优先,404/失败自动回退旧链路(见 use-chat/send-answer.ts) */
  onSubmit: (
    response: QuestionAnswerPayload,
  ) => Promise<QuestionResponseStatus | void> | QuestionResponseStatus | void
  className?: string
}

/**
 * 聊天流内联提问卡(2026-11-08 立,替代原 QuestionDialog 弹窗)。
 *
 * 位置:消息列表滚动区尾部(MessageList 的 `trailing` 插槽),**不是** fixed/absolute 浮层、
 * 不是 Dialog/Sheet/Portal —— 因此不遮挡对话、不锁焦点、不拦全局快捷键。
 *
 * 交互:Tab 顺序自然;原生 radio/checkbox 提供 Space 选择,Enter 由本组件补齐;
 * 提交按钮原生可 Enter 触发;Esc(焦点在卡内时)等价「撤回」。
 *
 * 防重:提交中禁用 + `submitLockRef` 同步锁 —— 双击/连按 Enter 只发一次请求。
 *
 * 生命周期:提交后进入本地只读终态,卡片**不消失**;直到 SSE `question-resolved`
 * 结算帧到达,store 摘除 pendingQuestion,卡片才随流移除。
 */
export function InlineQuestionCard({ question, onSubmit, className }: InlineQuestionCardProps) {
  const t = useTranslations('chat.question')
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [customText, setCustomText] = React.useState('')
  const [phase, setPhase] = React.useState<CardPhase>('idle')
  const [submitFailed, setSubmitFailed] = React.useState(false)
  // 同步锁:React 状态更新是异步的,两次点击落在同一批次时只能靠 ref 拦住第二发
  const submitLockRef = React.useRef(false)

  const questionId = question?.questionId ?? null
  const allowMultiple = question?.allowMultiple ?? false
  const allowCustom = question?.allowCustom ?? false

  // 换新提问 → 清空本地作答态(旧卡的失败提示/选中项不得挂到新卡上)
  React.useEffect(() => {
    setSelectedIds([])
    setCustomText('')
    setPhase('idle')
    setSubmitFailed(false)
    submitLockRef.current = false
  }, [questionId])

  // expiresAt(ISO 字符串或毫秒时间戳)存在时走 1s 倒计时;归零 → 超时只读并禁用提交
  const expiresAtMs = React.useMemo(() => {
    const raw = question?.expiresAt
    if (raw === undefined || raw === null) return null
    const ms = typeof raw === 'number' ? raw : Date.parse(raw)
    return Number.isFinite(ms) ? ms : null
  }, [question?.expiresAt])
  const [remainingSeconds, setRemainingSeconds] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (expiresAtMs === null) {
      setRemainingSeconds(null)
      return
    }
    const tick = (): void => {
      const left = expiresAtMs - Date.now()
      setRemainingSeconds(Math.max(0, Math.ceil(left / 1000)))
      if (left <= 0) {
        // 提交中的请求不因倒计时被改成超时——等服务端结果(它自会回 accepted/timeout)
        setPhase((prev) => (prev === 'idle' ? 'timeout' : prev))
      }
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAtMs, questionId])

  if (!question) return null

  const disabled = phase !== 'idle'
  const canAnswer = selectedIds.length > 0 || (allowCustom && customText.trim().length > 0)
  const terminalLabel =
    phase === 'answered'
      ? t('statusAnswered')
      : phase === 'withdrawn'
        ? t('statusWithdrawn')
        : phase === 'timeout'
          ? t('statusTimeout')
          : null

  const selectOption = (optionId: string): void => {
    if (disabled) return
    setSelectedIds((prev) => {
      if (!allowMultiple) return [optionId]
      return prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    })
  }

  // 原生 radio/checkbox 只吃 Space;Enter 由这里补齐(仍按 aria 语义走同一个 select)
  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLElement>, optionId: string): void => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    selectOption(optionId)
  }

  const respond = async (action: QuestionResponseAction): Promise<void> => {
    if (submitLockRef.current || phase !== 'idle') return
    if (action === 'answer' && !canAnswer) return
    submitLockRef.current = true
    setSubmitFailed(false)
    setPhase('submitting')
    const trimmedCustom = customText.trim()
    try {
      const serverStatus = await onSubmit({
        questionId: question.questionId,
        action,
        selectedOptionIds: action === 'withdraw' ? [] : selectedIds,
        ...(action === 'answer' && trimmedCustom ? { customText: trimmedCustom } : {}),
      })
      // 服务端终态优先(如 accepted 但已超时);旧链路/失败回退时返回 void → 按本地动作收尾
      setPhase(serverStatus ?? (action === 'withdraw' ? 'withdrawn' : 'answered'))
    } catch {
      // 失败放开锁,允许原卡直接重试(不重复发请求:上一发已结束)
      submitLockRef.current = false
      setPhase('idle')
      setSubmitFailed(true)
    }
  }

  // Esc 只在焦点位于卡内时冒泡到这里;不注册全局快捷键,避免抢别的面板
  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape' || phase !== 'idle') return
    event.preventDefault()
    event.stopPropagation()
    void respond('withdraw')
  }

  const titleId = `inline-question-title-${question.questionId}`
  const promptId = `inline-question-prompt-${question.questionId}`

  return (
    <section
      aria-labelledby={titleId}
      data-testid="inline-question-card"
      data-question-id={question.questionId}
      data-question-phase={phase}
      // Esc 只拦卡内按键,不注册全局快捷键
      onKeyDownCapture={handleCardKeyDown}
      className={cn(
        'font-[weight:inherit] mx-auto w-full max-w-3xl rounded-lg border border-border/70 bg-card/95 p-3 text-body shadow-elevation-sm',
        'focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20',
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            id={titleId}
            className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {question.header || t('title')}
          </p>
          <p
            id={promptId}
            className="mt-1 whitespace-pre-wrap break-words font-medium leading-relaxed"
          >
            {question.prompt}
          </p>
        </div>
        {terminalLabel && (
          <span
            role="status"
            data-question-terminal={phase}
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[11px]',
              phase === 'timeout'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            )}
          >
            {terminalLabel}
          </span>
        )}
      </div>

      {remainingSeconds !== null && phase === 'idle' && remainingSeconds > 0 && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          {t('expiresIn', { seconds: String(remainingSeconds) })}
        </p>
      )}

      {question.options.length > 0 && (
        <div
          role={allowMultiple ? 'group' : 'radiogroup'}
          aria-labelledby={promptId}
          className="space-y-1.5"
        >
          {question.options.map((option) => {
            const checked = selectedIds.includes(option.id)
            return (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors',
                  checked
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 hover:border-primary/30 hover:bg-accent/40',
                  disabled && 'cursor-default opacity-80',
                  'focus-within:ring-2 focus-within:ring-primary/20',
                )}
              >
                <input
                  type={allowMultiple ? 'checkbox' : 'radio'}
                  name={`inline-question-${question.questionId}`}
                  value={option.id}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => selectOption(option.id)}
                  onKeyDown={(event) => handleOptionKeyDown(event, option.id)}
                  className="mt-0.5 size-3.5 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    {checked && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
                    <span className="break-words">{option.label}</span>
                  </span>
                  {option.description && (
                    <span className="mt-0.5 block break-words text-[12px] text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {allowCustom && (
        <Input
          value={customText}
          onChange={(event) => setCustomText(event.target.value)}
          disabled={disabled}
          placeholder={t('customPlaceholder')}
          aria-label={t('customPlaceholder')}
          data-question-custom-input
          className="mt-2"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void respond('answer')
            }
          }}
        />
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          data-question-withdraw
          onClick={() => void respond('withdraw')}
        >
          {t('withdraw')}
        </Button>
        <div className="flex items-center gap-2">
          {submitFailed && (
            <span role="alert" className="text-[11px] text-destructive">
              {t('responseFailed')}
            </span>
          )}
          <Button
            type="button"
            size="sm"
            disabled={disabled || !canAnswer}
            data-question-submit
            onClick={() => void respond('answer')}
          >
            {phase === 'submitting' && (
              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
            )}
            {phase === 'submitting' ? t('submitting') : t('submit')}
          </Button>
        </div>
      </div>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
