'use client'

/**
 * QuestionBlock — Trae Work 风格"已对用户提问"inline 卡片(2026-07-28 立,Phase 18.3)
 *
 * 截图特征:
 * - 折叠标题 "已对用户提问 ▼"
 * - 问题列表:每条问题 + 选项列表 + 用户选择(✓ 标记)
 * - 浅色背景 + 左侧紫色/蓝色强调条 + 问号 icon
 *
 * 用法:在 MessageList 的最后一条 AI 消息下方渲染(若有 pendingQuestion),
 * 或在历史消息中展示已回答的问题 + 用户选项。
 */

import * as React from 'react'
import { HelpCircle, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { TraeBlock } from './trae-block'
import type { PendingQuestion, QuestionOption } from '@/stores/chat'

interface QuestionBlockProps {
  question: PendingQuestion
  /** 用户的答案(option id 列表,空数组表示未回答) */
  answer?: string[]
  /** 自定义文字(可选) */
  className?: string
}

export const QuestionBlock = React.memo(function QuestionBlock({
  question,
  answer,
  className,
}: QuestionBlockProps) {
  const t = useTranslations('ai.question')
  const answered = answer && answer.length > 0

  // 构造 checked items 列表(用户选择 + 问题)
  const items = React.useMemo(() => {
    const list: Array<{
      index: number
      title: string
      evidence?: string
      passed: boolean
    }> = []
    question.options.forEach((opt, idx) => {
      const isSelected = answer?.includes(opt.id) ?? false
      list.push({
        index: idx + 1,
        title: opt.label,
        evidence: isSelected ? t('selected') : t('option'),
        passed: isSelected,
      })
    })
    return list
  }, [question.options, answer, t])

  return (
    <TraeBlock
      tone="accent"
      icon={<HelpCircle className="h-3 w-3 text-primary" aria-hidden />}
      title={t('title')}
      subtitle={answered ? t('answered') : t('pending')}
      className={className}
      data-testid="trae-question-block"
    >
      <div className="space-y-1.5">
        <div className="text-foreground/90 break-words">{question.prompt}</div>
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.index} className="flex items-start gap-1.5">
              <span
                className={cn(
                  'mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full',
                  item.passed
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted-foreground/10 text-muted-foreground/50',
                )}
                aria-hidden
              >
                {item.passed ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  <span className="text-[9px] font-bold leading-none">
                    {item.index}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'flex-1 break-words',
                  item.passed
                    ? 'font-medium text-foreground/90'
                    : 'text-muted-foreground/80',
                )}
              >
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </TraeBlock>
  )
})

/** Phase 18.3: 快速构造 QuestionOption(供测试或外部使用) */
export function makeOption(id: string, label: string): QuestionOption {
  return { id, label }
}
