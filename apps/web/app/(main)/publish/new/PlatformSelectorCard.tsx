'use client'

/**
 * 平台选择卡片(从 new/page.tsx 抽出)
 *
 * 多选目标平台 + 全选/清空,显示每个平台已配置账号数。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / subtle hover
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, Label, Checkbox } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { PLATFORM_KEY } from '../helpers'

export interface PlatformSelectorCardProps {
  readonly platformMap: Map<string, ReadonlyArray<{ id: number; displayName: string }>>
  readonly selected: ReadonlySet<string>
  readonly onToggle: (platform: string) => void
  readonly onSelectAll: () => void
  readonly onClearAll: () => void
}

export function PlatformSelectorCard({
  platformMap,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
}: PlatformSelectorCardProps) {
  const t = useTranslations('publish')

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Label>{t('new.selectPlatforms')}</Label>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={onSelectAll}
              className="text-primary hover:underline"
            >
              {t('new.selectAll')}
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="text-muted-foreground hover:underline"
            >
              {t('new.clearAll')}
            </button>
          </div>
        </div>
        {platformMap.size === 0 ? (
          <p className="text-xs text-muted-foreground">{t('accounts.noAccounts')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3">
            {Array.from(platformMap.keys()).map((p) => {
              const checked = selected.has(p)
              return (
                <label
                  key={p}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                    checked
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => onToggle(p)} />
                  <span>{t(PLATFORM_KEY[p] ?? 'platforms.unknown')}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    ×{platformMap.get(p)?.length}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
