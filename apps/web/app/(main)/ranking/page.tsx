'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
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
} from '@ihui/ui'

interface RankItem {
  id: string
  rank: number
  nickname: string
  score: number
}

type RankRange = 'week' | 'month' | 'total'

const RANGES: { key: RankRange; label: string }[] = [
  { key: 'week', label: '周榜' },
  { key: 'month', label: '月榜' },
  { key: 'total', label: '总榜' },
]

export default function RankingPage() {
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
          综合排行榜
        </h1>
        <p className="text-sm text-muted-foreground">查看用户积分与活跃度排名</p>
      </header>

      <Tabs value={range} onValueChange={(v) => setRange(v as RankRange)}>
        <TabsList>
          {RANGES.map((r) => (
            <TabsTrigger key={r.key} value={r.key}>
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {RANGES.map((r) => (
          <TabsContent key={r.key} value={r.key}>
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    加载中...
                  </div>
                ) : list.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">暂无排行数据</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-20 px-4 py-2.5">排名</TableHead>
                        <TableHead className="px-4 py-2.5">用户</TableHead>
                        <TableHead className="px-4 py-2.5 text-right">积分</TableHead>
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
