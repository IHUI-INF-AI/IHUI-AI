// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 凭证作业(2026-11-23):补的是"制单之后的日常维护"这一段。
 *
 * 为什么单独一个文件:VouchersTab 已经占了"列表 + 提交复核 + 过账 + 审核"四件事,
 * 再往里塞红冲/删除/编辑/批量过账会顶到单文件行数闸。这里只做"对已有凭证返工"的活:
 * 红冲(错账留痕冲正)、软删除(录错撤回)、改摘要与凭证日期、批量过账(月末一次过)、
 * 复核汇总(看还欠多少张没审)、余额重算(结账前把科目余额刷成真账)。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { RefreshCw, RotateCcw, Trash2, Rocket, Save } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { api, rowsOf, FIN_RESOURCE, type FinLedger } from './types'
import { Card, Empty, StatusBadge, field, th, td } from './tabs'

interface FinVoucher {
  id: string
  voucherNo: string
  voucherDate: string
  summary: string | null
  totalDebit: string
  totalCredit: string
  status: string
  reviewStatus: string
  period: string
}

interface ReviewSummary {
  notSubmitted: number
  pending: number
  approved: number
  rejected: number
  pendingAmount: string
  total: number
}

/** 凭证返工作业:红冲 / 删除 / 改摘要与日期 / 批量过账 / 复核汇总 / 余额重算 */
export function VoucherOpsTab({ ledgers }: { ledgers: FinLedger[] }) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [ledgerId, setLedgerId] = React.useState('')
  const [period, setPeriod] = React.useState('')
  const [selected, setSelected] = React.useState<string[]>([])
  const [acting, setActing] = React.useState<{ kind: 'reverse' | 'delete'; id: string } | null>(
    null,
  )
  const [editing, setEditing] = React.useState<{
    id: string
    summary: string
    date: string
  } | null>(null)

  const ledger = ledgers.find((l) => l.id === ledgerId)
  const eff = period || ledger?.currentPeriod || ''

  const listQ = useQuery({
    queryKey: ['fin', 'vouchers-ops', ledgerId, eff],
    queryFn: () =>
      api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/vouchers?period=${eff}&limit=100`),
    enabled: !!ledgerId && !!eff,
  })
  const vouchers = rowsOf<FinVoucher>(listQ.data)

  const reviewQ = useQuery({
    queryKey: ['fin', 'review-summary', ledgerId, eff],
    queryFn: () =>
      api<ReviewSummary>(`${FIN_RESOURCE}/ledgers/${ledgerId}/review-summary?period=${eff}`),
    enabled: !!ledgerId && !!eff,
  })
  const review = reviewQ.data

  const done = (msg?: string) => {
    toast.success(msg ?? t('actionDone'))
    setActing(null)
    setEditing(null)
    setSelected([])
    qc.invalidateQueries({ queryKey: ['fin'] })
  }
  const failed = (e: Error) => toast.error(e.message)

  const postBatch = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/vouchers/post-batch`, {
        method: 'POST',
        body: JSON.stringify({ ids: selected }),
      }),
    onSuccess: () => done(),
    onError: failed,
  })

  const reverseMut = useMutation({
    mutationFn: (id: string) =>
      api(`${FIN_RESOURCE}/vouchers/${id}/reverse`, {
        method: 'POST',
        body: JSON.stringify(eff ? { period: eff } : {}),
      }),
    onSuccess: () => done(t('reverseDone')),
    onError: failed,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`${FIN_RESOURCE}/vouchers/${id}`, { method: 'DELETE' }),
    onSuccess: () => done(t('deleteDone')),
    onError: failed,
  })

  const saveMut = useMutation({
    mutationFn: (p: { id: string; summary: string; date: string }) =>
      api(`${FIN_RESOURCE}/vouchers/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          summary: p.summary.trim() || undefined,
          voucherDate: p.date || undefined,
        }),
      }),
    onSuccess: () => done(t('saveDone')),
    onError: failed,
  })

  const refreshBal = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/trial-balance/refresh`, {
        method: 'POST',
        body: JSON.stringify({ period: eff }),
      }),
    onSuccess: () => done(t('balanceRefreshed')),
    onError: failed,
  })

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const countable = vouchers.filter((v) => v.status !== 'posted')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={field} value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
          <option value="">{t('selectLedger')}</option>
          {ledgers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <input
          className={field}
          placeholder={t('periodPlaceholder')}
          value={eff}
          onChange={(e) => setPeriod(e.target.value)}
          disabled={!ledgerId}
        />
        <Button size="sm" variant="outline" disabled={!ledgerId} onClick={() => listQ.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          {t('refresh')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!ledgerId || !eff || refreshBal.isPending}
          onClick={() => refreshBal.mutate()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('refreshBalance')}
        </Button>
      </div>

      {!ledgerId ? (
        <Empty text={t('needLedger')} />
      ) : (
        <>
          <Card title={t('reviewSummaryTitle')}>
            {review ? (
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                <span>
                  {t('rvNotSubmitted')}: <b>{review.notSubmitted ?? 0}</b>
                </span>
                <span>
                  {t('rvPending')}: <b>{review.pending ?? 0}</b>
                </span>
                <span>
                  {t('rvApproved')}: <b>{review.approved ?? 0}</b>
                </span>
                <span>
                  {t('rvRejected')}: <b>{review.rejected ?? 0}</b>
                </span>
                <span>
                  {t('rvPendingAmount')}: <b>{review.pendingAmount ?? '0.00'}</b>
                </span>
              </div>
            ) : (
              <Empty text={t('loading')} />
            )}
          </Card>

          <Card title={t('voucherOpsTitle')}>
            {selected.length > 0 && (
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span>
                  {t('selectedCount')} {selected.length}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={postBatch.isPending}
                  onClick={() => postBatch.mutate()}
                >
                  <Rocket className="h-3.5 w-3.5" />
                  {t('postBatch')}
                </Button>
              </div>
            )}
            {vouchers.length === 0 ? (
              <Empty text={t('noVouchers')} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}> </th>
                    <th className={th}>{t('voucherNo')}</th>
                    <th className={th}>{t('vDate')}</th>
                    <th className={th}>{t('vSummary')}</th>
                    <th className={th}>{t('debit')}</th>
                    <th className={th}>{t('status')}</th>
                    <th className={th}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v) => (
                    <tr key={v.id} className="border-t border-stroke-subtle">
                      <td className={td}>
                        {v.status !== 'posted' && (
                          <input
                            type="checkbox"
                            checked={selected.includes(v.id)}
                            onChange={() => toggle(v.id)}
                          />
                        )}
                      </td>
                      <td className={td}>{v.voucherNo}</td>
                      <td className={td}>{v.voucherDate}</td>
                      <td className={td}>{v.summary ?? '-'}</td>
                      <td className={td}>{v.totalDebit}</td>
                      <td className={td}>
                        <StatusBadge status={v.status} />
                      </td>
                      <td className={`${td} space-x-2 whitespace-nowrap`}>
                        {acting?.kind === 'reverse' && acting.id === v.id ? (
                          <button
                            className="text-[11px] text-destructive underline"
                            onClick={() => reverseMut.mutate(v.id)}
                          >
                            {t('confirmReverse')}
                          </button>
                        ) : acting?.kind === 'delete' && acting.id === v.id ? (
                          <button
                            className="text-[11px] text-destructive underline"
                            onClick={() => deleteMut.mutate(v.id)}
                          >
                            {t('confirmDelete')}
                          </button>
                        ) : (
                          <>
                            <button
                              className="text-[11px] underline"
                              onClick={() =>
                                setEditing({
                                  id: v.id,
                                  summary: v.summary ?? '',
                                  date: v.voucherDate,
                                })
                              }
                            >
                              {t('edit')}
                            </button>
                            <button
                              className="inline-flex items-center gap-0.5 text-[11px] underline"
                              onClick={() => setActing({ kind: 'reverse', id: v.id })}
                            >
                              <RotateCcw className="h-3 w-3" />
                              {t('reverse')}
                            </button>
                            <button
                              className="inline-flex items-center gap-0.5 text-[11px] underline"
                              onClick={() => setActing({ kind: 'delete', id: v.id })}
                            >
                              <Trash2 className="h-3 w-3" />
                              {t('remove')}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {editing && (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-muted/40 p-2 text-xs">
                <input
                  className={field}
                  placeholder={t('vSummary')}
                  value={editing.summary}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                />
                <input
                  className={field}
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saveMut.isPending}
                  onClick={() =>
                    saveMut.mutate({ id: editing.id, summary: editing.summary, date: editing.date })
                  }
                >
                  <Save className="h-3.5 w-3.5" />
                  {t('save')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                  {t('cancel')}
                </Button>
              </div>
            )}
            {countable.length === 0 && vouchers.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">{t('allPostedHint')}</p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
