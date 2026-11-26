// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, RefreshCw, CheckCircle2 } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import {
  api,
  rowsOf,
  FIN_RESOURCE,
  type FinClient,
  type FinLedger,
  type FinVoucher,
  type FinFilingTask,
} from './types'

export const field =
  'rounded-md border border-stroke-default bg-background px-2 py-1 text-sm focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-stroke-focus'

export function Card({
  title,
  actions,
  children,
}: {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-stroke-subtle bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function Empty({ text }: { text: string }) {
  return <p className="font-[weight:inherit] py-3 text-center text-label text-muted-foreground">{text}</p>
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'posted' || status === 'accepted' || status === 'matched'
      ? 'bg-success/10 text-success'
      : status === 'draft' || status === 'pending' || status === 'ignored'
        ? 'bg-muted text-muted-foreground'
        : status === 'failed' || status === 'voided'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-warning/10 text-warning'
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
      {status}
    </span>
  )
}

export const th = 'px-2 py-1 text-left text-[11px] font-medium text-muted-foreground'
export const td = 'px-2 py-1 text-xs'

/** 客户 + 账套:新客户上线第一步(建客户 → 建账套自动带 63 科目模板) */
export function ClientsTab() {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [name, setName] = React.useState('')
  const [taxNo, setTaxNo] = React.useState('')
  const [taxpayerType, setTaxpayerType] = React.useState<'small' | 'general'>('small')

  const clientsQ = useQuery({
    queryKey: ['fin', 'clients'],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/clients?limit=50`),
  })
  const ledgersQ = useQuery({
    queryKey: ['fin', 'ledgers'],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/ledgers?limit=50`),
  })
  const clients = rowsOf<FinClient>(clientsQ.data)
  const ledgers = rowsOf<FinLedger>(ledgersQ.data)

  const createMut = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/clients`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), taxNo: taxNo.trim() || undefined, taxpayerType }),
      }),
    onSuccess: () => {
      toast.success(t('created'))
      setName('')
      setTaxNo('')
      qc.invalidateQueries({ queryKey: ['fin', 'clients'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const createLedgerMut = useMutation({
    mutationFn: (clientId: string) =>
      api(`${FIN_RESOURCE}/ledgers`, {
        method: 'POST',
        body: JSON.stringify({ clientId, name: t('defaultLedgerName') }),
      }),
    onSuccess: () => {
      toast.success(t('created'))
      qc.invalidateQueries({ queryKey: ['fin', 'ledgers'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <Card title={t('clientsTitle')}>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <input
            className={field}
            placeholder={t('name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={field}
            placeholder={t('taxNo')}
            value={taxNo}
            onChange={(e) => setTaxNo(e.target.value)}
          />
          <select
            className={field}
            value={taxpayerType}
            onChange={(e) => setTaxpayerType(e.target.value === 'general' ? 'general' : 'small')}
          >
            <option value="small">{t('small')}</option>
            <option value="general">{t('general')}</option>
          </select>
          <Button
            size="sm"
            disabled={!name.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('create')}
          </Button>
        </div>
        {clients.length === 0 ? (
          <Empty text={t('noClients')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('name')}</th>
                <th className={th}>{t('taxNo')}</th>
                <th className={th}>{t('taxpayerType')}</th>
                <th className={th}>{t('status')}</th>
                <th className={th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-stroke-subtle">
                  <td className={td}>{c.name}</td>
                  <td className={td}>{c.taxNo ?? '-'}</td>
                  <td className={td}>{c.taxpayerType === 'general' ? t('general') : t('small')}</td>
                  <td className={td}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className={td}>
                    <button
                      className="text-[11px] text-brand-accent-deep underline disabled:opacity-50"
                      disabled={createLedgerMut.isPending}
                      onClick={() => createLedgerMut.mutate(c.id)}
                    >
                      {t('createLedger')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={t('ledgersTitle')}>
        {ledgers.length === 0 ? (
          <Empty text={t('noLedgers')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('ledgerName')}</th>
                <th className={th}>{t('currentPeriod')}</th>
                <th className={th}>{t('reviewRequired')}</th>
                <th className={th}>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.map((l) => (
                <tr key={l.id} className="border-t border-stroke-subtle">
                  <td className={td}>{l.name}</td>
                  <td className={td}>{l.currentPeriod}</td>
                  <td className={td}>{l.reviewRequired ? t('yes') : t('no')}</td>
                  <td className={td}>
                    <StatusBadge status={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

/** 凭证与复核:复核需要的账套在列表里直接看复核队列 */
export function VouchersTab({ ledgers }: { ledgers: FinLedger[] }) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [ledgerId, setLedgerId] = React.useState('')

  const vouchersQ = useQuery({
    queryKey: ['fin', 'vouchers', ledgerId],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/vouchers?limit=50`),
    enabled: !!ledgerId,
  })
  const queueQ = useQuery({
    queryKey: ['fin', 'review-queue', ledgerId],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/review-queue`),
    enabled: !!ledgerId,
  })
  const vouchers = rowsOf<FinVoucher>(vouchersQ.data)
  const queue = rowsOf<FinVoucher>(queueQ.data)

  const act = useMutation({
    mutationFn: (p: {
      id: string
      kind: 'post' | 'submit' | 'approve' | 'reject'
      reason?: string
    }) => {
      const path =
        p.kind === 'post' ? `/vouchers/${p.id}/post` : `/vouchers/${p.id}/${p.kind}-review`
      return api(`${FIN_RESOURCE}${path}`, {
        method: 'POST',
        body: JSON.stringify(
          p.kind === 'reject' ? { comment: p.reason ?? t('defaultReject') } : {},
        ),
      })
    },
    onSuccess: () => {
      toast.success(t('actionDone'))
      qc.invalidateQueries({ queryKey: ['fin', 'vouchers', ledgerId] })
      qc.invalidateQueries({ queryKey: ['fin', 'review-queue', ledgerId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={field} value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
          <option value="">{t('selectLedger')}</option>
          {ledgers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}({l.currentPeriod})
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled={!ledgerId}
          onClick={() => vouchersQ.refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('refresh')}
        </Button>
      </div>

      {!ledgerId ? (
        <Empty text={t('needLedger')} />
      ) : (
        <>
          <Card title={t('reviewQueueTitle')}>
            {queue.length === 0 ? (
              <Empty text={t('noReviewQueue')} />
            ) : (
              <ul className="space-y-1">
                {queue.map((v) => (
                  <li key={v.id} className="font-[weight:inherit] flex flex-wrap items-center gap-2 text-label">
                    <span className="font-mono">{v.voucherNo}</span>
                    <span>{v.summary ?? '-'}</span>
                    <span className="text-muted-foreground">
                      {t('debit')} {v.totalDebit} / {t('credit')} {v.totalCredit}
                    </span>
                    <button
                      className="text-[11px] text-success underline"
                      onClick={() => act.mutate({ id: v.id, kind: 'approve' })}
                    >
                      {t('approve')}
                    </button>
                    <button
                      className="text-[11px] text-destructive underline"
                      onClick={() => act.mutate({ id: v.id, kind: 'reject' })}
                    >
                      {t('reject')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t('vouchersTitle')}>
            {vouchers.length === 0 ? (
              <Empty text={t('noVouchers')} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>{t('voucherNo')}</th>
                    <th className={th}>{t('vDate')}</th>
                    <th className={th}>{t('vSummary')}</th>
                    <th className={th}>{t('debit')}</th>
                    <th className={th}>{t('credit')}</th>
                    <th className={th}>{t('status')}</th>
                    <th className={th}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v) => (
                    <tr key={v.id} className="border-t border-stroke-subtle">
                      <td className={`${td} font-mono`}>{v.voucherNo}</td>
                      <td className={td}>{v.voucherDate}</td>
                      <td className={td}>{v.summary ?? '-'}</td>
                      <td className={td}>{v.totalDebit}</td>
                      <td className={td}>{v.totalCredit}</td>
                      <td className={td}>
                        <StatusBadge status={v.status} />
                      </td>
                      <td className={`${td} space-x-2`}>
                        {v.status === 'draft' && (
                          <>
                            <button
                              className="text-[11px] underline"
                              onClick={() => act.mutate({ id: v.id, kind: 'submit' })}
                            >
                              {t('submitReview')}
                            </button>
                            <button
                              className="text-[11px] underline"
                              onClick={() => act.mutate({ id: v.id, kind: 'post' })}
                            >
                              {t('post')}
                            </button>
                          </>
                        )}
                        {v.status === 'posted' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('posted')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

interface BalanceSheet {
  period: string
  assets: Array<{ label: string; amount: string }>
  liabilities: Array<{ label: string; amount: string }>
  equity: Array<{ label: string; amount: string }>
  totalAssets: string
  totalLiabilities: string
  totalEquity: string
  equationDelta: string
  balanced: boolean
}

interface IncomeStatement {
  period: string
  current: {
    revenue: { label: string; amount: string }
    netProfit: string
    totalProfit: string
    operatingProfit: string
  }
  ytd: { netProfit: string }
}

/** 报表与结账:试算平衡 + 资产负债表 + 利润表 + 期末结账 */
export function ReportsTab({ ledgers }: { ledgers: FinLedger[] }) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [ledgerId, setLedgerId] = React.useState('')
  const ledger = ledgers.find((l) => l.id === ledgerId)
  const [period, setPeriod] = React.useState('')
  const effectivePeriod = period || ledger?.currentPeriod || ''

  const tbQ = useQuery({
    queryKey: ['fin', 'tb', ledgerId, effectivePeriod],
    queryFn: () =>
      api<{
        period: string
        rows: unknown[]
        totalDebit: string
        totalCredit: string
        balanced: boolean
      }>(`${FIN_RESOURCE}/ledgers/${ledgerId}/trial-balance?period=${effectivePeriod}`),
    enabled: !!ledgerId && !!effectivePeriod,
  })
  const bsQ = useQuery({
    queryKey: ['fin', 'bs', ledgerId, effectivePeriod],
    queryFn: () =>
      api<BalanceSheet>(
        `${FIN_RESOURCE}/ledgers/${ledgerId}/balance-sheet?period=${effectivePeriod}`,
      ),
    enabled: !!ledgerId && !!effectivePeriod,
  })
  const isQ = useQuery({
    queryKey: ['fin', 'is', ledgerId, effectivePeriod],
    queryFn: () =>
      api<IncomeStatement>(
        `${FIN_RESOURCE}/ledgers/${ledgerId}/income-statement?period=${effectivePeriod}`,
      ),
    enabled: !!ledgerId && !!effectivePeriod,
  })

  const closeMut = useMutation({
    mutationFn: (kind: 'close' | 'reopen') =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/${kind}`, {
        method: 'POST',
        body: JSON.stringify({ period: effectivePeriod }),
      }),
    onSuccess: () => {
      toast.success(t('actionDone'))
      qc.invalidateQueries({ queryKey: ['fin'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

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
          value={effectivePeriod}
          onChange={(e) => setPeriod(e.target.value)}
          disabled={!ledgerId}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!ledgerId || !effectivePeriod}
          onClick={() => closeMut.mutate('close')}
        >
          {t('closePeriod')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!ledgerId || !effectivePeriod}
          onClick={() => closeMut.mutate('reopen')}
        >
          {t('reopenPeriod')}
        </Button>
      </div>

      {!ledgerId ? (
        <Empty text={t('needLedger')} />
      ) : (
        <>
          <Card title={t('trialBalanceTitle')}>
            {tbQ.data ? (
              <div className="font-[weight:inherit] flex flex-wrap gap-4 text-label">
                <span>
                  {t('debit')}: <b>{tbQ.data.totalDebit}</b>
                </span>
                <span>
                  {t('credit')}: <b>{tbQ.data.totalCredit}</b>
                </span>
                <span className={tbQ.data.balanced ? 'text-success' : 'text-destructive'}>
                  {tbQ.data.balanced ? t('balanced') : t('unbalanced')}
                </span>
                <span className="text-muted-foreground">
                  {t('rowCount')} {tbQ.data.rows?.length ?? 0}
                </span>
              </div>
            ) : (
              <Empty text={t('loading')} />
            )}
          </Card>

          <Card title={t('balanceSheetTitle')}>
            {bsQ.data ? (
              <div className="font-[weight:inherit] space-y-2 text-label">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground">{t('assets')}</p>
                    {(bsQ.data.assets ?? []).map((r) => (
                      <div key={r.label} className="flex justify-between gap-4">
                        <span>{r.label}</span>
                        <b>{r.amount}</b>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between gap-4 border-t border-stroke-subtle pt-1">
                      <span>{t('totalAssets')}</span>
                      <b>{bsQ.data.totalAssets}</b>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground">{t('liabilities')}</p>
                    {(bsQ.data.liabilities ?? []).map((r) => (
                      <div key={r.label} className="flex justify-between gap-4">
                        <span>{r.label}</span>
                        <b>{r.amount}</b>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between gap-4 border-t border-stroke-subtle pt-1">
                      <span>{t('totalLiabilities')}</span>
                      <b>{bsQ.data.totalLiabilities}</b>
                    </div>
                    <p className="mb-1 mt-3 text-[11px] text-muted-foreground">{t('equity')}</p>
                    {(bsQ.data.equity ?? []).map((r) => (
                      <div key={r.label} className="flex justify-between gap-4">
                        <span>{r.label}</span>
                        <b>{r.amount}</b>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={bsQ.data.balanced ? 'text-success' : 'text-destructive'}>
                  {bsQ.data.balanced
                    ? t('balanced')
                    : `${t('unbalanced')} Δ=${bsQ.data.equationDelta}`}
                </div>
              </div>
            ) : (
              <Empty text={t('loading')} />
            )}
          </Card>

          <Card title={t('incomeStatementTitle')}>
            {isQ.data ? (
              <div className="font-[weight:inherit] flex flex-wrap gap-4 text-label">
                <span>
                  {isQ.data.current.revenue.label}: <b>{isQ.data.current.revenue.amount}</b>
                </span>
                <span>
                  {t('operatingProfit')}: <b>{isQ.data.current.operatingProfit}</b>
                </span>
                <span>
                  {t('totalProfit')}: <b>{isQ.data.current.totalProfit}</b>
                </span>
                <span>
                  {t('netProfit')}: <b>{isQ.data.current.netProfit}</b>
                </span>
                <span className="text-muted-foreground">
                  {t('ytdNetProfit')}: {isQ.data.ytd.netProfit}
                </span>
              </div>
            ) : (
              <Empty text={t('loading')} />
            )}
          </Card>
        </>
      )}
    </div>
  )
}

/** 申报日历:按到期日排;状态推进按钮直达下一态 */
export function TaxTab({ clients }: { clients: FinClient[] }) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [clientId, setClientId] = React.useState('')
  const [status, setStatus] = React.useState('')

  const tasksQ = useQuery({
    queryKey: ['fin', 'filing', clientId, status],
    queryFn: () => {
      const p = new URLSearchParams()
      if (clientId) p.set('clientId', clientId)
      if (status) p.set('status', status)
      p.set('limit', '80')
      return api<unknown>(`${FIN_RESOURCE}/filing-tasks?${p.toString()}`)
    },
  })
  const tasks = rowsOf<FinFilingTask>(tasksQ.data)

  const advanceMut = useMutation({
    mutationFn: (p: { id: string; status: string }) =>
      api(`${FIN_RESOURCE}/filing-tasks/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: p.status }),
      }),
    onSuccess: () => {
      toast.success(t('actionDone'))
      qc.invalidateQueries({ queryKey: ['fin', 'filing'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const nextStatus: Record<string, string> = {
    pending: 'computed',
    computed: 'drafted',
    drafted: 'submitted',
    submitted: 'accepted',
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={field} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">{t('allClients')}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('allStatus')}</option>
          {['pending', 'computed', 'drafted', 'submitted', 'accepted', 'failed'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => tasksQ.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          {t('refresh')}
        </Button>
      </div>

      <Card title={t('taxTitle')}>
        {tasks.length === 0 ? (
          <Empty text={t('noFiling')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('taxType')}</th>
                <th className={th}>{t('tPeriod')}</th>
                <th className={th}>{t('dueDate')}</th>
                <th className={th}>{t('tAmount')}</th>
                <th className={th}>{t('status')}</th>
                <th className={th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-stroke-subtle">
                  <td className={td}>{task.taxType}</td>
                  <td className={td}>{task.period}</td>
                  <td className={td}>{task.dueDate}</td>
                  <td className={td}>{task.taxAmount ?? '-'}</td>
                  <td className={td}>
                    <StatusBadge status={task.status} />
                  </td>
                  <td className={td}>
                    {nextStatus[task.status] && (
                      <button
                        className="text-[11px] underline"
                        onClick={() =>
                          advanceMut.mutate({ id: task.id, status: nextStatus[task.status]! })
                        }
                      >
                        → {nextStatus[task.status]}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
