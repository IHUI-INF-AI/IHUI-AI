// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 买家“我的购买”页（2026-11-28 立）：查看已购 Skill、提交退款申请、跟踪审核结果。
// 申请只创建待审记录；真正退款由运营在后台审核通过后执行。
import * as React from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Clock, Loader2, Receipt, ShoppingBag, Undo2, XCircle } from 'lucide-react'

import type { SkillMyPurchaseItem } from '@ihui/shared/skills/market'
import { AuthGatePrompt, BackButton } from '@/components/common'
import { fetchMySkillPurchases, requestSkillRefund } from '@/lib/skills-market-api'
import { useAuthGate } from '@/hooks/use-auth-gate'

function yuan(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已撤回',
}

export default function MySkillPurchasesPage() {
  const { allow } = useAuthGate()
  const qc = useQueryClient()
  const [target, setTarget] = React.useState<SkillMyPurchaseItem | null>(null)
  const [reason, setReason] = React.useState('')
  const [banner, setBanner] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const query = useQuery({
    queryKey: ['skills-market', 'my-purchases'],
    queryFn: fetchMySkillPurchases,
    enabled: allow,
  })

  const requestMutation = useMutation({
    mutationFn: (input: { purchaseId: string; reason: string }) =>
      requestSkillRefund(input.purchaseId, input.reason),
    onSuccess: (result) => {
      setTarget(null)
      setReason('')
      setError(null)
      setBanner(
        result.alreadyRequested
          ? '该笔购买已有待审退款申请，未重复提交。'
          : '退款申请已提交，等待运营审核；审核通过后原路退回钱包。',
      )
      void qc.invalidateQueries({ queryKey: ['skills-market', 'my-purchases'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const items = query.data?.items ?? []
  const dateFmt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  function openRequest(item: SkillMyPurchaseItem) {
    setTarget(item)
    setReason('')
    setError(null)
    setBanner(null)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-4">
      <BackButton />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            <h1 className="text-display font-bold tracking-tight">我的购买</h1>
          </div>
          <p className="text-label text-muted-foreground">
            查看已购 Skill 与退款进度；提交申请后由运营审核，通过后原路退回钱包。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-label">
          <Link href="/skills-market" className="inline-flex items-center gap-1 text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            返回 Skill 市场
          </Link>
          <Link
            href="/skills-market/earnings"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            我的收益
          </Link>
        </div>
      </header>

      {banner && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-body text-emerald-800">
          {banner}
        </div>
      )}

      {!allow ? (
        <AuthGatePrompt message="登录后查看你的购买记录" />
      ) : query.isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-body text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </div>
      ) : query.error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-body text-destructive">
          {(query.error as Error).message || '加载失败，请稍后重试'}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <ShoppingBag className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p className="text-body font-medium">还没有购买记录</p>
          <p className="mt-1 text-label text-muted-foreground">在 Skill 市场购买付费技能后，这里会显示订单与退款入口。</p>
          <Link href="/skills-market" className="mt-4 inline-flex items-center gap-1 text-label text-primary hover:underline">
            去 Skill 市场看看
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-body">
            <thead className="bg-muted/50 text-left text-label text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">技能</th>
                <th className="px-4 py-2.5 font-medium">成交价</th>
                <th className="px-4 py-2.5 font-medium">购买时间</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const request = item.refundRequest
                return (
                  <tr key={item.id} className="border-t transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.skillName}</div>
                      {request && (
                        <div className="mt-1 text-label text-muted-foreground">
                          {REQUEST_STATUS_LABEL[request.status] ?? request.status}
                          {request.reason ? ` · ${request.reason}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{yuan(item.priceCents)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {dateFmt.format(new Date(item.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'refunded' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-label text-slate-700">
                            <CheckCircle2 className="h-3 w-3" />
                            已退款 {yuan(item.refundAmountCents)}
                          </span>
                          {item.refundedAt && (
                            <div className="mt-1 text-label text-muted-foreground">
                              {dateFmt.format(new Date(item.refundedAt))}
                            </div>
                          )}
                        </div>
                      ) : request?.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-label text-amber-700">
                          <Clock className="h-3 w-3" />
                          退款审核中
                        </span>
                      ) : request?.status === 'rejected' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-label text-red-700">
                            <XCircle className="h-3 w-3" />
                            申请被拒绝
                          </span>
                          {request.reviewNote && (
                            <div className="mt-1 text-label text-muted-foreground">
                              审核说明：{request.reviewNote}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-label text-emerald-700">在购</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.canRequestRefund ? (
                        <button
                          type="button"
                          onClick={() => openRequest(item)}
                          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-label font-medium hover:bg-muted/40"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          {request?.status === 'rejected' ? '重新申请' : '申请退款'}
                        </button>
                      ) : (
                        <span className="text-label text-muted-foreground">
                          {request?.status === 'pending' ? '等待审核' : item.status === 'refunded' ? '已退款' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-5 shadow-xl">
            <h2 className="text-title font-semibold">申请退款</h2>
            <p className="mt-2 text-body text-muted-foreground">
              技能「{target.skillName}」成交价 {yuan(target.priceCents)}。提交后进入运营审核，审核通过才退款，不是立即到账。
            </p>
            <textarea
              className="mt-3 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-body"
              placeholder="请说明退款原因（至少 5 个字，最多 500 字）"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {error && <p className="mt-2 text-body text-destructive">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-label"
                disabled={requestMutation.isPending}
                onClick={() => {
                  setTarget(null)
                  setError(null)
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-label font-medium text-primary-foreground disabled:opacity-60"
                disabled={requestMutation.isPending || reason.trim().length < 5}
                onClick={() => requestMutation.mutate({ purchaseId: target.id, reason: reason.trim() })}
              >
                {requestMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                提交申请
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
