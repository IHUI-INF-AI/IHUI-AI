'use client'

import { Loader2, Edit, Trash2, ListChecks } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { Channel, Rule } from './types'

interface Props {
  list: Rule[]
  channels: Channel[]
  isLoading: boolean
  error: Error | null
  deletePending: boolean
  onEdit: (rule: Rule) => void
  onDelete: (rule: Rule) => void
}

export function RuleTable({
  list,
  channels,
  isLoading,
  error,
  deletePending,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations('admin.point')
  const channelName = (id: string | null) =>
    id ? (channels.find((c) => c.id === id)?.name ?? '-') : '-'

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCode')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colChannel')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPoint')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((rule) => {
              const enabled = rule.status === 1
              return (
                <TableRow key={rule.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{rule.name}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {rule.code ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{channelName(rule.channelId)}</TableCell>
                  <TableCell className="px-4 py-2.5">{rule.point ?? 0}</TableCell>
                  <TableCell className="px-4 py-2.5">{rule.sort}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        enabled
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {enabled ? t('enabled') : t('disabled')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(rule)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(rule)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
