'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
} from '@ihui/ui'
import type { PendingQuestion } from '@/stores/chat'
import { cn } from '@/lib/utils'

interface QuestionDialogProps {
  /** 当前挂起的提问;为 null 时弹窗关闭 */
  question: PendingQuestion | null
  /** 用户提交答案(选项 label 或自定义文本,多选已合并为字符串) */
  onSubmit: (answer: string) => void
  /** 用户跳过提问(点 X / Esc / 点遮罩) */
  onSkip: () => void
}

/**
 * AI 主动提问弹窗。
 *
 * 收到 SSE question 事件后由 chat store 触发,挂起对话直到用户回答。
 * - 单选(allowMultiple=false):点击选项立即提交
 * - 多选(allowMultiple=true):勾选后点"提交"按钮
 * - allowCustom=true:展示自定义输入框,Enter 提交
 * - 关闭弹窗 = 跳过提问,不续流 LLM
 */
export function QuestionDialog({ question, onSubmit, onSkip }: QuestionDialogProps) {
  const t = useTranslations('chat.question')
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [customInput, setCustomInput] = React.useState('')

  // 切换 question 时重置内部状态
  React.useEffect(() => {
    if (question) {
      setSelectedIds(new Set())
      setCustomInput('')
    }
  }, [question?.questionId])

  if (!question) return null

  const { prompt, options, allowCustom, allowMultiple } = question

  const toggleOption = (id: string) => {
    if (!allowMultiple) {
      // 单选:直接选中并提交
      const opt = options.find((o) => o.id === id)
      if (opt) onSubmit(opt.label)
      return
    }
    // 多选:toggle 选中
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = () => {
    const selectedLabels = options
      .filter((o) => selectedIds.has(o.id))
      .map((o) => o.label)
    const trimmedCustom = customInput.trim()
    // 自定义输入优先级高于选项;两者都有时合并
    const parts = [...selectedLabels]
    if (trimmedCustom) parts.push(trimmedCustom)
    if (parts.length === 0) return
    onSubmit(parts.join(', '))
  }

  const handleSubmitCustom = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const trimmed = customInput.trim()
      if (!trimmed) return
      // 自定义输入直接提交(单选语义,忽略已选项)
      onSubmit(trimmed)
    }
  }

  const canSubmit =
    allowMultiple || (allowCustom && customInput.trim().length > 0)
  const submitLabel = allowMultiple
    ? t('submit') + (selectedIds.size > 0 ? ` (${selectedIds.size})` : '')
    : t('submit')

  return (
    <Dialog open={!!question} onOpenChange={(open) => !open && onSkip()}>
      <DialogContent className="max-w-md gap-3 p-5">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">{t('title')}</DialogTitle>
          <DialogDescription className="text-xs">
            {allowMultiple ? t('multiSelectHint') : t('selectHint')}
          </DialogDescription>
        </DialogHeader>

        {/* AI 提问内容 */}
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {prompt}
          </p>
        </div>

        {/* 选项列表 */}
        {options.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {options.map((opt) => {
              const selected = selectedIds.has(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleOption(opt.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    selected
                      ? 'border-primary/30 bg-primary/5 text-foreground'
                      : 'border-border bg-background text-foreground hover:bg-accent hover:border-accent-foreground/20',
                  )}
                >
                  <span className="flex-1 break-words">{opt.label}</span>
                  {selected && (
                    <Check className="ml-2 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* 自定义输入框 */}
        {allowCustom && (
          <Input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleSubmitCustom}
            placeholder={t('customPlaceholder')}
            className="h-9 text-sm"
            aria-label={t('customPlaceholder')}
          />
        )}

        {/* 底部操作区:跳过(左) + 提交(右) */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t('skip')}
          </Button>
          {allowMultiple && (
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              <span>{submitLabel}</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
