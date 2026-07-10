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
}

export function PromptTemplates({ templates, onSelect }: PromptTemplatesProps) {
  const groups = templates.reduce<Record<string, Template[]>>((acc, tpl) => {
    const key = tpl.category ?? '默认'
    const arr = acc[key]
    if (arr) {
      arr.push(tpl)
    } else {
      acc[key] = [tpl]
    }
    return acc
  }, {})

  const entries = Object.entries(groups)

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">暂无模板</p>
      ) : (
        entries.map(([category, items]) => (
          <div key={category}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onSelect(tpl.content)}
                  className={cn(
                    'group flex items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors',
                    'hover:border-primary/40 hover:bg-primary/5',
                  )}
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tpl.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {tpl.content}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default PromptTemplates
