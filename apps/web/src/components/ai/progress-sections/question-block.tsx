'use client'

import * as React from 'react'
import { HelpCircle, Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TraeBlock } from './trae-block'

/**
 * QuestionBlock — Trae Work 风格的"已对用户提问"卡片(2026-07-28 立,深度对标 Trae Work)
 *
 * 设计目标:
 * - 展示 AI 已向用户提出的问题列表
 * - 标记用户的回答(选中态)
 * - 支持折叠/展开
 *
 * 用途:在 message 渲染时,若 message.question 存在,显示该组件
 */

export interface QuestionOption {
  id: string
  label: string
  selected?: boolean
}

interface QuestionBlockProps {
  questionId: string
  prompt: string
  options: QuestionOption[]
  allowCustom?: boolean
  allowMultiple?: boolean
  className?: string
}

export const QuestionBlock = React.memo(function QuestionBlock({
  questionId,
  prompt,
  options,
  allowCustom,
  allowMultiple,
  className,
}: QuestionBlockProps) {
  const selectedCount = options.filter((o) => o.selected).length
  return (
    <TraeBlock
      tone="active"
      title={
        <span className="flex items-center gap-1.5">
          <HelpCircle className="h-3 w-3 text-primary/80" aria-hidden />
          <span>已对用户提问</span>
          {allowMultiple && selectedCount > 0 && (
            <span className="rounded-sm bg-primary/20 px-1 text-[10px] tabular-nums text-primary">
              {selectedCount}/{options.length}
            </span>
          )}
        </span>
      }
      meta={allowMultiple ? '多选' : '单选'}
      className={className}
      testId={`question-block-${questionId}`}
    >
      <p className="break-words py-1 text-[11px] text-foreground/90">{prompt}</p>
      <ul className="space-y-0.5">
        {options.map((opt) => (
          <li
            key={opt.id}
            className={cn(
              'flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-[11px]',
              opt.selected
                ? 'bg-primary/10 text-foreground/90'
                : 'text-muted-foreground hover:bg-accent/30',
            )}
          >
            <span
              className={cn(
                'inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border',
                opt.selected
                  ? 'border-primary/60 bg-primary/20 text-primary'
                  : 'border-muted-foreground/30',
              )}
              aria-hidden
            >
              {opt.selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            <span className="flex-1 break-words">{opt.label}</span>
            {opt.selected && <ChevronRight className="h-2.5 w-2.5 text-primary/60" aria-hidden />}
          </li>
        ))}
        {allowCustom && (
          <li className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-[11px] text-muted-foreground">
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-muted-foreground/30 border-dashed" />
            <span className="italic">自定义回答</span>
          </li>
        )}
      </ul>
    </TraeBlock>
  )
})
