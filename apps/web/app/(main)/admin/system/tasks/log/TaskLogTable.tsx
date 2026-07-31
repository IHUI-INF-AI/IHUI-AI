'use client'

import { Loader2, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Checkbox } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { TruncatedText } from '@/components/common'
import { cn } from '@/lib/utils'
import { th, STATUS_LABEL } from './helpers'
import type { JobLog, SortState } from './types'
import { formatDate } from '@/lib/date-utils'

interface Props {
  list: JobLog[]
  isLoading: boolean
  selected: Set<string>
  sort: SortState
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  onSort: (col: string) => void
  onDetail: (item: JobLog) => void
}

export function TaskLogTable({
  list,
  isLoading,
  selected,
  sort,
  onToggleAll,
  onToggleOne,
  onSort,
  onDetail,
}: Props) {
  const t = useTranslations('admin.system')
  const sortIcon = (col: string) => (sort.col === col ? (sort.dir === 'desc' ? '↓' : '↑') : '')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="w-10 px-4 py-2.5">
              <Checkbox
                checked={list.length > 0 && selected.size === list.length}
                onCheckedChange={onToggleAll}
              />
            </th>
            <th className={th}>{t('tasksLog.table.id')}</th>
            <th className={th}>{t('tasksLog.table.jobName')}</th>
            <th className={th}>{t('tasksLog.table.jobGroup')}</th>
            <th className={th}>{t('tasksLog.table.invokeTarget')}</th>
            <th className={th}>{t('tasksLog.table.jobMessage')}</th>
            <th className={th}>{t('tasksLog.table.status')}</th>
            <th
              className={cn(th, 'cursor-pointer select-none')}
              onClick={() => onSort('startTime')}
            >
              {t('tasksLog.table.startTime')} {sortIcon('startTime')}
            </th>
            <th className={th}>{t('tasksLog.table.costTime')}</th>
            <th className={th}>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                {t('common.noData')}
              </td>
            </tr>
          ) : (
            list.map((l) => {
              const st = STATUS_LABEL[l.status]
              return (
                <tr key={l.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Checkbox
                      checked={selected.has(l.id)}
                      onCheckedChange={() => onToggleOne(l.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.id}</td>
                  <td className="px-4 py-2.5 font-medium">{l.jobName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.jobGroup}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    <TruncatedText value={l.invokeTarget} className="max-w-[180px]" mono />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    <TruncatedText value={l.jobMessage || '-'} className="max-w-[180px]" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-md px-2 py-0.5 text-xs',
                        st?.cls ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {st ? t(st.label) : '-'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                    {l.startTime ? formatDate(l.startTime) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.costTime}ms</td>
                  <td className="px-4 py-2.5">
                    <HasPermi code="monitor:job:query">
                      <Button size="sm" variant="ghost" onClick={() => onDetail(l)}>
                        <Eye className="h-3.5 w-3.5" />
                        {t('common.detail')}
                      </Button>
                    </HasPermi>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
