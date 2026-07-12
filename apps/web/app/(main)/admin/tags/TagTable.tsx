'use client'

import { Loader2, Tag, Hash, Edit, Trash2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { Tag as TagChip } from '@/components/data/Tag'

import { TAG_COLORS, getFontSize } from './helpers'
import type { TagItem } from './types'

interface Props {
  tags: TagItem[]
  isLoading: boolean
  error: Error | null
  onEdit: (tag: TagItem) => void
  onDelete: (id: string) => void
}

const th = 'px-4 py-2.5 font-medium'

export function TagTable({ tags, isLoading, error, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.tags')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fontSize = getFontSize(tags)
  const total = tags.length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (error) {
    return <div className="py-12 text-center text-destructive">{error.message}</div>
  }
  if (tags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <Tag className="h-8 w-8 opacity-40" />
        <p className="text-sm">{t('noData')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium uppercase text-muted-foreground">
          <Hash className="h-3.5 w-3.5" />
          {t('cloudTitle')}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-5">
          {tags.map((tag, i) => (
            <span
              key={tag.id}
              className={cn(
                'inline-flex items-center gap-1 font-medium transition-colors hover:opacity-80',
                TAG_COLORS[i % TAG_COLORS.length],
              )}
              style={{ fontSize: `${fontSize(tag.usageCount)}px` }}
              title={t('usageCount', { count: tag.usageCount })}
            >
              <Tag className="h-3 w-3" />
              {tag.name}
              <span className="text-xs text-muted-foreground">({tag.usageCount})</span>
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('name')}</th>
              <th className={th}>{t('slug')}</th>
              <th className={th}>{t('usageCount')}</th>
              <th className={th}>{t('createdAt')}</th>
              <th className={cn(th, 'text-right')}>{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tags.map((tag) => (
              <tr key={tag.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Tag className="h-3.5 w-3.5" />
                    </span>
                    <TagChip size="md" color={tag.color ?? undefined}>
                      {tag.name}
                    </TagChip>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {tag.slug}
                  </code>
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {tag.usageCount}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {tag.createdAt ? dateFmt.format(new Date(tag.createdAt)) : '-'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(tag)}>
                      <Edit className="mr-1 h-3.5 w-3.5" />
                      {tc('edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(tag.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {tc('delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-muted-foreground">{t('total', { total })}</div>
    </>
  )
}
