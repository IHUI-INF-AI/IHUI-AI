'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Trophy, Medal } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui-react'

interface RankItem {
  id: string
  rank: number
  nickname: string
  score: number
}

type RankRange = 'week' | 'month' | 'total'

const RANGES: RankRange[] = ['week', 'month', 'total']

export default function RankingPage() {
  const t = useTranslations('rankingPage')
  const [range, setRange] = React.useState<RankRange>('week')

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['ranking', range],
    queryFn: async () => {
      const r = await fetchApi<RankItem[]>(`/api/ranking?range=${range}`)
      if (r.success && r.data) return r.data
      return []
    },
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Trophy className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Tabs value={range} onValueChange={(v) => setRange(v as RankRange)}>
        <TabsList>
          {RANGES.map((r) => (
            <TabsTrigger key={r} value={r}>
              {t(`range.${r}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {RANGES.map((r) => (
          <TabsContent key={r} value={r}>
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t('loading')}
                  </div>
                ) : list.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">{t('empty')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-20 px-4 py-2.5">{t('col.rank')}</TableHead>
                        <TableHead className="px-4 py-2.5">{t('col.user')}</TableHead>
                        <TableHead className="px-4 py-2.5 text-right">{t('col.score')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="px-4 py-2.5 font-medium">
                            {item.rank <= 3 ? (
                              <Medal className="h-5 w-5 text-amber-500" />
                            ) : (
                              item.rank
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-2.5">{item.nickname}</TableCell>
                          <TableCell className="px-4 py-2.5 text-right font-medium">
                            {item.score}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
