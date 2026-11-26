// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, RefreshCw, Wand2, Save, Trash2, FileUp, Link2 } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { api, rowsOf, FIN_RESOURCE, type FinLedger } from './types'
import { Card, Empty, StatusBadge, field, th, td } from './tabs'
import { ReconCard } from './recon-card'

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

  // ---------- 票据补全(2026-11-23):导入 / 后端口径汇总 / 关联凭证 / 删除 ----------
  const [invImportText, setInvImportText] = React.useState('')
  const [linkTarget, setLinkTarget] = React.useState<{
    kind: 'invoice' | 'statement'
    id: string
  } | null>(null)
  const [linkVoucherId, setLinkVoucherId] = React.useState('')

  interface InvoiceSummary {
    outputCount: number
    outputAmount: string
    outputTax: string
    inputCount: number
    inputAmount: string
    inputTax: string
    deductibleCount: number
  }
  const invSummaryQ = useQuery({
    queryKey: ['fin', 'invoice-summary', ledgerId, period],
    queryFn: () =>
      api<InvoiceSummary>(`${FIN_RESOURCE}/ledgers/${ledgerId}/invoices/summary?period=${period}`),
    enabled: !!ledgerId && !!period,
  })

  const vouchersQ = useQuery({
    queryKey: ['fin', 'vouchers-link', ledgerId, period],
    queryFn: () =>
      api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/vouchers?period=${period}&limit=100`),
    enabled: !!ledgerId && !!period,
  })
  const linkVouchers = rowsOf<{ id: string; voucherNo: string; summary: string | null }>(
    vouchersQ.data,
  )

  const importInvoices = useMutation({
    mutationFn: () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(invImportText)
      } catch {
        throw new Error(t('jsonBad'))
      }
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error(t('jsonBad'))
      return api(`${FIN_RESOURCE}/ledgers/${ledgerId}/invoices/import`, {
        method: 'POST',
        body: JSON.stringify({
          invoices: parsed.map((v) => ({ period, ...(v as Record<string, unknown>) })),
        }),
      })
    },
    onSuccess: () => {
      toast.success(t('imported'))
      setInvImportText('')
      qc.invalidateQueries({ queryKey: ['fin', 'invoices', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const linkInvoiceMut = useMutation({
    mutationFn: (p: { id: string; voucherId: string }) =>
      api(`${FIN_RESOURCE}/invoices/${p.id}/link-voucher`, {
        method: 'POST',
        body: JSON.stringify({ voucherId: p.voucherId }),
      }),
    onSuccess: () => {
      toast.success(t('linked'))
      setLinkTarget(null)
      setLinkVoucherId('')
      qc.invalidateQueries({ queryKey: ['fin', 'invoices', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteInvoiceMut = useMutation({
    mutationFn: (id: string) => api(`${FIN_RESOURCE}/invoices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('removed'))
      qc.invalidateQueries({ queryKey: ['fin', 'invoices', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const matchStatementMut = useMutation({
    mutationFn: (p: { id: string; voucherId: string }) =>
      api(`${FIN_RESOURCE}/statements/${p.id}/match`, {
        method: 'POST',
        body: JSON.stringify({ voucherId: p.voucherId }),
      }),
    onSuccess: () => {
      toast.success(t('matchedDone'))
      setLinkTarget(null)
      setLinkVoucherId('')
      qc.invalidateQueries({ queryKey: ['fin', 'statements', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const unmatchStatementMut = useMutation({
    mutationFn: (id: string) =>
      api(`${FIN_RESOURCE}/statements/${id}/unmatch`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('unmatchedDone'))
      qc.invalidateQueries({ queryKey: ['fin', 'statements', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const ignoreStatementMut = useMutation({
    mutationFn: (id: string) =>
      api(`${FIN_RESOURCE}/statements/${id}/ignore`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      toast.success(t('ignoredDone'))
      qc.invalidateQueries({ queryKey: ['fin', 'statements', ledgerId, period] })
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
                {t('invOutput')}{' '}
                {money2(invSummaryQ.data ? Number(invSummaryQ.data.outputAmount) : invStats.output)}{' '}
                · {t('invInput')}{' '}
                {money2(invSummaryQ.data ? Number(invSummaryQ.data.inputAmount) : invStats.input)} ·{' '}
                {t('invCertify')} {money2(invStats.deductible)}
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
                          {r.status !== 'voided' && (
                            <button
                              className="inline-flex items-center gap-0.5 text-[11px] underline"
                              onClick={() => {
                                setLinkTarget({ kind: 'invoice', id: r.id })
                                setLinkVoucherId('')
                              }}
                            >
                              <Link2 className="h-3 w-3" />
                              {t('linkVoucher')}
                            </button>
                          )}
                          <button
                            className="inline-flex items-center gap-0.5 text-[11px] text-destructive underline"
                            onClick={() => deleteInvoiceMut.mutate(r.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                            {t('remove')}
                          </button>
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
            <div className="mt-2 space-y-1">
              <textarea
                className={`${field} h-16 w-full`}
                placeholder={t('invImportHint')}
                value={invImportText}
                onChange={(e) => setInvImportText(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!invImportText.trim() || importInvoices.isPending}
                onClick={() => importInvoices.mutate()}
              >
                <FileUp className="h-3.5 w-3.5" />
                {t('importInvoices')}
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
                      <th className={th}>{t('actions')}</th>
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
                        <td className={`${td} space-x-2 whitespace-nowrap`}>
                          {s.matchStatus === 'matched' ? (
                            <button
                              className="text-[11px] underline"
                              onClick={() => unmatchStatementMut.mutate(s.id)}
                            >
                              {t('unmatch')}
                            </button>
                          ) : s.matchStatus === 'ignored' ? null : (
                            <>
                              <button
                                className="inline-flex items-center gap-0.5 text-[11px] underline"
                                onClick={() => {
                                  setLinkTarget({ kind: 'statement', id: s.id })
                                  setLinkVoucherId('')
                                }}
                              >
                                <Link2 className="h-3 w-3" />
                                {t('match')}
                              </button>
                              <button
                                className="text-[11px] underline"
                                onClick={() => ignoreStatementMut.mutate(s.id)}
                              >
                                {t('ignore')}
                              </button>
                            </>
                          )}
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

          <ReconCard ledgerId={ledgerId} period={period} />

          {linkTarget && (
            <Card title={t('linkPanelTitle')}>
              <div className="font-[weight:inherit] flex flex-wrap items-center gap-2 text-label">
                <span className="text-muted-foreground">
                  {linkTarget.kind === 'invoice' ? t('linkInvoiceHint') : t('matchStatementHint')}
                </span>
                <select
                  className={field}
                  value={linkVoucherId}
                  onChange={(e) => setLinkVoucherId(e.target.value)}
                >
                  <option value="">{t('selectVoucher')}</option>
                  {linkVouchers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.voucherNo}
                      {v.summary ? ` · ${v.summary}` : ''}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!linkVoucherId}
                  onClick={() => {
                    if (!linkTarget) return
                    if (linkTarget.kind === 'invoice')
                      linkInvoiceMut.mutate({ id: linkTarget.id, voucherId: linkVoucherId })
                    else matchStatementMut.mutate({ id: linkTarget.id, voucherId: linkVoucherId })
                  }}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {t('linkConfirm')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLinkTarget(null)
                    setLinkVoucherId('')
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
