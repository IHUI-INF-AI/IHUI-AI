'use client'

import { Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@ihui/ui-react'
import { api } from './helpers'
import type { Snapshot } from './types'
import { formatDate } from '@/lib/date-utils'

interface Props {
  list: Snapshot[]
}

export function StatisticsTable({ list }: Props) {
  const t = useTranslations('statistics')
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
        <Save className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('noSnapshots')}</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">{t('snapshotType')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('createdAt')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('data')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-4 py-2">
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {s.type}
                </span>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{formatDate(s.createdAt)}</td>
              <td className="px-4 py-2">
                <pre className="max-w-xs overflow-x-auto text-xs text-muted-foreground">
                  {JSON.stringify(s.data).slice(0, 120)}
                </pre>
              </td>
              <td className="px-4 py-2">
                <DeleteSnapshotButton id={s.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DeleteSnapshotButton({ id }: { id: string }) {
  const t = useTranslations('statistics')
  const queryClient = useQueryClient()
  const del = useMutation({
    mutationFn: () => api(`/api/admin/statistics/snapshots/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['statistics', 'snapshots'] }),
  })
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={del.isPending}
      onClick={() => del.mutate()}
      aria-label={t('delete')}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  )
}
