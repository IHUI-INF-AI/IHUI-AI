'use client'

import { Loader2, Trash2, Copy, Power } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { copyText } from './helpers'
import type { ApiApp } from './types'

interface Props {
  apps: ApiApp[]
  isLoading: boolean
  locale: string
  togglePending: boolean
  onToggle: (a: ApiApp) => void
  onDelete: (a: ApiApp) => void
}

export function ApiAppTable({ apps, isLoading, locale, togglePending, onToggle, onDelete }: Props) {
  const t = useTranslations('adminApiApps')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs uppercase">{t('colName')}</TableHead>
            <TableHead className="text-xs uppercase">{t('colAppId')}</TableHead>
            <TableHead className="text-xs uppercase">{t('colPermissions')}</TableHead>
            <TableHead className="text-xs uppercase">{t('colStatus')}</TableHead>
            <TableHead className="text-xs uppercase">{t('colCreatedAt')}</TableHead>
            <TableHead className="text-right text-xs uppercase">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </TableCell>
            </TableRow>
          ) : apps.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            apps.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs">{a.appId}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => copyText(a.appId)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="max-w-[220px]">
                  <div className="flex flex-wrap gap-1">
                    {(a.permissions ?? []).map((p) => (
                      <span key={p} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {p}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {a.status === 1 ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">
                      {t('statusOn')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {t('statusOff')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat(locale).format(new Date(a.createdAt))}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggle(a)}
                      disabled={togglePending}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {a.status === 1 ? t('toggleOff') : t('toggleOn')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(a)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
