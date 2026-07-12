'use client'

import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Button, Input, Label } from '@ihui/ui'
import { TYPE_TABS, STATUS_TABS, inputSm } from './helpers'
import type { SearchState } from './types'

interface FeedbackFilterProps {
  type: string
  status: string
  search: SearchState
  onTypeChange: (v: string) => void
  onStatusChange: (v: string) => void
  onSearchChange: (s: SearchState) => void
  onReset: () => void
}

function renderTabs(
  tabs: { value: string; labelKey: string }[],
  value: string,
  onChange: (v: string) => void,
  prefix: 'type' | 'status',
  tf: (k: string) => string,
) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === tab.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tf(`${prefix}_${tab.labelKey}`)}
        </button>
      ))}
    </div>
  )
}

export function FeedbackFilter({
  type,
  status,
  search,
  onTypeChange,
  onStatusChange,
  onSearchChange,
  onReset,
}: FeedbackFilterProps) {
  const t = useTranslations('admin.feedbacks')
  const tf = useTranslations('feedback')
  const tc = useTranslations('common')

  return (
    <>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {renderTabs(TYPE_TABS, type, onTypeChange, 'type', tf)}
        {renderTabs(STATUS_TABS, status, onStatusChange, 'status', tf)}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('title_col')}</Label>
          <Input
            className={inputSm}
            value={search.title}
            onChange={(e) => onSearchChange({ ...search, title: e.target.value })}
            placeholder={t('title_col')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">创建人</Label>
          <Input
            className={inputSm}
            value={search.creator}
            onChange={(e) => onSearchChange({ ...search, creator: e.target.value })}
            placeholder="创建人"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">创建时间</Label>
          <Input
            type="date"
            className={inputSm}
            value={search.createdAt}
            onChange={(e) => onSearchChange({ ...search, createdAt: e.target.value })}
          />
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
          {tc('reset')}
        </Button>
      </div>
    </>
  )
}
