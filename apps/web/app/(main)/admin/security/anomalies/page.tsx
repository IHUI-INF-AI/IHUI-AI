'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2,
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, cn } from '@ihui/ui-react'
import {
  fetchAnomalies,
  formatTime,
  scoreClass,
  recommendationClass,
  recommendationLabel,
  PAGE_SIZE,
} from './helpers'
import type { AnomalyEvent } from './types'

export default function AnomaliesPage() {
  const t = useTranslations('admin.anomalies')
  const [page, setPage] = React.useState(1)
  const [ipInput, setIpInput] = React.useState('')
  const [ip, setIp] = React.useState('')
  const [minScoreInput, setMinScoreInput] = React.useState('')
  const [minScore, setMinScore] = React.useState<number | undefined>(undefined)
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

  const offset = (page - 1) * PAGE_SIZE
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'anomalies', ip, minScore, page],
    queryFn: () => fetchAnomalies({ limit: PAGE_SIZE, offset, ip: ip || undefined, minScore }),
  })

  React.useEffect(() => {
    if (error) toast.error((error as Error).message)
  }, [error])

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function applyFilters() {
    setPage(1)
    setIp(ipInput.trim())
    const n = minScoreInput === '' ? undefined : Number(minScoreInput)
    setMinScore(n !== undefined && !Number.isNaN(n) ? n : undefined)
  }
  function resetFilters() {
    setPage(1)
    setIpInput('')
    setMinScoreInput('')
    setIp('')
    setMinScore(undefined)
  }
  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('filters')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              applyFilters()
            }}
          >
            <Input
              className="max-w-[200px]"
              placeholder={t('ipPlaceholder')}
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              max={100}
              className="max-w-[180px]"
              placeholder={t('minScorePlaceholder')}
              value={minScoreInput}
              onChange={(e) => setMinScoreInput(e.target.value)}
            />
            <Button type="submit" size="sm">
              <Search className="h-4 w-4" />
              {t('search')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              {t('reset')}
            </Button>
          </form>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">{t('colTime')}</th>
                  <th className="px-3 py-2">{t('colIp')}</th>
                  <th className="px-3 py-2">{t('colUser')}</th>
                  <th className="px-3 py-2">{t('colUrl')}</th>
                  <th className="px-3 py-2 text-right">{t('colScore')}</th>
                  <th className="px-3 py-2">{t('colRecommendation')}</th>
                  <th className="px-3 py-2">{t('colDetail')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      {t('loading')}
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                      <ShieldAlert className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      {t('empty')}
                    </td>
                  </tr>
                ) : (
                  list.map((ev: AnomalyEvent) => {
                    const rowId = `${ev.timestamp}-${ev.ip}`
                    const isOpen = expanded.has(rowId)
                    return (
                      <React.Fragment key={rowId}>
                        <tr className="hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                            {formatTime(ev.timestamp)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{ev.ip}</td>
                          <td className="px-3 py-2 text-xs">
                            {ev.userId ? ev.userId.slice(0, 8) : '-'}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground" title={ev.url}>
                            {ev.url.length > 50 ? ev.url.slice(0, 50) + '…' : ev.url}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right font-semibold tabular-nums',
                              scoreClass(ev.score),
                            )}
                          >
                            {ev.score}
                          </td>
                          <td className="px-3 py-2">
                            <Badge className={recommendationClass(ev.recommendation)}>
                              {recommendationLabel(ev.recommendation)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => toggleRow(rowId)}
                              aria-label={isOpen ? t('collapse') : t('expand')}
                            >
                              {isOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-muted/20">
                            <td colSpan={7} className="px-3 py-2">
                              {ev.dimensions.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  {t('noDimensions')}
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {ev.dimensions.map((d) => (
                                    <span
                                      key={d.name}
                                      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                                    >
                                      <span className="text-muted-foreground">{d.name}</span>
                                      <span className="ml-2 font-semibold tabular-nums">
                                        {d.score}
                                      </span>
                                      <span className="ml-1 text-muted-foreground">
                                        w{d.weight}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
