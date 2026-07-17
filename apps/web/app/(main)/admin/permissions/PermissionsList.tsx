'use client'

import { Loader2, Lock, Copy, Check } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import type { Permission } from './types'

interface Props {
  grouped: [string, Permission[]][]
  isLoading: boolean
  isError: boolean
  copiedId: string | null
  onCopy: (p: Permission) => void
}

export function PermissionsList({ grouped, isLoading, isError, copiedId, onCopy }: Props) {
  const t = useTranslations('admin.permissions')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {t('noData')}
      </div>
    )
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        <Lock className="mx-auto mb-2 h-8 w-8 opacity-40" />
        {t('noData')}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {grouped.map(([resource, list]) => (
        <section key={resource} className="overflow-hidden rounded-lg border">
          <header className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{resource}</span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {t('count', { count: list.length })}
            </span>
          </header>
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <TableRow>
                  <TableHead className="px-4 py-2 font-medium">{t('name')}</TableHead>
                  <TableHead className="px-4 py-2 font-medium">{t('code')}</TableHead>
                  <TableHead className="px-4 py-2 font-medium">{t('action')}</TableHead>
                  <TableHead className="px-4 py-2 font-medium">{t('description')}</TableHead>
                  <TableHead className="px-4 py-2 font-medium">{t('createdAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {list.map((p) => (
                  <TableRow key={p.id} className="transition-colors hover:bg-muted/20">
                    <TableCell className="px-4 py-2">
                      <span className="font-medium">{p.displayName}</span>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => onCopy(p)}
                        className="group inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs transition-colors hover:bg-muted/70"
                        title={t('copyCode')}
                      >
                        <code>{p.name}</code>
                        {copiedId === p.id ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        {p.action}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[260px] break-words px-4 py-2 text-muted-foreground">
                      {p.description || '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                      {dateFmt.format(new Date(p.createdAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </div>
  )
}
