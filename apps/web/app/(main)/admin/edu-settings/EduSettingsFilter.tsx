'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { tabBase } from './helpers'

interface Props {
  group: 'all' | string
  groups: string[]
  groupInput: string
  setGroup: (g: string) => void
  setGroupInput: (v: string) => void
  onAddGroup: () => void
}

export function EduSettingsFilter({
  group,
  groups,
  groupInput,
  setGroup,
  setGroupInput,
  onAddGroup,
}: Props) {
  const t = useTranslations('admin.eduSettings')
  const tabCls = (active: boolean) =>
    cn(
      tabBase,
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
      <button onClick={() => setGroup('all')} className={tabCls(group === 'all')}>
        {t('allGroups')}
      </button>
      {groups.map((g) => (
        <button key={g} onClick={() => setGroup(g)} className={tabCls(group === g)}>
          {g}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-1 px-2">
        <input
          value={groupInput}
          onChange={(e) => setGroupInput(e.target.value)}
          placeholder={t('addGroupPlaceholder')}
          className="h-7 w-32 rounded border border-input bg-transparent px-2 text-xs"
        />
        <Button size="sm" variant="outline" onClick={onAddGroup}>
          {t('filter')}
        </Button>
      </div>
    </div>
  )
}
