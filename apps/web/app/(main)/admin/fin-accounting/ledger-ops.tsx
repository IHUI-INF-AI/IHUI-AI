// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 账套与科目维护(2026-11-23 补):PATCH /ledgers/:id 与 PATCH /ledgers/:id/accounts/:code
 * 两个"改动后才会用到"的端点此前没有界面 —— 账套只能建、科目只能加。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { rowsOf } from '@/lib/api-rows'
import { api, FIN_RESOURCE, type FinLedger } from './types'
import { Card, Empty, field, th, td } from './tabs'

interface AccountRow {
  code: string
  name: string
  category: string
  direction: string
  enabled: boolean
}

const STANDARDS = ['small_business', 'general'] as const
const LEDGER_STATUSES = ['active', 'paused', 'closed'] as const

export function LedgerOpsCard({ ledgers }: { ledgers: FinLedger[] }) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [ledgerId, setLedgerId] = React.useState('')
  const [name, setName] = React.useState('')
  const [standard, setStandard] = React.useState<string>('small_business')
  const [status, setStatus] = React.useState<string>('active')
  const [reviewRequired, setReviewRequired] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [accName, setAccName] = React.useState('')

  const base = React.useMemo(
    () => ledgers.find((l) => l.id === ledgerId) ?? null,
    [ledgers, ledgerId],
  )

  React.useEffect(() => {
    const b = ledgers.find((l) => l.id === ledgerId)
    if (!b) return
    setName(b.name)
    setStandard(b.accountingStandard || 'small_business')
    setStatus(b.status || 'active')
    setReviewRequired(Boolean(b.reviewRequired))
  }, [ledgerId, ledgers])

  const accQ = useQuery({
    queryKey: ['fin', 'accounts-ops', ledgerId],
    enabled: Boolean(ledgerId),
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/accounts?enabled=true`),
  })
  const accounts = rowsOf<AccountRow>(accQ.data)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['fin'] })

  const saveLedger = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          accountingStandard: standard,
          status,
          reviewRequired,
        }),
      }),
    onSuccess: () => {
      toast.success(t('saveDone'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveAccount = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/ledgers/${ledgerId}/accounts/${code}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: accName.trim() }),
      }),
    onSuccess: () => {
      toast.success(t('saveDone'))
      setAccName('')
      qc.invalidateQueries({ queryKey: ['fin', 'accounts-ops', ledgerId] })
      qc.invalidateQueries({ queryKey: ['fin', 'accounts', ledgerId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card title={t('ledgerOpsTitle')}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <select className={field} value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
          <option value="">{t('selectLedger')}</option>
          {ledgers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {base && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {t('currentPeriodLabel')} {base.currentPeriod} · {t('startPeriodLabel')}{' '}
            {base.startPeriod}
          </span>
        )}
      </div>

      {!ledgerId ? (
        <Empty text={t('ledgerOpsPickHint')} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${field} w-48`}
              placeholder={t('ledgerName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className={field}
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
            >
              {STANDARDS.map((s) => (
                <option key={s} value={s}>
                  {s === 'general' ? t('standardGeneral') : t('standardSmallBusiness')}
                </option>
              ))}
            </select>
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
              {LEDGER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label className="font-[weight:inherit] flex items-center gap-1 text-label">
              <input
                type="checkbox"
                checked={reviewRequired}
                onChange={(e) => setReviewRequired(e.target.checked)}
              />
              {t('reviewRequired')}
            </label>
            <Button
              size="sm"
              disabled={!name.trim() || saveLedger.isPending}
              onClick={() => saveLedger.mutate()}
            >
              <Save className="h-3.5 w-3.5" />
              {t('save')}
            </Button>
          </div>

          {accounts.length === 0 ? (
            <Empty text={t('noAccounts')} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1">
                <select className={field} value={code} onChange={(e) => setCode(e.target.value)}>
                  <option value="">{t('selectAccount')}</option>
                  {accounts.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} {a.name}
                    </option>
                  ))}
                </select>
                <input
                  className={`${field} w-56`}
                  placeholder={t('accountNewName')}
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!code || !accName.trim() || saveAccount.isPending}
                  onClick={() => saveAccount.mutate()}
                >
                  {t('saveAccount')}
                </Button>
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={th}>{t('accountCode')}</th>
                      <th className={th}>{t('accountName')}</th>
                      <th className={th}>{t('category')}</th>
                      <th className={th}>{t('direction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.code} className="border-t border-stroke-subtle">
                        <td className={`${td} font-mono`}>{a.code}</td>
                        <td className={td}>{a.name}</td>
                        <td className={td}>{a.category}</td>
                        <td className={td}>{a.direction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
