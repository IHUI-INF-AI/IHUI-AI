'use client'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gift, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Input } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import type { Lottery, LotteryListData, LotteryStatus } from './types'

const BADGE: Record<LotteryStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  finished: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}
const STATUS_LABEL: Record<LotteryStatus, string> = {
  draft: '草稿',
  active: '进行中',
  finished: '已结束',
  cancelled: '已取消',
}
const c = 'px-4 py-3'
const fmt = (v: string | null) => (v ? v.replace('T', ' ').slice(0, 16) : '—')

export default function AdminLotteryPage() {
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'lottery', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: '10' })
      if (search.trim()) qs.set('name', search.trim())
      const r = await fetchApi<LotteryListData>(`/api/v1/admin/promotions/lottery?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const head = ['活动名称', '消耗积分', '参与/中奖', '奖品数', '状态', '时间']
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Gift className="h-6 w-6 text-primary" />
          抽奖活动
        </h1>
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="搜索活动名" className="h-9 w-64" />
      </div>
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted-foreground">
            {head.map((h) => <th key={h} className={`${c} font-medium`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {!list.length
              ? <tr><td colSpan={6} className={`${c} py-8 text-center text-muted-foreground`}>{isLoading ? '…' : '暂无活动'}</td></tr>
              : list.map((l: Lottery) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className={`${c} font-medium`}>{l.name}</td>
                  <td className={`${c} tabular-nums`}>{l.costPoints}<span className="text-muted-foreground">/次</span></td>
                  <td className={`${c} tabular-nums`}>{l.participants}<span className="text-muted-foreground">/{l.winners}</span></td>
                  <td className={c}>{l.prizes.length}</td>
                  <td className={c}><span className={`rounded px-2 py-0.5 text-xs ${BADGE[l.status]}`}>{STATUS_LABEL[l.status]}</span></td>
                  <td className={`${c} text-xs text-muted-foreground`}>{fmt(l.startTime)} ~ {fmt(l.endTime)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" />上一页</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页<ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
