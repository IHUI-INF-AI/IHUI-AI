'use client'

import * as React from 'react'
import { BarChart3, FlaskConical, Pencil, Trash2, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { matchTypeLabel, priorityVariant, scopeLabel, useRulesStore } from '@/stores/rules'
import type { Rule } from '@ihui/types'
import { Badge } from '@ihui/ui-react'

interface RuleItemProps {
  rule: Rule
  index: number
  onEdit: () => void
  onDelete: () => Promise<unknown>
  onToggle: (enabled: boolean) => Promise<unknown>
  onShowDetail: () => void
}

function RuleItem({ rule, index, onEdit, onDelete, onToggle, onShowDetail }: RuleItemProps) {
  const [confirmDel, setConfirmDel] = React.useState(false)
  const { testDialogRule, openTestDialog } = useRulesStore()
  const isActive = testDialogRule?.id === rule.id
  const matchCount = (rule as Rule & { matchCount?: number }).matchCount ?? 0

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors',
        !rule.enabled && 'opacity-60',
        isActive && 'ring-1 ring-foreground/10',
      )}
    >
      <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">{index}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{rule.name}</span>
          {!rule.enabled && (
            <span className="rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">禁用</span>
          )}
          {matchCount > 0 && (
            <span className="shrink-0 rounded-sm bg-blue-500/10 px-1 text-[10px] text-blue-600">
              命中 {matchCount} 次
            </span>
          )}
        </div>
        {rule.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{rule.description}</p>
        )}
      </div>
      <Badge
        variant={priorityVariant(rule.priority)}
        className={cn(
          'shrink-0 px-2 py-1 text-[10px]',
          rule.priority >= 70 && 'border-transparent bg-green-500/10 text-green-600',
          rule.priority >= 30 &&
            rule.priority < 70 &&
            'border-transparent bg-yellow-500/10 text-yellow-600',
          rule.priority < 30 && 'border-transparent bg-muted text-muted-foreground',
        )}
      >
        P{rule.priority}
      </Badge>
      <span className="hidden shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground min-[640px]:inline">
        {scopeLabel(rule.scope)}
      </span>
      <span className="hidden shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground min-[768px]:inline">
        {matchTypeLabel(rule.matchType)}
      </span>
      <button
        type="button"
        onClick={() => onToggle(!rule.enabled)}
        aria-label={rule.enabled ? '禁用' : '启用'}
        className={cn(
          'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors',
          rule.enabled
            ? 'border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20'
            : 'border-border bg-muted text-muted-foreground hover:bg-accent',
        )}
      >
        {rule.enabled ? '启用' : '禁用'}
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onShowDetail}
          aria-label="详情"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => openTestDialog(rule)}
          aria-label="测试"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <FlaskConical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label="编辑"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {confirmDel ? (
          <button
            type="button"
            onClick={async () => {
              await onDelete()
              setConfirmDel(false)
            }}
            aria-label="确认删除"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            aria-label="删除"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {confirmDel && (
          <button
            type="button"
            onClick={() => setConfirmDel(false)}
            aria-label="取消删除"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export { RuleItem }
export type { RuleItemProps }
