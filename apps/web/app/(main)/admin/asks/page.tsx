'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, HelpCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'

interface AskItem {
  id: string
  title: string
  user?: { nickname?: string } | null
  userName?: string | null
  category?: { name?: string } | null
  categoryName?: string | null
  status: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_KEYS = ['statusPending', 'statusApproved', 'statusDeleted'] as const
const th = 'px-4 py-2.5 font-medium'

export default function AdminAsksPage() {
  const t = useTranslations('admin.asks')
  const qc = useQueryClient()
  const [currentPage] = React.useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'asks', currentPage],
    queryFn: () => api<{ list: AskItem[] }>('/api/admin/asks'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api<void>(`/api/admin/asks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'asks'] })
      toast.success(t('deleteSuccess'))
    },
  })

  const auditMut = useMutation({
    mutationFn: (id: string) => api<void>(`/api/admin/asks/${id}/audit`, { method: 'PUT' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'asks'] })
      toast.success(t('auditSuccess'))
    },
  })

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colTitle')}</th>
              <th className={th}>{t('colUser')}</th>
              <th className={th}>{t('colCategory')}</th>
              <th className={th}>{t('colStatus')}</th>
              <th className={th}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <HelpCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {item.user?.nickname ?? item.userName ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {item.category?.name ?? item.categoryName ?? '-'}
                  </td>
                  <td className="px-4 py-2.5">{t(STATUS_KEYS[item.status] ?? 'statusPending')}</td>
                  <td className="px-4 py-2.5 space-x-2">
                    <button
                      className="text-primary hover:underline"
                      onClick={() => auditMut.mutate(item.id)}
                      disabled={auditMut.isPending}
                    >
                      {t('audit')}
                    </button>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => deleteMut.mutate(item.id)}
                      disabled={deleteMut.isPending}
                    >
                      {t('delete')}
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
