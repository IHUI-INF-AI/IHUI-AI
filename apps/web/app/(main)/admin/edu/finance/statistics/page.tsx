'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, BarChart3, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react'
import { eduApi, buildQs, selectClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@ihui/ui'

interface Stats {
  totalRevenue: number
  totalOrders: number
  paidOrders: number
  refundedAmount: number
  avgOrderAmount: number
  byType: { type: string; count: number; amount: number }[]
  byMonth: { month: string; revenue: number; orders: number }[]
}

export default function EduFinanceStatisticsPage() {
  const [period, setPeriod] = React.useState('month')

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'finance', 'statistics', period],
    queryFn: () => eduApi<Stats>(`/api/admin/finance/statistics${buildQs({ period })}`),
    retry: false,
  })

  const noEndpoint = !!(error as Error) && (error as Error).message.includes('请求失败')
  const stats = data

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">财务统计</h1>
        <p className="mt-1 text-sm text-muted-foreground">收入、订单与趋势分析</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/finance">
            <ChevronLeft className="h-4 w-4" />
            返回财务管理
          </Link>
        </Button>
        <div className="w-full max-w-[140px]">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className={selectClass} aria-label="周期">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
              <SelectItem value="year">全年</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : noEndpoint ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
          <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-40" />
          统计端点未配置
        </div>
      ) : !stats ? (
        <div className="rounded-lg border px-4 py-10 text-center text-destructive">
          {(error as Error)?.message ?? '加载失败'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 text-white">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">总收入</div>
                  <div className="mt-1 text-2xl font-semibold">
                    ¥{stats.totalRevenue.toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 text-white">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">订单总数</div>
                  <div className="mt-1 text-2xl font-semibold">{stats.totalOrders}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">已支付</div>
                  <div className="mt-1 text-2xl font-semibold">{stats.paidOrders}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 text-white">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">退款金额</div>
                  <div className="mt-1 text-2xl font-semibold">
                    ¥{stats.refundedAmount.toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-semibold">按商品类型</h2>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="px-4 py-2.5">类型</TableHead>
                      <TableHead className="px-4 py-2.5">订单数</TableHead>
                      <TableHead className="px-4 py-2.5">金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y">
                    {stats.byType?.length ? (
                      stats.byType.map((t) => (
                        <TableRow key={t.type} className="hover:bg-muted/30">
                          <TableCell className="px-4 py-2.5 font-medium">{t.type}</TableCell>
                          <TableCell className="px-4 py-2.5">{t.count}</TableCell>
                          <TableCell className="px-4 py-2.5 font-semibold">
                            ¥{t.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          暂无数据
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-lg font-semibold">月度趋势</h2>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="px-4 py-2.5">月份</TableHead>
                      <TableHead className="px-4 py-2.5">订单数</TableHead>
                      <TableHead className="px-4 py-2.5">收入</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y">
                    {stats.byMonth?.length ? (
                      stats.byMonth.map((m) => (
                        <TableRow key={m.month} className="hover:bg-muted/30">
                          <TableCell className="px-4 py-2.5 font-medium">{m.month}</TableCell>
                          <TableCell className="px-4 py-2.5">{m.orders}</TableCell>
                          <TableCell className="px-4 py-2.5 font-semibold text-emerald-600">
                            ¥{m.revenue.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          暂无数据
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">客单价</span>
                <span className="text-lg font-semibold text-primary">
                  ¥{stats.avgOrderAmount.toFixed(2)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500')}
                  style={{ width: `${Math.min(100, stats.avgOrderAmount / 10)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
