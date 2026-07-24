'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Newspaper, FolderTree, Info } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

import { useNewsArticles } from './useNewsArticles'
import { useNewsInformation } from './useNewsInformation'
import { NewsArticleTable } from './NewsArticleTable'
import { NewsArticleDialog } from './NewsArticleDialog'
import { NewsInfoTable } from './NewsInfoTable'
import { NewsInfoDialog } from './NewsInfoDialog'

export default function AdminNewsPage() {
  const t = useTranslations('admin.news')
  const [tab, setTab] = React.useState<'articles' | 'information'>('articles')

  const article = useNewsArticles()
  const info = useNewsInformation(tab === 'information')

  const tabCls = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('articlesTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('articlesSubtitle')}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/news/categories">
            <FolderTree className="h-4 w-4" />
            {t('categoriesTitle')}
          </Link>
        </Button>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        <button onClick={() => setTab('articles')} className={tabCls(tab === 'articles')}>
          <Newspaper className="mr-1 inline h-4 w-4" />
          文章
        </button>
        <button onClick={() => setTab('information')} className={tabCls(tab === 'information')}>
          <Info className="mr-1 inline h-4 w-4" />
          信息库
        </button>
      </div>

      {tab === 'articles' && (
        <>
          <NewsArticleTable {...article} />
          <NewsArticleDialog {...article} />
        </>
      )}

      {tab === 'information' && (
        <>
          <NewsInfoTable {...info} />
          <NewsInfoDialog {...info} />
        </>
      )}
    </div>
  )
}
