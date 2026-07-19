'use client'
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { CalendarCheck, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button, Input } from '@ihui/ui'
import { Skeleton } from '@/components/ui/skeleton'
import { useZodForm } from '@/hooks/use-zod-form'
import { fetchApi } from '@/lib/api'
import type { SigninRule, SigninRuleListData, SigninRuleStatus } from './types'

const filterSchema = z.object({
  keyword: z.string().max(64, 'maxLength'),
})
type FilterForm = z.infer<typeof filterSchema>

const BADGE: Record<SigninRuleStatus, string> = {
  draft: 'bg-muted text-muted-foreground', pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}
const c = 'px-4 py-3'

export default function AdminSigninRulePage() {
  const t = useTranslations('admin.signinRule')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const { form } = useZodForm<FilterForm>({
    schema: filterSchema,
    defaultValues: { keyword: '' },
  })
  const search = form.watch('keyword')
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'signinRule', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: '10' })
      if (search.trim()) qs.set('keyword', search.trim())
      const r = await fetchApi<SigninRuleListData>(`/api/v1/admin/promotions/signin-rules?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SigninRuleStatus }) =>
      fetchApi(`/api/v1/admin/promotions/signin-rules/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: () => { toast.success(t('updateSuccess')); qc.invalidateQueries({ queryKey: ['admin', 'signinRule'] }) },
    onError: (e: Error) => toast.error(e.message),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const head = [t('colDay'), t('colPoints'), t('colExtra'), t('colStatus'), t('colActions')]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><CalendarCheck className="h-6 w-6 text-primary" />{t('title')}</h1>
        <div className="flex items-center gap-2">
          <form onSubmit={form.handleSubmit(() => undefined)}>
            <Input {...form.register('keyword')} placeholder={t('searchPlaceholder')} className="h-9 w-64" />
          </form>
          <Button size="sm"><Plus className="h-4 w-4" />{t('add')}</Button>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted-foreground">
            {head.map((h, i) => <th key={h} className={`${c} font-medium${i === 4 ? ' text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-border last:border-0">
                  <td colSpan={5} className={`${c} py-3`}><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : !list.length
              ? <tr><td colSpan={5} className={`${c} py-8 text-center text-muted-foreground`}>{t('noData')}</td></tr>
              : list.map((r: SigninRule) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className={`${c} font-medium tabular-nums`}>{t('dayN', { n: r.day })}</td>
                  <td className={c}><span className="tabular-nums text-emerald-600 dark:text-emerald-400">+{r.points}</span></td>
                  <td className={c}><span className="tabular-nums text-sky-600 dark:text-sky-400">{r.extra > 0 ? `+${r.extra}` : '—'}</span></td>
                  <td className={c}><span className={`rounded px-2 py-0.5 text-xs ${BADGE[r.status]}`}>{t(`status.${r.status}`)}</span></td>
                  <td className={c}><div className="flex justify-end">
                    <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: r.id, status: r.status === 'published' ? 'draft' : 'published' })}>{t('toggle')}</Button>
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
