'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CATEGORIES, tabBase } from './helpers'
import type { Category } from './types'

interface Props {
  category: 'all' | Category
  setCategory: (v: 'all' | Category) => void
}

export function ConfigFilter({ category, setCategory }: Props) {
  const t = useTranslations('admin.configs')
  const tabCls = (active: boolean) =>
    cn(
      tabBase,
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
      <button onClick={() => setCategory('all')} className={tabCls(category === 'all')}>
        {t('allCategories')}
      </button>
      {CATEGORIES.map((c) => (
        <button key={c} onClick={() => setCategory(c)} className={tabCls(category === c)}>
          {t(`categories.${c}`)}
        </button>
      ))}
    </div>
  )
}
