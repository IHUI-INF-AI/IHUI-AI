'use client'
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { z } from 'zod'
import { KeyRound, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { Button, Input } from '@ihui/ui'
import { Skeleton } from '@/components/ui/skeleton'
import { useZodForm } from '@/hooks/use-zod-form'
import { fetchApi } from '@/lib/api'
import type { MenuPermissionListData, MenuPermissionStatus } from './types'

const filterSchema = z.object({
  name: z.string().max(64, 'maxLength'),
})
type FilterForm = z.infer<typeof filterSchema>

const BADGE: Record<MenuPermissionStatus, string> = {
  draft: 'bg-muted text-muted-foreground', pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}
const c = 'px-4 py-3'

export default function AdminMenuPermissionPage() {
  const t = useTranslations('admin.menuPermission')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const { form } = useZodForm<FilterForm>({
    schema: filterSchema,
    defaultValues: { name: '' },
  })
  const search = form.watch('name')
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'menu-permission', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: '10' })
      if (search.trim()) qs.set('name', search.trim())
      const r = await fetchApi<MenuPermissionListData>(`/api/v1/admin/sys/menu?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const audit = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MenuPermissionStatus }) =>
      fetchApi(`/api/v1/admin/sys/menu/${id}/audit`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: (_d, v) => { toast.success(v.status === 'published' ? '已通过' : '已拒绝'); qc.invalidateQueries({ queryKey: ['admin', 'menu-permission'] }) },
    onError: (e: Error) => toast.error(e.message),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const head = [t('colName'), t('colCode'), t('colPath'), t('colType'), t('colStatus'), t('colActions')]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><KeyRound className="h-6 w-6 text-primary" />{t('title')}</h1>
        <form onSubmit={form.handleSubmit(() => undefined)}>
          <Input {...form.register('name')} placeholder={t('searchPlaceholder')} className="h-9 w-64" />
        </form>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted-foreground">
            {head.map((h, i) => <th key={h} className={`${c} font-medium${i === 5 ? ' text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-border last:border-0">
                  <td colSpan={6} className={`${c} py-3`}><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : !list.length
              ? <tr><td colSpan={6} className={`${c} py-8 text-center text-muted-foreground`}>{t('noData')}</td></tr>
              : list.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className={`${c} font-medium`}>{m.name}</td>
                  <td className={`${c} text-muted-foreground font-mono text-xs`}>{m.code ?? '—'}</td>
                  <td className={`${c} text-muted-foreground font-mono text-xs`}>{m.path ?? '—'}</td>
                  <td className={c}><span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t(`type_${m.type}`)}</span></td>
                  <td className={c}><span className={`rounded px-2 py-0.5 text-xs ${BADGE[m.status]}`}>{t(`status_${m.status}`)}</span></td>
                  <td className={c}><div className="flex justify-end gap-1">
                    {m.status === 'pending' && (<>
                      <Button size="sm" variant="ghost" disabled={audit.isPending} onClick={() => audit.mutate({ id: m.id, status: 'published' })}><Check className="h-4 w-4" />{t('approve')}</Button>
                      <Button size="sm" variant="ghost" disabled={audit.isPending} onClick={() => audit.mutate({ id: m.id, status: 'rejected' })}><X className="h-4 w-4" />{t('reject')}</Button>
                    </>)}
                  </div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" />{t('prev')}</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('next')}<ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
