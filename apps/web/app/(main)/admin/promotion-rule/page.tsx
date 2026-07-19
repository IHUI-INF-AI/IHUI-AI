'use client'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Percent, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Input } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import type { PromotionRule, PromotionRuleListData, PromotionStatus, PromotionType } from './types'

const BADGE: Record<PromotionStatus, string> = {
  draft: 'bg-muted text-muted-foreground', active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', expired: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
}
const SL: Record<PromotionStatus, string> = { draft: '草稿', active: '进行中', paused: '已暂停', expired: '已结束' }
const TL: Record<PromotionType, string> = { discount: '限时折扣', fullReduction: '满减', flash: '限时特价', bundle: '组合套餐', seckill: '秒杀' }
const c = 'px-4 py-3'
const fmt = (v: string | null) => (v ? v.replace('T', ' ').slice(0, 16) : '—')

function fmtDiscount(r: PromotionRule) {
  if (r.type === 'fullReduction') return `满 ¥${r.threshold.toFixed(2)} 减 ${r.discountType === 'amount' ? `¥${r.discount.toFixed(2)}` : `${r.discount}%`}`
  return r.discountType === 'amount' ? `减 ¥${r.discount.toFixed(2)}` : `${r.discount}% 折`
}

export default function AdminPromotionRulePage() {
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'promotion-rule', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: '10' })
      if (search.trim()) qs.set('name', search.trim())
      const r = await fetchApi<PromotionRuleListData>(`/api/v1/admin/promotions/rules?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const head = ['规则名称', '类型', '门槛/优惠', '适用范围', '状态', '有效期']
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Percent className="h-6 w-6 text-primary" />促销规则
        </h1>
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="搜索规则名" className="h-9 w-64" />
      </div>
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted-foreground">
            {head.map((h) => <th key={h} className={`${c} font-medium`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {!list.length
              ? <tr><td colSpan={6} className={`${c} py-8 text-center text-muted-foreground`}>{isLoading ? '…' : '暂无规则'}</td></tr>
              : list.map((r: PromotionRule) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className={c}><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">优先级 {r.priority}</div></td>
                  <td className={c}>{TL[r.type]}</td>
                  <td className={`${c} tabular-nums`}>{fmtDiscount(r)}</td>
                  <td className={c}>{r.scope === 'all' ? '全场' : `${r.scope === 'category' ? '分类' : '商品'}:${r.scopeRef ?? '—'}`}</td>
                  <td className={c}><span className={`rounded px-2 py-0.5 text-xs ${BADGE[r.status]}`}>{SL[r.status]}</span></td>
                  <td className={`${c} text-xs text-muted-foreground`}>{fmt(r.startTime)} ~ {fmt(r.endTime)}</td>
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
