// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, RefreshCw, Wand2, Save } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { api, rowsOf, FIN_RESOURCE, type FinLedger } from './types'
import { Card, Empty, StatusBadge, field, th, td } from './tabs'

interface FinInvoice {
  id: string
  invoiceNo: string
  invoiceDate: string
  direction: string
  amountExclTax: string
  taxAmount: string
  totalAmount: string
  status: string
  checkPeriod: string | null
}

interface FinStatement {
  id: string
  txnDate: string
  direction: string
  amount: string
  summary: string | null
  counterparty: string | null
  matchStatus: string
}

interface FinBankAccount {
  id: string
  bankName: string
  accountNo: string
  accountName: string | null
  isDefault: boolean
}

const money2 = (v: number) =>
  v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 票据与对账(2026-11-23 补):发票台账 / 银行账户与流水 / 自动匹配。 */
export function DocsTab({ ledgers }: { ledgers: FinLedger[] }) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [ledgerId, setLedgerId] = React.useState('')
  const ledger = ledgers.find((l) => l.id === ledgerId)
  const period = ledger?.currentPeriod ?? ''

  // ---------- 发票 ----------
  const [invDirection, setInvDirection] = React.useState<'output' | 'input'>('output')
  const [invNo, setInvNo] = React.useState('')
  const [invDate, setInvDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [invAmount, setInvAmount] = React.useState('')
  const [invRate, setInvRate] = React.useState('0.13')

  const invoicesQ = useQuery({
    queryKey: ['fin', 'invoices', ledgerId, period],
    queryFn: () =>
      api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/invoices?period=${period}&limit=100`),
    enabled: !!ledgerId && !!period,
  })
  const invoices = rowsOf<FinInvoice>(invoicesQ.data)

  const invStats = React.useMemo(() => {
    let output = 0
    let input = 0
    let deductible = 0
    for (const r of invoices) {
      const total = Number(r.totalAmount ?? 0)
      if (r.direction === 'output') output += total
      else {
        input += total
        if (r.status === 'certified') deductible += Number(r.taxAmount ?? 0)
      }
    }
    return { output, input, deductible }
  }, [invoices])

  const addInvoice = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          direction: invDirection,
          invoiceNo: invNo.trim(),
          invoiceDate: invDate,
          period,
          amountExclTax: invAmount,
          taxRate: invRate,
        }),
      }),
    onSuccess: () => {
      toast.success(t('invoiceAdded'))
      setInvNo('')
      setInvAmount('')
      qc.invalidateQueries({ queryKey: ['fin', 'invoices', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const setInvoiceStatus = useMutation({
    mutationFn: (p: { id: string; status: string }) =>
      api(`${FIN_RESOURCE}/invoices/${p.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: p.status, checkPeriod: period }),
      }),
    onSuccess: () => {
      toast.success(t('actionDone'))
      qc.invalidateQueries({ queryKey: ['fin', 'invoices', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ---------- 银行账户 ----------
  const [bankName, setBankName] = React.useState('')
  const [bankNo, setBankNo] = React.useState('')

  const accountsQ = useQuery({
    queryKey: ['fin', 'bank-accounts', ledgerId],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/bank-accounts`),
    enabled: !!ledgerId,
  })
  const bankAccounts = rowsOf<FinBankAccount>(accountsQ.data)
  const [accountId, setAccountId] = React.useState('')

  const addBankAccount = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/bank-accounts`, {
        method: 'POST',
        body: JSON.stringify({ bankName: bankName.trim(), accountNo: bankNo.trim() }),
      }),
    onSuccess: () => {
      toast.success(t('actionDone'))
      setBankName('')
      setBankNo('')
      qc.invalidateQueries({ queryKey: ['fin', 'bank-accounts', ledgerId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ---------- 银行流水 ----------
  const [stDate, setStDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [stDirection, setStDirection] = React.useState<'in' | 'out'>('in')
  const [stAmount, setStAmount] = React.useState('')
  const [stSummary, setStSummary] = React.useState('')

  const statementsQ = useQuery({
    queryKey: ['fin', 'statements', ledgerId, period],
    queryFn: () =>
      api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/statements?period=${period}&limit=100`),
    enabled: !!ledgerId && !!period,
  })
  const statements = rowsOf<FinStatement>(statementsQ.data)

  const stStats = React.useMemo(() => {
    let matched = 0
    let unmatched = 0
    let ignored = 0
    for (const s of statements) {
      if (s.matchStatus === 'matched') matched += 1
      else if (s.matchStatus === 'ignored') ignored += 1
      else unmatched += 1
    }
    return { matched, unmatched, ignored }
  }, [statements])

  const importStatement = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/bank-accounts/${accountId}/statements/import`, {
        method: 'POST',
        body: JSON.stringify({
          statements: [
            {
              txnDate: stDate,
              direction: stDirection,
              amount: stAmount,
              summary: stSummary.trim() || undefined,
            },
          ],
        }),
      }),
    onSuccess: () => {
      toast.success(t('statementImported'))
      setStAmount('')
      setStSummary('')
      qc.invalidateQueries({ queryKey: ['fin', 'statements', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const autoMatch = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/statements/auto-match`, {
        method: 'POST',
        body: JSON.stringify({ period }),
      }),
    onSuccess: () => {
      toast.success(t('autoMatchDone'))
      qc.invalidateQueries({ queryKey: ['fin', 'statements', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  interface ReconSummary {
    period: string
    statementCount: number
    inTotal: string
    outTotal: string
    netTotal: string
    matchedCount: number
    unmatchedCount: number
    ignoredCount: number
    unmatchedNet: string
    bookBankBalance: string
    matchedNet: string
    gap: string
  }
  const reconQ = useQuery({
    queryKey: ['fin', 'reconcile', ledgerId, period],
    queryFn: () =>
      api<ReconSummary>(`${FIN_RESOURCE}/ledgers/${ledgerId}/reconcile?period=${period}`),
    enabled: !!ledgerId && !!period,
  })
  const recon = reconQ.data
  const zeroGap = recon ? Number(recon.gap) === 0 : false

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
          onClick={() => {
            invoicesQ.refetch()
            statementsQ.refetch()
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('refresh')}
        </Button>
      </div>

      {!ledgerId ? (
        <Empty text={t('needLedger')} />
      ) : (
        <>
          <Card
            title={t('invoicesTitle')}
            actions={
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {t('invOutput')} {money2(invStats.output)} · {t('invInput')}{' '}
                {money2(invStats.input)} · {t('invCertify')} {money2(invStats.deductible)}
              </span>
            }
          >
            {invoices.length === 0 ? (
              <Empty text={t('noInvoices')} />
            ) : (
              <div className="max-h-72 overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={th}>{t('invoiceNo')}</th>
                      <th className={th}>{t('vDate')}</th>
                      <th className={th}>{t('direction')}</th>
                      <th className={th}>{t('amountExclTax')}</th>
                      <th className={th}>{t('taxAmount')}</th>
                      <th className={th}>{t('totalAmount')}</th>
                      <th className={th}>{t('status')}</th>
                      <th className={th}>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((r) => (
                      <tr key={r.id} className="border-t border-stroke-subtle">
                        <td className={`${td} font-mono`}>{r.invoiceNo}</td>
                        <td className={td}>{r.invoiceDate}</td>
                        <td className={td}>
                          {r.direction === 'output' ? t('invOutput') : t('invInput')}
                        </td>
                        <td className={`${td} tabular-nums`}>{money2(Number(r.amountExclTax))}</td>
                        <td className={`${td} tabular-nums`}>{money2(Number(r.taxAmount))}</td>
                        <td className={`${td} tabular-nums`}>{money2(Number(r.totalAmount))}</td>
                        <td className={td}>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className={`${td} space-x-2`}>
                          {r.status === 'unchecked' && (
                            <button
                              className="text-[11px] underline"
                              onClick={() =>
                                setInvoiceStatus.mutate({ id: r.id, status: 'checked' })
                              }
                            >
                              {t('invCheck')}
                            </button>
                          )}
                          {r.status === 'checked' && r.direction === 'input' && (
                            <button
                              className="text-[11px] underline"
                              onClick={() =>
                                setInvoiceStatus.mutate({ id: r.id, status: 'certified' })
                              }
                            >
                              {t('invCertify')}
                            </button>
                          )}
                          {r.status !== 'voided' && (
                            <button
                              className="text-[11px] text-destructive underline"
                              onClick={() =>
                                setInvoiceStatus.mutate({ id: r.id, status: 'voided' })
                              }
                            >
                              {t('invVoid')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <select
                className={field}
                value={invDirection}
                onChange={(e) => setInvDirection(e.target.value as 'output' | 'input')}
              >
                <option value="output">{t('invOutput')}</option>
                <option value="input">{t('invInput')}</option>
              </select>
              <input
                className={`${field} w-28`}
                placeholder={t('invoiceNo')}
                value={invNo}
                onChange={(e) => setInvNo(e.target.value)}
              />
              <input
                className={`${field} w-32`}
                value={invDate}
                onChange={(e) => setInvDate(e.target.value)}
              />
              <input
                className={`${field} w-24`}
                placeholder={t('amountExclTax')}
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
              />
              <input
                className={`${field} w-16`}
                placeholder="0.13"
                value={invRate}
                onChange={(e) => setInvRate(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!invNo.trim() || !invAmount || addInvoice.isPending}
                onClick={() => addInvoice.mutate()}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('addInvoice')}
              </Button>
            </div>
          </Card>

          <Card title={t('bankTitle')}>
            {bankAccounts.length > 0 && (
              <table className="mb-2 w-full">
                <thead>
                  <tr>
                    <th className={th}>{t('bankName')}</th>
                    <th className={th}>{t('accountNo')}</th>
                    <th className={th}>{t('accountName')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts.map((a) => (
                    <tr key={a.id} className="border-t border-stroke-subtle">
                      <td className={td}>{a.bankName}</td>
                      <td className={`${td} font-mono`}>{a.accountNo}</td>
                      <td className={td}>{a.accountName ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {bankAccounts.length === 0 ? (
              <Empty text={t('noBankAccounts')} />
            ) : (
              <div className="mb-2 flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-muted-foreground">{t('pickAccount')}</span>
                <select
                  className={field}
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">-</option>
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName}({a.accountNo})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1">
              <input
                className={`${field} w-40`}
                placeholder={t('bankName')}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
              <input
                className={`${field} w-44`}
                placeholder={t('accountNo')}
                value={bankNo}
                onChange={(e) => setBankNo(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!bankName.trim() || !bankNo.trim() || addBankAccount.isPending}
                onClick={() => addBankAccount.mutate()}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('addBankAccount')}
              </Button>
            </div>
          </Card>

          <Card
            title={t('statementsTitle')}
            actions={
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {t('matched')} {stStats.matched} · {t('unmatched')} {stStats.unmatched} ·{' '}
                  {t('ignored')} {stStats.ignored}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={autoMatch.isPending || !period}
                  onClick={() => autoMatch.mutate()}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {t('autoMatch')}
                </Button>
              </div>
            }
          >
            {statements.length === 0 ? (
              <Empty text={t('noStatements')} />
            ) : (
              <div className="max-h-72 overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={th}>{t('txnDate')}</th>
                      <th className={th}>{t('direction')}</th>
                      <th className={th}>{t('amount')}</th>
                      <th className={th}>{t('counterparty')}</th>
                      <th className={th}>{t('vSummary')}</th>
                      <th className={th}>{t('matchStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.map((s) => (
                      <tr key={s.id} className="border-t border-stroke-subtle">
                        <td className={td}>{s.txnDate}</td>
                        <td className={td}>
                          {s.direction === 'in' ? t('moneyIn') : t('moneyOut')}
                        </td>
                        <td className={`${td} tabular-nums`}>{money2(Number(s.amount))}</td>
                        <td className={td}>{s.counterparty ?? '-'}</td>
                        <td className={td}>{s.summary ?? '-'}</td>
                        <td className={td}>
                          <StatusBadge status={s.matchStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <input
                className={`${field} w-32`}
                value={stDate}
                onChange={(e) => setStDate(e.target.value)}
              />
              <select
                className={field}
                value={stDirection}
                onChange={(e) => setStDirection(e.target.value as 'in' | 'out')}
              >
                <option value="in">{t('moneyIn')}</option>
                <option value="out">{t('moneyOut')}</option>
              </select>
              <input
                className={`${field} w-24`}
                placeholder="0.00"
                value={stAmount}
                onChange={(e) => setStAmount(e.target.value)}
              />
              <input
                className={`${field} w-48`}
                placeholder={t('vSummary')}
                value={stSummary}
                onChange={(e) => setStSummary(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!accountId || !stAmount || importStatement.isPending}
                onClick={() => importStatement.mutate()}
              >
                <Save className="h-3.5 w-3.5" />
                {t('importStatement')}
              </Button>
            </div>
          </Card>

          <Card title={t('reconcileTitle')}>
            {!recon ? (
              <Empty text={t('loading')} />
            ) : (
              <div className="flex flex-wrap gap-4 text-xs tabular-nums">
                <span>
                  {t('bookBankBalance')}: <b>{money2(Number(recon.bookBankBalance))}</b>
                </span>
                <span>
                  {t('matchedNet')}: <b>{money2(Number(recon.matchedNet))}</b>
                </span>
                <span className={zeroGap ? 'text-success' : 'text-warning'}>
                  {t('gap')}: <b>{money2(Number(recon.gap))}</b>
                </span>
                <span className="text-muted-foreground">
                  {t('unmatchedCount')}: {recon.unmatchedCount}
                </span>
                <span className="text-muted-foreground">
                  {t('matched')}: {recon.matchedCount} · {t('ignored')}: {recon.ignoredCount}
                </span>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
