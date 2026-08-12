'use client'

/**
 * 筛选栏(从 history/page.tsx 抽出)
 *
 * 平台 Select + 状态 Select。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / subtle hover
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@ihui/ui-react'
import { PLATFORM_KEY } from '../helpers'

const PLATFORMS = [
  'wordpress', 'medium', 'youtube', 'bilibili', 'wechat', 'toutiao',
  'douyin', 'kuaishou', 'weibo', 'zhihu', 'csdn', 'juejin',
  'xiaohongshu', 'shipinhao',
] as const

export interface FilterBarProps {
  readonly filterPlatform: string
  readonly onFilterPlatformChange: (v: string) => void
  readonly filterStatus: string
  readonly onFilterStatusChange: (v: string) => void
}

export function FilterBar({
  filterPlatform,
  onFilterPlatformChange,
  filterStatus,
  onFilterStatusChange,
}: FilterBarProps) {
  const t = useTranslations('publish')

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 p-3 min-[640px]:p-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t('history.filterPlatform')}</label>
          <Select value={filterPlatform} onValueChange={onFilterPlatformChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('history.allPlatforms')}</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(PLATFORM_KEY[p] ?? 'platforms.unknown')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t('history.filterStatus')}</label>
          <Select value={filterStatus} onValueChange={onFilterStatusChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('history.allStatus')}</SelectItem>
              <SelectItem value="success">{t('history.statusSuccess')}</SelectItem>
              <SelectItem value="failed">{t('history.statusFailed')}</SelectItem>
              <SelectItem value="skipped">{t('history.statusSkipped')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
