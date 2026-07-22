'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Trophy } from 'lucide-react'
import { Card, CardContent, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { fetchAiWorldRankings, fetchLeaderboards } from './helpers'
import type { LeaderboardId, AiWorldRanking } from './types'

const LEADERBOARDS: LeaderboardId[] = ['lmsys', 'opencompass', 'hf-open-llm', 'superclue', 'artificial-analysis']
const KNOWN_CATS = ['overall', 'coding', 'math', 'reasoning', 'chinese', 'english', 'multiturn', 'hard-prompts']
const REFRESH_MS = 5 * 60 * 1000

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-950/40'
  if (rank === 2) return 'text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-800/60'
  if (rank === 3) return 'text-orange-700 dark:text-orange-500 bg-orange-100 dark:bg-orange-950/40'
  return 'text-muted-foreground bg-muted/50'
}

function extractScores(scores: Record<string, unknown> | null): Array<{ key: string; value: number }> {
  if (!scores) return []
  const out: Array<{ key: string; value: number }> = []
  for (const [k, v] of Object.entries(scores)) {
    if (typeof v === 'number' && Number.isFinite(v)) out.push({ key: k, value: v })
  }
  return out.slice(0, 3)
}

const btnBase = 'inline-flex items-center rounded-md text-xs transition-colors'
const btnActive = 'bg-accent text-accent-foreground'
const btnIdle = 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'

export function RankingTable() {
  const t = useTranslations('common.aiWorld.rankings')
  const tCat = useTranslations('common.aiWorld.rankings.categories')
  const tLb = useTranslations('common.aiWorld.rankings.leaderboards')
  const locale = useLocale()
  const timeFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    [locale],
  )

  const [leaderboard, setLeaderboard] = React.useState<LeaderboardId>('lmsys')
  const [category, setCategory] = React.useState<string | null>(null)

  const { data: leaderboardsData } = useQuery({
    queryKey: ['ai-world-leaderboards'],
    queryFn: fetchLeaderboards,
    staleTime: REFRESH_MS,
  })

  const cats = React.useMemo(
    () => leaderboardsData?.find((l) => l.leaderboard === leaderboard)?.categories ?? [],
    [leaderboardsData, leaderboard],
  )

  React.useEffect(() => {
    setCategory((prev) => (prev && cats.includes(prev) ? prev : cats[0] ?? null))
  }, [cats])

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['ai-world-rankings', leaderboard, category],
    queryFn: () => fetchAiWorldRankings({ leaderboard, category: category ?? undefined, limit: 50 }),
    refetchInterval: REFRESH_MS,
    enabled: !!category,
  })

  const items: AiWorldRanking[] = data?.items ?? []
  const fmtTime = (v: string | null) => {
    if (!v) return ''
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '' : timeFmt.format(d)
  }
  const catLabel = (c: string) => (KNOWN_CATS.includes(c) ? tCat(c) : c)

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-semibold">
              <Trophy className="h-4 w-4" />
              <span>{t('title')}</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
          <span className="hidden shrink-0 text-xs text-muted-foreground/70 sm:inline">{t('refresh')}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
          {LEADERBOARDS.map((lb) => (
            <button
              key={lb}
              type="button"
              onClick={() => setLeaderboard(lb)}
              className={`${btnBase} gap-1.5 px-2.5 py-1 ${leaderboard === lb ? btnActive : btnIdle}`}
            >
              <span>{tLb(lb)}</span>
            </button>
          ))}
        </div>

        {cats.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`${btnBase} px-2 py-0.5 ${category === c ? btnActive : btnIdle}`}
              >
                <span>{catLabel(c)}</span>
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center rounded-md border border-dashed py-10 text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          <div className="relative">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">{t('columns.rank')}</TableHead>
                  <TableHead>{t('columns.model')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('columns.provider')}</TableHead>
                  <TableHead className="w-20">{t('columns.score')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('columns.details')}</TableHead>
                  <TableHead className="hidden w-28 md:table-cell">{t('columns.fetchedAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const details = extractScores(item.scores)
                  return (
                    <TableRow key={item.id} className="hover:bg-accent/40">
                      <TableCell>
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${rankBadgeClass(item.rank)}`}>
                          {item.rank}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{item.modelName}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{item.provider ?? '-'}</TableCell>
                      <TableCell className="font-medium tabular-nums">{item.score ?? '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {details.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {details.map((d) => (
                              <span key={d.key} className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                <span className="opacity-70">{d.key}</span>
                                <span className="ml-1 tabular-nums">{d.value}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-xs tabular-nums text-muted-foreground md:table-cell">
                        {fmtTime(item.fetchedAt) || '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {isFetching && (
              <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
