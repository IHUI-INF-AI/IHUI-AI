'use client'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Receipt, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import type { TaxRule, TaxListData, TaxStatus } from './types'

const BADGE: Record<TaxStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  disabled: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
}
const c = 'px-4 py-3'

export default function AdminTaxPage() {
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tax', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: '10' })
      if (search.trim()) qs.set('name', search.trim())
      const r = await fetchApi<TaxListData>(`/api/v1/admin/billing/tax?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const head = ['规则名称', '类别', '税率', '起征额', '生效时间', '状态']
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Receipt className="h-6 w-6 text-primary" />
          税务规则
        </h1>
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="搜索规则名称" className="h-9 w-64" />
      </div>
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted-foreground">
            {head.map((h) => <th key={h} className={`${c} font-medium`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {!list.length
              ? <tr><td colSpan={6} className={`${c} py-8 text-center text-muted-foreground`}>{isLoading ? '…' : '暂无规则'}</td></tr>
              : list.map((tx: TaxRule) => (
                <tr key={tx.id} className="border-b border-border last:border-0">
                  <td className={c}>
                    <div className="font-medium">{tx.name}</div>
                    <div className="text-xs text-muted-foreground">{tx.description ?? '—'}</div>
                  </td>
                  <td className={c}>{tx.category}</td>
                  <td className={`${c} tabular-nums font-medium`}>{tx.rate}%</td>
                  <td className={`${c} tabular-nums text-muted-foreground`}>¥{tx.threshold.toFixed(2)}</td>
                  <td className={`${c} text-xs text-muted-foreground`}>{tx.effectiveAt?.slice(0, 10) ?? '—'}</td>
                  <td className={c}><span className={`rounded px-2 py-0.5 text-xs ${BADGE[tx.status]}`}>{tx.status === 'active' ? '启用' : '停用'}</span></td>
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
