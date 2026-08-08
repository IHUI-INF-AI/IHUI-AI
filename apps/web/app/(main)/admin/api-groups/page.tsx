'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { FolderTree, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { TruncatedText, BackButton } from '@/components/common'

interface ApiGroup {
  id: string
  name: string
  description: string
  apiCount: number
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const th = 'px-4 py-2.5 font-medium'

export default function ApiGroupsPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin', 'api-groups'],
    queryFn: async () => {
      const d = await api<{ list?: ApiGroup[] } | ApiGroup[]>('/api/admin/api-groups')
      const arr = Array.isArray(d) ? d : (d.list ?? [])
      return arr
    },
  })

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FolderTree className="h-6 w-6 text-primary" />
          {t('apiGroups.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('apiGroups.subtitle')}</p>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
        API分组由API Key名称自动聚合生成,如需管理请前往API Key管理页面
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('search')}
        </div>
      ) : !list?.length ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
          {t('apiGroups.noData')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className={th}>{t('apiGroups.colName')}</th>
                <th className={th}>{t('apiGroups.colDescription')}</th>
                <th className={th}>{t('apiGroups.colApiCount')}</th>
                <th className={th}>{t('apiGroups.colCreatedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((g) => (
                <tr key={g.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{g.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <TruncatedText value={g.description} className="max-w-[280px]" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {g.apiCount}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{g.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
