'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { ArticleCategory } from './types'

interface Props {
  categories: ArticleCategory[]
  categoryId: string
  onSelectCategory: (id: string) => void
}

export function ArticlesSidebar({ categories, categoryId, onSelectCategory }: Props) {
  const t = useTranslations('articles')
  return (
    <aside className="w-full shrink-0 space-y-4 lg:w-72">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">{t('categories')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-4 pt-0">
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
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
              onClick={() => onSelectCategory(c.id)}
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

      <Card>
        <CardContent className="p-4">
          <Link href="/articles/hot">
            <Button variant="outline" className="w-full">
              {t('hotArticles')}
            </Button>
          </Link>
          <Link href="/articles/edit" className="mt-2 block">
            <Button className="w-full">{t('publishArticle')}</Button>
          </Link>
        </CardContent>
      </Card>
    </aside>
  )
}
