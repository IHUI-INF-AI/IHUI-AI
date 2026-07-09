'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Tag, Hash, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

interface TagItem {
  id: string
  slug: string
  name: string
  usageCount: number
  description?: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const TAG_COLORS = [
  'text-primary',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-violet-600 dark:text-violet-400',
  'text-cyan-600 dark:text-cyan-400',
]

export default function TagsPage() {
  const t = useTranslations('tags')

  const { data, isLoading, error } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api<{ tags: TagItem[] }>('/api/tags').then((d) => d.tags ?? []),
  })

  const tags = data ?? []
  const counts = tags.map((x) => x.usageCount)
  const max = Math.max(1, ...counts)
  const min = Math.min(max, ...counts)
  const fontSize = (count: number) => {
    if (max === min) return 16
    return Math.round(12 + ((count - min) / (max - min)) * 16)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Hash className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <Tag className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty')}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-6">
          {tags.map((tag, i) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className={cn(
                'inline-flex items-center gap-1 font-medium transition-colors hover:underline',
                TAG_COLORS[i % TAG_COLORS.length],
              )}
              style={{ fontSize: `${fontSize(tag.usageCount)}px` }}
              title={t('usageCount', { count: tag.usageCount })}
            >
              <Tag className="h-3 w-3" />
              {tag.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
