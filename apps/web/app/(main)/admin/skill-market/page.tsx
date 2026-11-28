// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 技能市场交易后台（2026-11-28 立）。运营内部页面，文案走中文常量，不占多语言包。
// 后端：GET /api/admin/skills-market/purchases、POST .../:id/refund
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  RotateCcw,
  Search,
  Undo2,
} from 'lucide-react'

import { Button } from '@ihui/ui-react'
import type {
  SkillMarketPurchaseAdminItem,
  SkillMarketPurchaseAdminListResponse,
  SkillMarketSettlementResponse,
  SkillPurchaseRefundResponse,
} from '@ihui/shared/skills/market'
import { apiOrThrow } from '@/lib/api'

const PAGE_SIZE = 20

const STATUS_LABEL: Record<string, string> = {
  paid: '在购',
  refunded: '已退款',
}

function yuan(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

function SettlementPanel({
  data,
  isLoading,
  error,
}: {
  data?: SkillMarketSettlementResponse
  isLoading: boolean
  error: Error | null
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border px-4 py-12 text-center text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        正在汇总结算…
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border px-4 py-12 text-center text-destructive">
        {error.message}
      </div>
    )
  }
  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-lg border px-4 py-12 text-center text-muted-foreground">
        <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-40" />
        暂无可结算的交易
      </div>
    )
  }

  const s = data.summary
  const cards = [
    {
      label: '净成交额',
      value: yuan(s.netGmvCents),
      detail: `累计成交 ${yuan(s.grossSalesCents)} · 退款 ${yuan(s.refundedGrossCents)}`,
    },
    {
      label: '作者净分成',
      value: yuan(s.authorNetCents),
      detail: `销售应得 ${yuan(s.authorShareEarnedCents)} · 已扣回 ${yuan(s.sellerClawbackCents)}`,
    },
    {
      label: '平台净收益',
      value: yuan(s.platformNetCents),
      detail: `销售留存 ${yuan(s.platformShareEarnedCents)} · 平台承担 ${yuan(s.platformBorneCents)}`,
    },
    {
      label: '交易 / 退款',
      value: `${s.paidCount} / ${s.refundedCount}`,
      detail: `在购作者分成 ${yuan(s.authorShareActiveCents)} · 在购平台留存 ${yuan(s.platformShareActiveCents)}`,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border bg-card p-4">
            <div className="text-label uppercase text-muted-foreground">{card.label}</div>
            <div className="mt-1 text-title font-semibold tabular-nums">{card.value}</div>
            <div className="mt-1 text-label text-muted-foreground">{card.detail}</div>
          </div>
        ))}
      </div>

      {s.clawbackMissingCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-body text-amber-800">
          有 {s.clawbackMissingCount}{' '}
          笔历史退款未记录卖家扣回金额，平台承担额需按原始余额流水人工复核。
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-body">
          <thead className="bg-muted/50 text-left text-label uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">技能 / 卖家</th>
              <th className="px-4 py-2.5 font-medium">在购 / 退款</th>
              <th className="px-4 py-2.5 font-medium">净成交</th>
              <th className="px-4 py-2.5 font-medium">作者净分成</th>
              <th className="px-4 py-2.5 font-medium">退款冲正</th>
              <th className="px-4 py-2.5 font-medium">平台净收益</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr
                key={`${item.skillName}:${item.sellerUserId ?? 'platform'}`}
                className="transition-colors hover:bg-muted/30"
              >
                <td className="px-4 py-2.5">
                  <div className="font-medium">{item.skillName}</div>
                  <div className="text-label text-muted-foreground">
                    {item.sellerNickname ??
                      (item.sellerUserId ? shortId(item.sellerUserId) : '平台自营')}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {item.paidCount} / {item.refundedCount}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                  {yuan(item.netGmvCents)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {yuan(item.authorNetCents)}
                  <div className="text-label text-muted-foreground">
                    应得 {yuan(item.authorShareEarnedCents)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  应冲 {yuan(item.authorShareOnRefundedCents)}
                  <div className="text-label">
                    实扣 {yuan(item.sellerClawbackCents)} · 平台担 {yuan(item.platformBorneCents)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                  {yuan(item.platformNetCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminSkillMarketPage() {
  const qc = useQueryClient()
  const [view, setView] = React.useState<'purchases' | 'settlement'>('purchases')
  const [status, setStatus] = React.useState<'all' | 'paid' | 'refunded'>('all')
  const [keywordInput, setKeywordInput] = React.useState('')
  const [keyword, setKeyword] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [target, setTarget] = React.useState<SkillMarketPurchaseAdminItem | null>(null)
  const [reason, setReason] = React.useState('')
  const [banner, setBanner] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin', 'skill-market', 'purchases', status, page, keyword],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (status !== 'all') qs.set('status', status)
      if (keyword) qs.set('keyword', keyword)
      return apiOrThrow<SkillMarketPurchaseAdminListResponse>(
        `/api/admin/skills-market/purchases?${qs.toString()}`,
      )
    },
  })

  const settlementQuery = useQuery({
    queryKey: ['admin', 'skill-market', 'settlement'],
    queryFn: () => apiOrThrow<SkillMarketSettlementResponse>('/api/admin/skills-market/settlement'),
    enabled: view === 'settlement',
  })

  const refundMutation = useMutation({
    mutationFn: async (input: { id: string; reason: string }) =>
      apiOrThrow<SkillPurchaseRefundResponse>(
        `/api/admin/skills-market/purchases/${input.id}/refund`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: input.reason.trim() || undefined }),
        },
      ),
    onSuccess: (result) => {
      setTarget(null)
      setReason('')
      setError(null)
      setBanner(
        result.alreadyRefunded
          ? '该笔交易此前已退款，本次未重复退钱。'
          : `已退款 ${yuan(result.refundedAmountCents)}；从卖家扣回 ${yuan(result.sellerClawbackCents)}，买家余额 ${result.buyerBalanceAfter === null ? '未知' : yuan(result.buyerBalanceAfter)}。`,
      )
      void qc.invalidateQueries({ queryKey: ['admin', 'skill-market'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const total = listQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = listQuery.data?.items ?? []
  const dateFmt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setKeyword(keywordInput.trim())
    setPage(1)
  }

  function openRefund(item: SkillMarketPurchaseAdminItem) {
    setTarget(item)
    setReason('')
    setError(null)
    setBanner(null)
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <div>
        <h1 className="text-display font-bold tracking-tight">技能市场交易</h1>
        <p className="mt-1 text-body text-muted-foreground">
          查看单次买断流水、作者分成与退款状态；退款会回收买家的安装资格。
        </p>
      </div>

      {banner && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-body text-emerald-800">
          {banner}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <Button
          variant={view === 'purchases' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('purchases')}
        >
          <List className="mr-1 h-4 w-4" />
          交易流水
        </Button>
        <Button
          variant={view === 'settlement' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('settlement')}
        >
          <BarChart3 className="mr-1 h-4 w-4" />
          结算汇总
        </Button>
      </div>

      {view === 'settlement' ? (
        <SettlementPanel
          data={settlementQuery.data}
          isLoading={settlementQuery.isLoading}
          error={settlementQuery.error as Error | null}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border bg-background px-3 text-body"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as 'all' | 'paid' | 'refunded')
                setPage(1)
              }}
            >
              <option value="all">全部状态</option>
              <option value="paid">在购</option>
              <option value="refunded">已退款</option>
            </select>
            <form className="flex items-center gap-2" onSubmit={submitSearch}>
              <input
                className="h-9 w-64 rounded-md border bg-background px-3 text-body"
                placeholder="购买 ID / 技能名 / 买家 / 卖家"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
              />
              <Button type="submit" variant="outline" size="sm">
                <Search className="mr-1 h-4 w-4" />
                搜索
              </Button>
            </form>
            <span className="text-body text-muted-foreground">共 {total} 笔</span>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-body">
              <thead className="bg-muted/50 text-left text-label uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">时间</th>
                  <th className="px-4 py-2.5 font-medium">技能</th>
                  <th className="px-4 py-2.5 font-medium">买家 / 卖家</th>
                  <th className="px-4 py-2.5 font-medium">金额</th>
                  <th className="px-4 py-2.5 font-medium">分成</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      加载中…
                    </td>
                  </tr>
                ) : listQuery.error ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-destructive">
                      {(listQuery.error as Error).message}
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      <RotateCcw className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      暂无交易记录
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {dateFmt.format(new Date(item.createdAt))}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{item.skillName}</div>
                        <div className="font-mono text-label text-muted-foreground" title={item.id}>
                          {shortId(item.id)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div>{item.buyerNickname ?? shortId(item.buyerUserId)}</div>
                        <div className="text-label text-muted-foreground">
                          卖家：
                          {item.sellerNickname ??
                            (item.sellerUserId ? shortId(item.sellerUserId) : '平台自营')}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                        {yuan(item.priceCents)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        作者 {yuan(item.authorShareCents)} / 平台 {yuan(item.platformShareCents)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div>{STATUS_LABEL[item.status] ?? item.status}</div>
                        {item.status === 'refunded' && item.refundedAt && (
                          <div className="text-label text-muted-foreground">
                            退 {yuan(item.refundAmountCents)} · 扣回{' '}
                            {item.sellerClawbackCents === null
                              ? '未记录'
                              : yuan(item.sellerClawbackCents)}{' '}
                            · {dateFmt.format(new Date(item.refundedAt))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {item.status === 'paid' ? (
                          <Button variant="outline" size="sm" onClick={() => openRefund(item)}>
                            <Undo2 className="mr-1 h-4 w-4" />
                            退款
                          </Button>
                        ) : (
                          <span className="text-label text-muted-foreground">已退款</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-body text-muted-foreground">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(Math.max(1, page - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-5 shadow-xl">
            <h2 className="text-title font-semibold">确认退款</h2>
            <p className="mt-2 text-body text-muted-foreground">
              技能「{target.skillName}」将全额退回 {yuan(target.priceCents)}；卖家已到账的{' '}
              {yuan(target.authorShareCents)} 会尽量扣回，余额不足部分由平台承担。
            </p>
            <p className="mt-2 text-label text-muted-foreground">
              买家 {target.buyerNickname ?? shortId(target.buyerUserId)} · 购买 {shortId(target.id)}
            </p>
            <textarea
              className="mt-3 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-body"
              placeholder="退款原因（可选，最多 255 字）"
              maxLength={255}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {error && <p className="mt-2 text-body text-destructive">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={refundMutation.isPending}
                onClick={() => {
                  setTarget(null)
                  setError(null)
                }}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={refundMutation.isPending}
                onClick={() => refundMutation.mutate({ id: target.id, reason })}
              >
                {refundMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                确认退款
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
