'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { Category } from './types'

interface Props {
  keyword: string
  setKeyword: (v: string) => void
  categoryId: string
  setCategoryId: (v: string) => void
  categories: Category[]
}

export function MarketFilters({
  keyword,
  setKeyword,
  categoryId,
  setCategoryId,
  categories,
}: Props) {
  const t = useTranslations('agents')
  const tc = useTranslations('common')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
          aria-label={tc('search')}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setCategoryId('all')}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            categoryId === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          {t('allCategories')}
        </button>
        {categories.map((c) => (
          <button
            key={c.categoryId}
            type="button"
            onClick={() => setCategoryId(c.categoryId)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              categoryId === c.categoryId
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
