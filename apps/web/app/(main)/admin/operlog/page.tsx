'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { z } from 'zod'
import { Activity, Trash2, Eraser, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Button, Input } from '@ihui/ui'
import { Skeleton } from '@/components/ui/skeleton'
import { useBatchMutation } from '@/hooks/use-batch-mutation'
import { useZodForm } from '@/hooks/use-zod-form'
import type { OperLog, ListResp } from './types'

const PAGE_SIZE = 15
const RESOURCE = '/api/v1/admin/sys/operlog'

const filterSchema = z.object({
  title: z.string().max(50, 'maxLength'),
  operName: z.string().max(30, 'maxLength'),
})
type FilterForm = z.infer<typeof filterSchema>

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AdminOperlogPage() {
  const t = useTranslations('admin.operlog')
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const { form, tValidation } = useZodForm<FilterForm>({
    schema: filterSchema,
    defaultValues: { title: '', operName: '' },
  })
  const title = form.watch('title')
  const operName = form.watch('operName')
  const titleErr = form.formState.errors.title?.message
  const operNameErr = form.formState.errors.operName?.message

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (title) qs.set('title', title)
  if (operName) qs.set('operName', operName)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'operlog', qs.toString()],
    queryFn: () => api<ListResp<OperLog>>(`${RESOURCE}?${qs}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dtf = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })

  const delMut = useBatchMutation({
    endpoint: RESOURCE,
    method: 'DELETE',
    queryKey: ['admin', 'operlog'],
    ids: [],
    successMessage: t('deleteSuccess'),
  })
  const cleanMut = useMutation({
    mutationFn: () => api(`${RESOURCE}/clean`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'operlog'] }); toast.success(t('cleanSuccess')) },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Activity className="h-6 w-6 text-primary" />{t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <form onSubmit={form.handleSubmit(() => undefined)} className="flex flex-wrap items-start gap-2">
        <div className="space-y-1">
          <Input
            placeholder={t('titlePlaceholder')}
            {...form.register('title')}
            className="max-w-xs"
            aria-invalid={!!titleErr}
          />
          {titleErr && <p className="text-xs text-destructive">{tValidation('maxLength', { max: 50 })}</p>}
        </div>
        <div className="space-y-1">
          <Input
            placeholder={t('operNamePlaceholder')}
            {...form.register('operName')}
            className="max-w-xs"
            aria-invalid={!!operNameErr}
          />
          {operNameErr && <p className="text-xs text-destructive">{tValidation('maxLength', { max: 30 })}</p>}
        </div>
        <Button type="submit" size="sm">{t('search')}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { form.reset(); setPage(1) }}>{t('reset')}</Button>
        <Button type="button" size="sm" variant="outline" disabled={cleanMut.isPending}
          onClick={() => { if (confirm(t('confirmClean'))) cleanMut.mutate() }}>
          <Eraser className="h-4 w-4" />{t('clean')}
        </Button>
        <span className="self-center text-sm text-muted-foreground">{t('total', { total })}</span>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('colTitle')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colOperName')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colIp')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colStatus')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colCostTime')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colOperTime')}</th>
              <th className="px-4 py-2.5 font-medium text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={7} className="px-4 py-2.5"><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : list.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{t('noData')}</td></tr>
            ) : list.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{row.title}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.operName}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.operIp}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${row.status === 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                    {row.status === 0 ? t('statusSuccess') : t('statusError')}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.costTime}ms</td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.operTime ? dtf.format(new Date(row.operTime)) : '-'}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    disabled={delMut.isPending}
                    onClick={() => { if (confirm(t('confirmDelete'))) delMut.mutate([row.id]) }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('pageInfo', { page, totalPages })}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />{t('prev')}
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              {t('next')}<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
