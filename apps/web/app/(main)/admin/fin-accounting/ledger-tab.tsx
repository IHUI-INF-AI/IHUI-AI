// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, RefreshCw, Save } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { api, rowsOf, FIN_RESOURCE, type FinLedger } from './types'
import { Card, Empty, field, th, td } from './tabs'

/** 科目类别 → 文案键(const 字面量映射;守门 213/235 禁止渲染侧内联拼接 t(`cat_${x}`)) */
const CAT_KEY = {
  asset: 'cat_asset',
  liability: 'cat_liability',
  equity: 'cat_equity',
  revenue: 'cat_revenue',
  expense: 'cat_expense',
  cost: 'cat_cost',
} as const
const CAT_LIST = ['asset', 'liability', 'equity', 'revenue', 'expense', 'cost'] as const
const catKey = (c: string) => CAT_KEY[c as keyof typeof CAT_KEY] ?? CAT_KEY.expense

interface FinAccount {
  code: string
  name: string
  category: string
  direction: string
  enabled: boolean
  level?: number
}

interface OpeningRow {
  accountCode: string
  debit?: string | number
  credit?: string | number
}

interface OpeningSummary {
  period?: string
  debitTotal?: string
  creditTotal?: string
  assets?: string
  liabilities?: string
  equity?: string
  pnl?: string
  equationDelta?: string
}

interface QuickLine {
  code: string
  amount: string
}

/** 账套基础数据(2026-11-23 补):科目表 / 期初余额 / 快速凭证录入。 */
export function LedgerTab({ ledgers }: { ledgers: FinLedger[] }) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [ledgerId, setLedgerId] = React.useState('')
  const ledger = ledgers.find((l) => l.id === ledgerId)
  const period = ledger?.currentPeriod ?? ''

  // ---------- 科目 ----------
  const [newCode, setNewCode] = React.useState('')
  const [newName, setNewName] = React.useState('')
  const [newCategory, setNewCategory] = React.useState('asset')
  const [newDirection, setNewDirection] = React.useState('debit')

  const accountsQ = useQuery({
    queryKey: ['fin', 'accounts', ledgerId],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/accounts`),
    enabled: !!ledgerId,
  })
  const accounts = rowsOf<FinAccount>(accountsQ.data)

  const addAccount = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/accounts`, {
        method: 'POST',
        body: JSON.stringify({
          code: newCode.trim(),
          name: newName.trim(),
          category: newCategory,
          direction: newDirection,
        }),
      }),
    onSuccess: () => {
      toast.success(t('actionDone'))
      setNewCode('')
      setNewName('')
      qc.invalidateQueries({ queryKey: ['fin', 'accounts', ledgerId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ---------- 期初余额 ----------
  const openingQ = useQuery({
    queryKey: ['fin', 'opening', ledgerId, period],
    queryFn: () =>
      api<OpeningSummary>(`${FIN_RESOURCE}/ledgers/${ledgerId}/opening/summary?period=${period}`),
    enabled: !!ledgerId && !!period,
  })
  const [openRows, setOpenRows] = React.useState<OpeningRow[]>([{ accountCode: '', debit: '' }])

  const saveOpening = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/opening`, {
        method: 'PUT',
        body: JSON.stringify({
          period,
          rows: openRows
            .filter((r) => r.accountCode.trim())
            .map((r) => ({
              accountCode: r.accountCode.trim(),
              debit: r.debit === '' ? undefined : r.debit,
              credit: r.credit === '' ? undefined : r.credit,
            })),
        }),
      }),
    onSuccess: () => {
      toast.success(t('openingSaved'))
      qc.invalidateQueries({ queryKey: ['fin', 'opening', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ---------- 快速凭证 ----------
  const today = new Date().toISOString().slice(0, 10)
  const [vDate, setVDate] = React.useState(today)
  const [vSummary, setVSummary] = React.useState('')
  const [debitLine, setDebitLine] = React.useState<QuickLine>({ code: '', amount: '' })
  const [creditLine, setCreditLine] = React.useState<QuickLine>({ code: '', amount: '' })
  const [postNow, setPostNow] = React.useState(false)

  const createVoucher = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/vouchers`, {
        method: 'POST',
        body: JSON.stringify({
          period,
          voucherDate: vDate,
          summary: vSummary.trim() || undefined,
          post: postNow,
          lines: [
            {
              accountCode: debitLine.code.trim(),
              direction: 'debit',
              amount: debitLine.amount,
            },
            {
              accountCode: creditLine.code.trim(),
              direction: 'credit',
              amount: creditLine.amount,
            },
          ],
        }),
      }),
    onSuccess: () => {
      toast.success(t('voucherCreated'))
      setVSummary('')
      setDebitLine({ code: '', amount: '' })
      setCreditLine({ code: '', amount: '' })
      qc.invalidateQueries({ queryKey: ['fin', 'vouchers'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canPost =
    !!ledgerId &&
    !!vDate &&
    !!debitLine.code.trim() &&
    !!creditLine.code.trim() &&
    Number(debitLine.amount) > 0 &&
    Number(creditLine.amount) > 0

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
            accountsQ.refetch()
            openingQ.refetch()
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
            title={t('accountsTitle')}
            actions={<span className="text-[11px] text-muted-foreground">{accounts.length}</span>}
          >
            {accounts.length === 0 ? (
              <Empty text={t('noAccounts')} />
            ) : (
              <div className="max-h-64 overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={th}>{t('accountCode')}</th>
                      <th className={th}>{t('accountName')}</th>
                      <th className={th}>{t('category')}</th>
                      <th className={th}>{t('direction')}</th>
                      <th className={th}>{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.code} className="border-t border-stroke-subtle">
                        <td className={`${td} font-mono`}>{a.code}</td>
                        <td className={td}>{a.name}</td>
                        <td className={td}>{t(catKey(a.category))}</td>
                        <td className={td}>{a.direction === 'debit' ? t('debit') : t('credit')}</td>
                        <td className={td}>
                          {a.enabled ? (
                            <span className="text-success">{t('enabled')}</span>
                          ) : (
                            <span className="text-muted-foreground">{t('disabled')}</span>
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
                className={`${field} w-24`}
                placeholder={t('accountCode')}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
              <input
                className={`${field} w-40`}
                placeholder={t('accountName')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <select
                className={field}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {CAT_LIST.map((c) => (
                  <option key={c} value={c}>
                    {t(CAT_KEY[c])}
                  </option>
                ))}
              </select>
              <select
                className={field}
                value={newDirection}
                onChange={(e) => setNewDirection(e.target.value)}
              >
                <option value="debit">{t('debit')}</option>
                <option value="credit">{t('credit')}</option>
              </select>
              <Button
                size="sm"
                disabled={!newCode.trim() || !newName.trim() || addAccount.isPending}
                onClick={() => addAccount.mutate()}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('addAccount')}
              </Button>
            </div>
          </Card>

          <Card title={t('openingTitle')}>
            {!openingQ.data ? (
              <Empty text={t('loading')} />
            ) : (
              <div className="mb-2 space-y-1 text-xs text-muted-foreground">
                <p>{t('openingHint')}</p>
                <p className="tabular-nums">
                  {openingQ.data.period ?? period} · {t('debit')}{' '}
                  {Number(openingQ.data.debitTotal ?? 0).toFixed(2)} · {t('credit')}{' '}
                  {Number(openingQ.data.creditTotal ?? 0).toFixed(2)} · {t('equationDelta')}{' '}
                  {Number(openingQ.data.equationDelta ?? 0).toFixed(2)}
                </p>
              </div>
            )}
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>{t('accountCode')}</th>
                  <th className={th}>{t('debit')}</th>
                  <th className={th}>{t('credit')}</th>
                </tr>
              </thead>
              <tbody>
                {openRows.map((row, idx) => (
                  <tr key={idx} className="border-t border-stroke-subtle">
                    <td className={td}>
                      <select
                        className={`${field} w-52`}
                        value={row.accountCode}
                        onChange={(e) =>
                          setOpenRows((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, accountCode: e.target.value } : r,
                            ),
                          )
                        }
                      >
                        <option value="">{t('pickAccount')}</option>
                        {accounts.map((a) => (
                          <option key={a.code} value={a.code}>{`${a.code} ${a.name}`}</option>
                        ))}
                      </select>
                    </td>
                    <td className={td}>
                      <input
                        className={`${field} w-24`}
                        value={row.debit ?? ''}
                        onChange={(e) =>
                          setOpenRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, debit: e.target.value } : r)),
                          )
                        }
                      />
                    </td>
                    <td className={td}>
                      <input
                        className={`${field} w-24`}
                        value={row.credit ?? ''}
                        onChange={(e) =>
                          setOpenRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, credit: e.target.value } : r)),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenRows((prev) => [...prev, { accountCode: '', debit: '' }])}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('addRow')}
              </Button>
              <Button
                size="sm"
                disabled={saveOpening.isPending}
                onClick={() => saveOpening.mutate()}
              >
                <Save className="h-3.5 w-3.5" />
                {t('saveOpening')}
              </Button>
            </div>
          </Card>

          <Card title={t('quickVoucher')}>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-muted-foreground">{period}</span>
              <input
                className={`${field} w-32`}
                value={vDate}
                onChange={(e) => setVDate(e.target.value)}
              />
              <input
                className={`${field} w-64`}
                placeholder={t('vSummary')}
                value={vSummary}
                onChange={(e) => setVSummary(e.target.value)}
              />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] font-medium">{t('debit')}</p>
                <div className="flex gap-1">
                  <select
                    className={`${field} w-52`}
                    value={debitLine.code}
                    onChange={(e) => setDebitLine({ ...debitLine, code: e.target.value })}
                  >
                    <option value="">{t('pickAccount')}</option>
                    {accounts.map((a) => (
                      <option key={a.code} value={a.code}>{`${a.code} ${a.name}`}</option>
                    ))}
                  </select>
                  <input
                    className={`${field} w-28`}
                    placeholder="0.00"
                    value={debitLine.amount}
                    onChange={(e) => setDebitLine({ ...debitLine, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-medium">{t('credit')}</p>
                <div className="flex gap-1">
                  <select
                    className={`${field} w-52`}
                    value={creditLine.code}
                    onChange={(e) => setCreditLine({ ...creditLine, code: e.target.value })}
                  >
                    <option value="">{t('pickAccount')}</option>
                    {accounts.map((a) => (
                      <option key={a.code} value={a.code}>{`${a.code} ${a.name}`}</option>
                    ))}
                  </select>
                  <input
                    className={`${field} w-28`}
                    placeholder="0.00"
                    value={creditLine.amount}
                    onChange={(e) => setCreditLine({ ...creditLine, amount: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={postNow}
                  onChange={(e) => setPostNow(e.target.checked)}
                />
                {t('postNow')}
              </label>
              <Button
                size="sm"
                disabled={!canPost || createVoucher.isPending}
                onClick={() => createVoucher.mutate()}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('createVoucher')}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
