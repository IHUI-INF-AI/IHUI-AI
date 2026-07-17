'use client'

import { Loader2, Bell } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { th, maskUserId, STATUS_BADGE } from './helpers'
import type { NotificationLog } from './types'

interface Props {
  list: NotificationLog[]
  isLoading: boolean
  onDetail: (item: NotificationLog) => void
}

export function NotificationLogTable({ list, isLoading, onDetail }: Props) {
  const t = useTranslations('admin.notificationLogs')
  const locale = useLocale()
  const dtf = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  function fmt(v?: string): string {
    if (!v) return '-'
    const d = new Date(v)
    if (isNaN(d.getTime())) return v
    return dtf.format(d)
  }

  function statusLabel(s?: string): string {
    if (s === 'sent') return t('sent')
    if (s === 'failed') return t('failed')
    if (s === 'pending') return t('pending')
    return s ?? '-'
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('colId')}</th>
            <th className={th}>{t('userId')}</th>
            <th className={th}>{t('channel')}</th>
            <th className={th}>{t('type')}</th>
            <th className={th}>{t('status')}</th>
            <th className={th}>{t('content')}</th>
            <th className={th}>{t('createdAt')}</th>
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
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </td>
            </tr>
          ) : (
            list.map((item) => {
              const s = item.status ?? ''
              return (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.id}</td>
                  <td className="px-4 py-2.5 font-medium">{maskUserId(item.user_id)}</td>
                  <td className="px-4 py-2.5">{item.channel ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.type ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs ${
                        STATUS_BADGE[s] ?? 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td
                    className="max-w-48 truncate px-4 py-2.5 text-xs text-muted-foreground"
                    title={item.content ?? ''}
                  >
                    {item.content ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmt(item.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <button className="text-primary hover:underline" onClick={() => onDetail(item)}>
                      {t('viewDetail')}
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
