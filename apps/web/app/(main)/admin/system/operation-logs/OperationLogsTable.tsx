'use client'

import { Loader2, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Checkbox } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { cn } from '@/lib/utils'
import { th, BIZ_TYPE, STATUS_LABEL } from './helpers'
import type { OperLog } from './types'
import { formatDate } from '@/lib/date-utils'

interface OperationLogsTableProps {
  list: OperLog[]
  isLoading: boolean
  selected: Set<string>
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  sort: { col: string; dir: 'asc' | 'desc' }
  onSort: (col: string) => void
  onDetail: (log: OperLog) => void
}

export function OperationLogsTable({
  list,
  isLoading,
  selected,
  onToggleAll,
  onToggleOne,
  sort,
  onSort,
  onDetail,
}: OperationLogsTableProps) {
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
            <th className={th}>{t('operationLogs.table.id')}</th>
            <th className={th}>{t('operationLogs.table.module')}</th>
            <th className={th}>{t('operationLogs.table.type')}</th>
            <th className={cn(th, 'cursor-pointer select-none')} onClick={() => onSort('operName')}>
              {t('operationLogs.table.operName')} {sortIcon('operName')}
            </th>
            <th className={th}>{t('operationLogs.table.requestMethod')}</th>
            <th className={th}>{t('operationLogs.table.ip')}</th>
            <th className={th}>{t('operationLogs.table.location')}</th>
            <th className={th}>{t('operationLogs.table.status')}</th>
            <th className={cn(th, 'cursor-pointer select-none')} onClick={() => onSort('operTime')}>
              {t('operationLogs.table.operTime')} {sortIcon('operTime')}
            </th>
            <th className={cn(th, 'cursor-pointer select-none')} onClick={() => onSort('costTime')}>
              {t('operationLogs.table.costTime')} {sortIcon('costTime')}
            </th>
            <th className={th}>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
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
                  <td className="px-4 py-2.5 font-medium">{l.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {BIZ_TYPE[l.businessType] ? t(BIZ_TYPE[l.businessType]!) : '-'}
                  </td>
                  <td className="px-4 py-2.5">{l.operName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.requestMethod}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.operIp}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.operLocation}</td>
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
                    {l.operTime ? formatDate(l.operTime) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.costTime}ms</td>
                  <td className="px-4 py-2.5">
                    <HasPermi code="system:operlog:query">
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
