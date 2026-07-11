'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, ShieldAlert } from 'lucide-react'

import { fetchApi } from '@/lib/api'

interface SensitiveWord {
  id: string
  word: string
  category: string
  level: number
  status: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const LEVEL_KEYS = ['levelReplace', 'levelBlock', 'levelBan'] as const
const th = 'px-4 py-2.5 font-medium'

export default function SensitiveWordsPage() {
  const t = useTranslations('admin.sensitiveWords')
  const [currentPage] = React.useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'sensitive-words', currentPage],
    queryFn: () => api<{ list: SensitiveWord[] }>('/api/admin/sensitive-words'),
  })

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colWord')}</th>
              <th className={th}>{t('colCategory')}</th>
              <th className={th}>{t('colLevel')}</th>
              <th className={th}>{t('colStatus')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <ShieldAlert className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.word}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.category}</td>
                  <td className="px-4 py-2.5">{t(LEVEL_KEYS[item.level - 1] ?? 'levelReplace')}</td>
                  <td className="px-4 py-2.5">
                    {item.status === 1 ? t('enabled') : t('disabled')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
