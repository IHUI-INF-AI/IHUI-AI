'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Wallet as WalletIcon, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { z } from 'zod'
import { Input, Button } from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useZodForm } from '@/hooks/use-zod-form'
import { fetchApi } from '@/lib/api'
import type { Wallet, WalletListData } from './types'

const PAGE_SIZE = 20

const filterSchema = z.object({
  keyword: z.string().max(64, 'maxLength'),
})
type FilterForm = z.infer<typeof filterSchema>

const STATUS_CLASS: Record<number, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  2: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export default function AdminWalletPage() {
  const t = useTranslations('admin.wallet')
  const locale = useLocale()
  const [page, setPage] = React.useState(1)
  const { form } = useZodForm<FilterForm>({
    schema: filterSchema,
    defaultValues: { keyword: '' },
  })
  const search = form.watch('keyword')
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (search) qs.set('keyword', search)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'wallet', search, page],
    queryFn: async () => {
      const r = await fetchApi<WalletListData>(`/api/v1/admin/finance/wallet?${qs.toString()}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })
  const num = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <WalletIcon className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <form onSubmit={form.handleSubmit(() => undefined)} className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            {...form.register('keyword')}
            placeholder={t('searchPlaceholder')}
            className="pl-8"
            aria-invalid={!!form.formState.errors.keyword}
          />
        </div>
      </form>

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{t('colUser')}</th>
              <th className="px-3 py-2 text-right">{t('colBalance')}</th>
              <th className="px-3 py-2 text-right">{t('colFrozen')}</th>
              <th className="px-3 py-2 text-right">{t('colRecharge')}</th>
              <th className="px-3 py-2 text-right">{t('colConsume')}</th>
              <th className="px-3 py-2 text-left">{t('colStatus')}</th>
              <th className="px-3 py-2 text-left">{t('colUpdated')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-border">
                  <td colSpan={7} className="px-3 py-2"><Skeleton className="h-6 w-full" /></td>
                </tr>
              ))
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              list.map((w: Wallet) => (
                <tr key={w.id} className="border-t border-border">
                  <td className="px-3 py-2">{w.userName ?? w.userId}</td>
                  <td
                    className={`px-3 py-2 text-right font-medium tabular-nums ${
                      w.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {num.format(w.balance)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{num.format(w.frozenBalance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num.format(w.totalRecharge)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num.format(w.totalConsume)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs ${STATUS_CLASS[w.status] ?? STATUS_CLASS[0]}`}>
                      {t(`status.${w.status}` as 'status.0')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmt.format(new Date(w.updatedAt))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
