'use client'

import * as React from 'react'
import { Loader2, Tag, Edit, Trash2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import * as LucideIcons from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

import type { SkillCategory } from './types'

interface Props {
  categories: SkillCategory[]
  isLoading: boolean
  error: Error | null
  onEdit: (cat: SkillCategory) => void
  onDelete: (id: string) => void
}

const th = 'px-4 py-2.5 font-medium'

export function CategoryTable({ categories, isLoading, error, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.skillCategories')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (error) {
    return <div className="py-8 text-center text-destructive">{error.message}</div>
  }
  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
        <Tag className="h-8 w-8 opacity-40" />
        <p className="text-sm">{t('noData')}</p>
      </div>
    )
  }

  function renderIcon(iconName: string | null | undefined) {
    const name = iconName ?? 'Tag'
    const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name]
    if (!Icon) return <Tag className="h-3.5 w-3.5" />
    return <Icon className="h-3.5 w-3.5" />
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={cn(th, 'w-10')} />
            <th className={th}>{t('name')}</th>
            <th className={th}>{t('slug')}</th>
            <th className={th}>{t('sort')}</th>
            <th className={th}>{t('createdAt')}</th>
            <th className={cn(th, 'text-right')}>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  {renderIcon(cat.icon)}
                </span>
              </td>
              <td className="px-4 py-2.5 font-medium">{cat.name}</td>
              <td className="px-4 py-2.5">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {cat.slug}
                </code>
              </td>
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                  {cat.sort}
                </span>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {cat.createdAt ? dateFmt.format(new Date(cat.createdAt)) : '-'}
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="inline-flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(cat)}>
                    <Edit className="mr-1 h-3.5 w-3.5" />
                    {tc('edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(cat.id)}
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
      <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm text-muted-foreground">
        <span>{t('total', { total: categories.length })}</span>
      </div>
    </div>
  )
}