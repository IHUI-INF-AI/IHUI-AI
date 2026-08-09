'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Calendar, DollarSign, Loader2, Search, TrendingUp } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Button, Card, CardContent, CardHeader, CardTitle,
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

interface Fund {
  id: string
  code: string
  name: string
  type: string | null
  status: number
  createdAt: string
}

interface FundNetValue {
  id: string
  fundId: string
  date: string
  value: string | null
  createdAt: string
}

interface FundListData {
  list: Fund[]
  total: number
  page: number
  pageSize: number
}

interface HistoryData {
  list: FundNetValue[]
  total: number
  page: number
  pageSize: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function formatValue(v: string | null): string {
  if (v === null) return '-'
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(4) : v
}

export default function FundDataPage() {
  const t = useTranslations('fundData')
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [selectedCode, setSelectedCode] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['fund-data', debounced],
    queryFn: () => {
      const qs = new URLSearchParams({ page: '1', pageSize: '50' })
      if (debounced) qs.set('search', debounced)
      return api<FundListData>(`/api/fund?${qs.toString()}`)
    },
  })

  const historyQuery = useQuery({
    queryKey: ['fund-data', 'history', selectedCode],
    queryFn: () => {
      if (!selectedCode) throw new Error('missing code')
      return api<HistoryData>(
        `/api/fund/${encodeURIComponent(selectedCode)}/history?page=1&pageSize=100`,
      )
    },
    enabled: !!selectedCode,
  })

  const funds = data?.list ?? []
  const history = historyQuery.data?.list ?? []

  return (
    <div className="space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TrendingUp className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-primary" />
            {t('search')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              className="h-9 pl-8"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : error ? (
            <Alert variant="danger" title={t('error')} description={(error as Error).message} />
          ) : funds.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10">
              <DollarSign className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('noFunds')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">{t('fundCode')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('fundName')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('fundType')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('fundStatus')}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {funds.map((fund) => (
                    <tr key={fund.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-mono text-xs">{fund.code}</td>
                      <td className="py-2.5 pr-4">{fund.name}</td>
                      <td className="py-2.5 pr-4">
                        {fund.type && (
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {fund.type}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-medium',
                            fund.status === 1
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {fund.status === 1 ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedCode(fund.code)}
                        >
                          {t('viewDetail')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCode} onOpenChange={(open) => !open && setSelectedCode(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <DollarSign className="h-4 w-4 text-primary" />
              {t('viewDetail')}
            </DialogTitle>
            <DialogDescription>{t('history')}</DialogDescription>
          </DialogHeader>

          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : historyQuery.isError ? (
            <Alert variant="danger" title={t('error')} description={(historyQuery.error as Error).message} />
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <Calendar className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('noFunds')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">{t('date')}</th>
                    <th className="pb-2 text-right font-medium">{t('netValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((nv) => (
                    <tr key={nv.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{nv.date}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {formatValue(nv.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}