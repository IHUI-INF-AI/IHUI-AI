// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 报销审批 tab(2026-11-24 九波):管理端视图——列表 + 审批/付款/入账/作废。
 * 提单在员工自助端(/my/submit),此处不代提;权限与流转判定在后端服务层,
 * 前端只展示动作,被 403/409 拒时如实弹原因。
 */
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { RefreshCw, Check, X, Banknote, Link2, CircleSlash, ClipboardList } from 'lucide-react'

import { api } from './types'
import { Card, Empty, Badge, field, th, td, btnGhost } from './ui'

const EXP = '/api/hr-expense'

type Row = Record<string, unknown>
function rowsOf(v: unknown): Row[] {
  if (Array.isArray(v)) return v as Row[]
  const o = v as { rows?: Row[]; list?: Row[] }
  return o?.rows ?? o?.list ?? []
}

export function ExpenseTab() {
  const t = useTranslations('hrGap')
  const tHr = useTranslations('hrLifecycle')
  const qc = useQueryClient()
  const [status, setStatus] = React.useState('')
  const [comment, setComment] = React.useState('')
  const [expanded, setExpanded] = React.useState<string | null>(null)

  const listQ = useQuery({
    queryKey: ['hrx', 'list', status],
    queryFn: () => api<unknown>(`${EXP}/${status ? `?status=${status}` : ''}`),
  })
  const rows = rowsOf(listQ.data)
  const invalidate = () => qc.invalidateQueries({ queryKey: ['hrx'] })

  const decide = useMutation({
    mutationFn: (input: { id: string; action: 'approve' | 'reject' }) =>
      api(`${EXP}/${input.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ action: input.action, comment: comment.trim() || undefined }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const pay = useMutation({
    mutationFn: (input: { id: string; method: string }) =>
      api(`${EXP}/${input.id}/pay`, { method: 'POST', body: JSON.stringify({ method: input.method }) }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const link = useMutation({
    mutationFn: (id: string) =>
      api<{ voucherNo?: string }>(`${EXP}/${id}/link-voucher`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: (r: { voucherNo?: string }) => {
      toast.success(r?.voucherNo ?? t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const voidOne = useMutation({
    mutationFn: (id: string) => api(`${EXP}/${id}/void`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <Card
        title={t('expTitle')}
        actions={
          <div className="flex items-center gap-1">
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{tHr('allStatus')}</option>
              {['submitted', 'approved', 'rejected', 'paid', 'voided'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className={btnGhost} onClick={() => listQ.refetch()}>
              <RefreshCw className="h-3 w-3" />
              {t('refresh')}
            </button>
          </div>
        }
      >
        <div className="mb-2">
          <input className={field} placeholder={t('gradeReason')} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        {rows.length === 0 ? (
          <Empty text={t('noData')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('expEmployee')}</th>
                <th className={th}>{t('titleText')}</th>
                <th className={th}>{t('expCategory')}</th>
                <th className={th}>{t('expAmount')}</th>
                <th className={th}>{t('expReviewer')}</th>
                <th className={th}>{t('colStatus')}</th>
                <th className={th}>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const chain = (r.approverChain ?? []) as string[]
                const cur = String(chain[Number(r.currentStep ?? 0)] ?? '-')
                const vouchers = (r.vouchers ?? []) as Array<{ name?: string }>
                const opened = expanded === String(r.id)
                return (
                  <React.Fragment key={String(r.id)}>
                    <tr className="border-t border-stroke-subtle">
                      <td className={td}>{String(r.employeeId).slice(0, 8)}</td>
                      <td className={td}>
                        <button className={btnGhost} onClick={() => setExpanded(opened ? null : String(r.id))}>
                          <ClipboardList className="h-3 w-3" />
                          {String(r.title)}
                        </button>
                      </td>
                      <td className={td}>{String(r.category)}</td>
                      <td className={`${td} tabular-nums`}>{String(r.amount)}</td>
                      <td className={td}>{r.status === 'submitted' ? cur.slice(0, 8) : '-'}</td>
                      <td className={td}>
                        <Badge status={String(r.status)} />
                        {r.voucherNo ? <span className="ml-1 text-[10px] text-muted-foreground">{String(r.voucherNo)}</span> : null}
                      </td>
                      <td className={td}>
                        <div className="flex flex-wrap gap-0.5">
                          {r.status === 'submitted' ? (
                            <>
                              <button className={btnGhost} disabled={decide.isPending} onClick={() => decide.mutate({ id: String(r.id), action: 'approve' })}>
                                <Check className="h-3 w-3" />
                                {t('expApprove')}
                              </button>
                              <button className={btnGhost} disabled={decide.isPending} onClick={() => decide.mutate({ id: String(r.id), action: 'reject' })}>
                                <X className="h-3 w-3" />
                                {t('expReject')}
                              </button>
                            </>
                          ) : null}
                          {r.status === 'approved' ? (
                            <>
                              <button className={btnGhost} disabled={pay.isPending} onClick={() => pay.mutate({ id: String(r.id), method: 'bank' })}>
                                <Banknote className="h-3 w-3" />
                                {t('expPay')}
                              </button>
                              <button className={btnGhost} disabled={voidOne.isPending} onClick={() => voidOne.mutate(String(r.id))}>
                                <CircleSlash className="h-3 w-3" />
                                {t('expVoid')}
                              </button>
                            </>
                          ) : null}
                          {r.status === 'paid' && r.ledgerId && !r.voucherId ? (
                            <button className={btnGhost} disabled={link.isPending} onClick={() => link.mutate(String(r.id))}>
                              <Link2 className="h-3 w-3" />
                              {t('expLinkVoucher')}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {opened ? (
                      <tr>
                        <td colSpan={7} className={`${td} bg-muted/40`}>
                          <p className="text-[11px]">{`${t('uploadHint')}: ${vouchers.map((v) => v.name ?? '').join(', ') || '-'}`}</p>
                          <p className="text-[11px] text-muted-foreground">{String(r.note ?? '')}</p>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
