'use client'

import * as React from 'react'
import { HelpCircle, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TraeBlock } from './trae-block'

export interface QuestionBlockItem {
  id: string
  question: string
  options: Array<{ id: string; label: string }>
  multiSelect?: boolean
  userAnswer?: string | string[] | null
  answered?: boolean
}

interface QuestionBlockProps {
  questions: QuestionBlockItem[]
  className?: string
  defaultCollapsed?: boolean
  'data-testid'?: string
}

const QuestionRow = React.memo(function QuestionRow({ q }: { q: QuestionBlockItem }) {
  const answered = q.answered === true
  const answerIds = answered
    ? Array.isArray(q.userAnswer)
      ? q.userAnswer
      : q.userAnswer
        ? [q.userAnswer]
        : []
    : []
  const optionLabelById = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const opt of q.options) m.set(opt.id, opt.label)
    return m
  }, [q.options])

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1.5 text-[11px] leading-snug">
        {answered ? (
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
        ) : (
          <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-primary" aria-hidden />
        )}
        <span className="flex-1 break-all text-foreground/90">{q.question}</span>
      </div>
      <ul className="ml-4 space-y-0.5">
        {q.options.map((opt) => {
          const isSelected = answerIds.includes(opt.id)
          return (
            <li
              key={opt.id}
              className={cn(
                'flex items-center gap-1 text-[10px]',
                isSelected ? 'text-foreground/90' : 'text-muted-foreground/60',
              )}
            >
              <span
                className={cn(
                  'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                  isSelected ? 'bg-primary' : 'bg-muted-foreground/40',
                )}
                aria-hidden
              />
              <span className={cn(isSelected && 'font-medium')}>
                {opt.label}
                {isSelected && (
                  <span className="ml-1 text-[9px] text-emerald-500" aria-label="已选择">
                    ✓
                  </span>
                )}
              </span>
            </li>
          )
        })}
        {answered &&
          answerIds
            .filter((id) => !optionLabelById.has(id))
            .map((id) => (
              <li
                key={`custom-${id}`}
                className="flex items-center gap-1 text-[10px] text-foreground/90"
              >
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  aria-hidden
                />
                <span className="font-medium">{id}</span>
                <span className="text-[9px] text-emerald-500">✓</span>
              </li>
            ))}
      </ul>
    </div>
  )
})

export const QuestionBlock = React.memo(function QuestionBlock({
  questions,
  className,
  defaultCollapsed = false,
  'data-testid': testId,
}: QuestionBlockProps) {
  if (questions.length === 0) return null
  const allAnswered = questions.every((q) => q.answered === true)
  const tone = allAnswered ? 'success' : 'active'
  const title = allAnswered ? '已对用户提问' : '正在询问用户…'
  const meta = `${questions.filter((q) => q.answered).length}/${questions.length}`

  return (
    <TraeBlock
      tone={tone}
      title={title}
      icon={<HelpCircle className="h-3 w-3" aria-hidden />}
      meta={meta}
      defaultCollapsed={defaultCollapsed}
      className={className}
    >
      <div className="space-y-2" data-testid={testId ?? 'question-block'}>
        {questions.map((q) => (
          <QuestionRow key={q.id} q={q} />
        ))}
      </div>
    </TraeBlock>
  )
})

export default QuestionBlock
