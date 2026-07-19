'use client'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Input } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import type { PointsProduct, PointsProductListData, PointsProductStatus } from './types'

const BADGE: Record<PointsProductStatus, string> = {
  on: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  off: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  soldout: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}
const CATEGORY_LABEL: Record<PointsProduct['category'], string> = {
  virtual: '虚拟物品',
  physical: '实物商品',
  coupon: '优惠券',
  vip: '会员权益',
}
const c = 'px-4 py-3'

export default function AdminPointsMallPage() {
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'points-mall', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: '10' })
      if (search.trim()) qs.set('name', search.trim())
      const r = await fetchApi<PointsProductListData>(`/api/v1/admin/points/mall?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const head = ['商品名称', '类型', '积分', '库存', '已兑/限兑', '状态']
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShoppingBag className="h-6 w-6 text-primary" />
          积分商城
        </h1>
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="搜索商品名" className="h-9 w-64" />
      </div>
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted-foreground">
            {head.map((h) => <th key={h} className={`${c} font-medium`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {!list.length
              ? <tr><td colSpan={6} className={`${c} py-8 text-center text-muted-foreground`}>{isLoading ? '…' : '暂无商品'}</td></tr>
              : list.map((p: PointsProduct) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className={`${c} font-medium`}>{p.name}</td>
                  <td className={c}>{CATEGORY_LABEL[p.category]}</td>
                  <td className={`${c} tabular-nums font-medium`}>{p.pointsCost}</td>
                  <td className={`${c} tabular-nums`}>{p.stock}</td>
                  <td className={`${c} tabular-nums`}>{p.sold}<span className="text-muted-foreground">/{p.limitPerUser}</span></td>
                  <td className={c}><span className={`rounded px-2 py-0.5 text-xs ${BADGE[p.status]}`}>{p.status === 'on' ? '上架' : p.status === 'off' ? '下架' : '售罄'}</span></td>
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
