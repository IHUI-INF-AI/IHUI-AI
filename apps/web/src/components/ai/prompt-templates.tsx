'use client'

import { FileText } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Template {
  id: string
  name: string
  content: string
  category?: string
}

interface PromptTemplatesProps {
  templates: Template[]
  onSelect: (content: string) => void
  /**
   * 展示形态:
   * - `popover`(默认): 紧凑卡片网格,用于附加栏弹窗。每行 2 列,卡片含图标+名称+内容预览。
   * - `chips`: 水平胶囊按钮,用于空状态引导。仅显示图标+名称,hover 用原生 title 展示完整内容。
   */
  variant?: 'popover' | 'chips'
}

/**
 * 提示词模板展示组件。
 * - 同一数据源两种视觉:附加栏弹窗(popover)与空状态引导(chips)共用 5 个核心模板。
 * - 旧 `category` 分组逻辑已移除:模板源统一后只有一组,分组代码冗余,做减法。
 */
export function PromptTemplates({
  templates,
  onSelect,
  variant = 'popover',
}: PromptTemplatesProps) {
  if (templates.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">暂无模板</p>
  }

  if (variant === 'chips') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect(tpl.content)}
            title={tpl.content}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5',
              'text-xs font-medium text-foreground/80 transition-all',
              'hover:border-primary/40 hover:bg-accent hover:text-foreground hover:-translate-y-px',
            )}
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{tpl.name}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {templates.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          onClick={() => onSelect(tpl.content)}
          className={cn(
            'group flex items-start gap-2 rounded-lg border bg-card p-2.5 text-left transition-colors',
            'hover:border-primary/40 hover:bg-accent',
          )}
        >
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          <div className="min-w-0 flex-1">
            <p className="break-words text-xs font-medium">{tpl.name}</p>
            <p className="mt-0.5 line-clamp-2 break-words text-[11px] text-muted-foreground">
              {tpl.content}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}

export default PromptTemplates
