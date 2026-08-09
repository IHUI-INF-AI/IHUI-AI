'use client'

import { Loader2, Bot, Edit, Trash2, Store } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

import type { Skill } from './types'

interface Props {
  skills: Skill[]
  isLoading: boolean
  error: Error | null
  total: number
  onEdit: (skill: Skill) => void
  onDelete: (id: string) => void
  onOpenMarket: () => void
}

const th = 'px-4 py-2.5 font-medium'

export function SkillTable({
  skills,
  isLoading,
  error,
  total,
  onEdit,
  onDelete,
  onOpenMarket,
}: Props) {
  const t = useTranslations('admin.skills')
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
  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
        <Bot className="h-8 w-8 opacity-40" />
        <p className="text-sm">{t('noData')}</p>
        <Button variant="outline" size="sm" onClick={onOpenMarket}>
          <Store className="mr-1.5 h-3.5 w-3.5" />
          {t('browseMarket')}
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('name')}</th>
            <th className={th}>{t('version')}</th>
            <th className={th}>{t('tags')}</th>
            <th className={th}>{t('createdAt')}</th>
            <th className={cn(th, 'text-right')}>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => (
            <tr key={skill.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{skill.name}</p>
                    {skill.description ? (
                      <p className="truncate text-xs text-muted-foreground">{skill.description}</p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {skill.version ?? '-'}
                </code>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(skill.tags) && skill.tags.length > 0
                    ? skill.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))
                    : <span className="text-xs text-muted-foreground">-</span>}
                </div>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {skill.createdAt ? dateFmt.format(new Date(skill.createdAt)) : '-'}
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="inline-flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(skill)}>
                    <Edit className="mr-1 h-3.5 w-3.5" />
                    {tc('edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(skill.id)}
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
        <span>{t('total', { total })}</span>
      </div>
    </div>
  )
}