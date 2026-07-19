'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, FileClock } from 'lucide-react'
import { th, normalizeStatus } from './helpers'
import type { JobLog } from './types'

interface Props {
  list: JobLog[]
  isLoading: boolean
  onDetail: (item: JobLog) => void
  onDelete: (item: JobLog) => void
}

const BADGE: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600',
  fail: 'bg-red-500/10 text-red-600',
  running: 'bg-blue-500/10 text-blue-600',
}

export function JobLogsTable({ list, isLoading, onDetail, onDelete }: Props) {
  const t = useTranslations('admin.scheduleLogs')
  const locale = useLocale()
  const dtf = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [locale],
  )

  function fmt(t?: string): string {
    if (!t) return '-'
    const d = new Date(t)
    if (isNaN(d.getTime())) return t
    return dtf.format(d)
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('colJobLogId')}</th>
            <th className={th}>{t('colJobName')}</th>
            <th className={th}>{t('colJobGroup')}</th>
            <th className={th}>{t('colInvokeTarget')}</th>
            <th className={th}>{t('colJobMessage')}</th>
            <th className={th}>{t('colStatus')}</th>
            <th className={th}>{t('colCreateTime')}</th>
            <th className={th}>{t('colActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <FileClock className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </td>
            </tr>
          ) : (
            list.map((item) => {
              const s = normalizeStatus(item.status)
              return (
                <tr key={String(item.jobLogId)} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">{item.jobLogId ?? '-'}</td>
                  <td className="px-4 py-2.5 font-medium">{item.jobName ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.jobGroup ?? '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {item.invokeTarget ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {item.jobMessage ?? '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${BADGE[s]}`}>
                      {s === 'success'
                        ? t('statusSuccess')
                        : s === 'fail'
                          ? t('statusFail')
                          : t('statusRunning')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {fmt(item.createTime)}
                  </td>
                  <td className="px-4 py-2.5 space-x-2">
                    <button className="text-primary hover:underline" onClick={() => onDetail(item)}>
                      {t('detail')}
                    </button>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => onDelete(item)}
                    >
                      {t('delete')}
                    </button>
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
