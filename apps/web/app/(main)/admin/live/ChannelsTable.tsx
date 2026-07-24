'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Loader2, Edit, Trash2, Radio } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { type Channel, api } from './types'

export function ChannelsTable({
  channels,
  isLoading,
  error,
  onEdit,
}: {
  channels: Channel[]
  isLoading: boolean
  error: unknown
  onEdit: (ch: Channel) => void
}) {
  const t = useTranslations('admin.live')
  const qc = useQueryClient()

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/live/channels/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'live', 'channels'] })
      qc.invalidateQueries({ queryKey: ['live', 'statistics'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleDelete(ch: Channel) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(ch.id)
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCategory')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLecturer')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                {(error as Error).message}
              </TableCell>
            </TableRow>
          ) : channels.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Radio className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            channels.map((ch) => {
              const published = ch.isPublished
              const live = ch.isLive
              return (
                <TableRow key={ch.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="font-medium">{ch.title}</div>
                    {ch.intro ? (
                      <div className="max-w-xs break-words text-xs text-muted-foreground">
                        {ch.intro}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {ch.categoryName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {ch.lecturerName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="flex flex-col gap-1">
                      {live ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          {t('liveNow')}
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          'inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                          published
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            published ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {published ? t('published') : t('unpublished')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{ch.sort}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip content={t('edit')}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(ch)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content={t('delete')}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(ch)}
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
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
