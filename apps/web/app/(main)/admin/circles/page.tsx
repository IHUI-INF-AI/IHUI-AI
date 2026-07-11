'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Users } from 'lucide-react'

import { fetchApi } from '@/lib/api'

interface Circle {
  id: string
  name: string
  creator?: { nickname?: string } | null
  creatorName?: string | null
  memberCount?: number
  postCount?: number
  status: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const th = 'px-4 py-2.5 font-medium'

export default function AdminCirclesPage() {
  const t = useTranslations('admin.circles')
  const [currentPage] = React.useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'circles', currentPage],
    queryFn: () => api<{ list: Circle[] }>('/api/admin/circles'),
  })

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colName')}</th>
              <th className={th}>{t('colCreator')}</th>
              <th className={th}>{t('colMembers')}</th>
              <th className={th}>{t('colPosts')}</th>
              <th className={th}>{t('colStatus')}</th>
              <th className={th}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {item.creator?.nickname ?? item.creatorName ?? '-'}
                  </td>
                  <td className="px-4 py-2.5">{item.memberCount ?? 0}</td>
                  <td className="px-4 py-2.5">{item.postCount ?? 0}</td>
                  <td className="px-4 py-2.5">{item.status === 1 ? t('normal') : t('disabled')}</td>
                  <td className="px-4 py-2.5 space-x-2">
                    <button className="text-primary hover:underline">{t('edit')}</button>
                    <button className="text-destructive hover:underline">
                      {item.status === 1 ? t('disable') : t('enable')}
                    </button>
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
