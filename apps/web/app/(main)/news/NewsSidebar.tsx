'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Pin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { fmtDate } from './helpers'
import type { NewsArticle, NewsCategory } from './types'

interface Props {
  categories: NewsCategory[]
  categoryId: string
  onCategoryChange: (id: string) => void
  pinned: NewsArticle[]
}

export function NewsSidebar({ categories, categoryId, onCategoryChange, pinned }: Props) {
  const t = useTranslations('news')

  return (
    <aside className="w-full shrink-0 space-y-4 lg:w-72">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">{t('categories')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-4 pt-0">
          <button
            type="button"
            onClick={() => onCategoryChange('all')}
            className={cn(
              'block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
              categoryId === 'all'
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {t('allCategories')}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategoryChange(c.id)}
              className={cn(
                'block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                categoryId === c.id
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {c.name}
            </button>
          ))}
        </CardContent>
      </Card>

      {pinned.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Pin className="h-4 w-4 text-primary" />
              {t('pinned')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {pinned.map((item) => (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="block rounded-md p-1.5 transition-colors hover:bg-accent"
              >
                <p className="text-sm font-medium leading-snug">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('publishedAt', { date: fmtDate(item.publishedAt) })}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </aside>
  )
}
