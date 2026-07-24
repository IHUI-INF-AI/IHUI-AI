'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { ArrowLeft, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { OrdersTable } from './OrdersTable'
import { PAGE_SIZE } from './types'
import type { ListData } from './types'

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetchApi<T>(url)
    return r.success ? r.data : fallback
  } catch {
    return fallback
  }
}

export default function AdminDistributionOrdersPage() {
  const locale = useLocale()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const listQ = useQuery({
    queryKey: ['admin', 'distribution', 'orders', page, debounced],
    queryFn: () =>
      safeFetch<ListData>(
        `/commission/orders?page=${page}&pageSize=${PAGE_SIZE}${debounced ? `&keyword=${encodeURIComponent(debounced)}` : ''}`,
        { items: [], total: 0 },
      ),
  })

  const items = listQ.data?.items ?? listQ.data?.list ?? []
  const total = listQ.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmtDate = (v: string | null | undefined) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin/distribution"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回分销中心
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">分销订单</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看佣金订单明细与状态</p>
      </div>

      {listQ.isError && (
        <Alert variant="danger" title="加载失败" description="无法获取分销订单列表" />
      )}

      <Card>
        <CardContent className="flex items-center gap-2 p-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索订单号 / 用户"
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      <OrdersTable
        items={items}
        isLoading={listQ.isLoading}
        total={total}
        page={page}
        totalPages={totalPages}
        fmtDate={fmtDate}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  )
}
