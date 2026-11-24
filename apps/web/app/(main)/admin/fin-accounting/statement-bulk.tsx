// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 流水批量关联(2026-11-23 补):POST /statements/attach 此前无入口 ——
 * 一笔汇总转账对应多笔业务时,只能一条条 match。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link2 } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { rowsOf } from '@/lib/api-rows'
import { api, FIN_RESOURCE, type FinLedger } from './types'
import { Card, Empty, StatusBadge, field, th, td } from './tabs'

const curMonth = () => new Date().toISOString().slice(0, 7)

interface StatementRow {
  id: string
  txnDate: string
  direction: 'in' | 'out'
  amount: string
  counterparty: string | null
  summary: string | null
  matchStatus: string
}

interface VoucherRow {
  id: string
  voucherNo: string
  summary: string | null
}

export function StatementBulkCard({ ledgers }: { ledgers: FinLedger[] }) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [ledgerId, setLedgerId] = React.useState('')
  const [period, setPeriod] = React.useState(curMonth())
  const [selected, setSelected] = React.useState<string[]>([])
  const [voucherId, setVoucherId] = React.useState('')

  const stQ = useQuery({
    queryKey: ['fin', 'statements-bulk', ledgerId, period],
    enabled: Boolean(ledgerId && period),
    queryFn: () =>
      api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/statements?period=${period}&limit=100`),
  })
  const vouchersQ = useQuery({
    queryKey: ['fin', 'vouchers-bulk', ledgerId, period],
    enabled: Boolean(ledgerId && period),
    queryFn: () =>
      api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/vouchers?period=${period}&limit=100`),
  })
  const statements = rowsOf<StatementRow>(stQ.data).filter(
    (s) => s.matchStatus !== 'matched' && s.matchStatus !== 'ignored',
  )
  const vouchers = rowsOf<VoucherRow>(vouchersQ.data)

  const attach = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/statements/attach`, {
        method: 'POST',
        body: JSON.stringify({ statementIds: selected, voucherId }),
      }),
    onSuccess: () => {
      toast.success(t('bulkAttachDone'))
      setSelected([])
      setVoucherId('')
      qc.invalidateQueries({ queryKey: ['fin', 'statements-bulk', ledgerId, period] })
      qc.invalidateQueries({ queryKey: ['fin', 'reconcile', ledgerId, period] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <Card title={t('bulkAttachTitle')}>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <select className={field} value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
          <option value="">{t('selectLedger')}</option>
          {ledgers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <input
          className={`${field} w-32`}
          placeholder={t('period')}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        />
        <span className="text-[11px] text-muted-foreground">
          {t('bulkSelected')} {selected.length}
        </span>
      </div>

      {!ledgerId ? (
        <Empty text={t('bulkPickHint')} />
      ) : statements.length === 0 ? (
        <Empty text={t('noUnmatchedStatements')} />
      ) : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th} />
                <th className={th}>{t('txnDate')}</th>
                <th className={th}>{t('direction')}</th>
                <th className={th}>{t('amount')}</th>
                <th className={th}>{t('counterparty')}</th>
                <th className={th}>{t('matchStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s.id} className="border-t border-stroke-subtle">
                  <td className={td}>
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                  </td>
                  <td className={`${td} tabular-nums`}>{s.txnDate}</td>
                  <td className={td}>{s.direction === 'in' ? t('moneyIn') : t('moneyOut')}</td>
                  <td className={`${td} tabular-nums`}>
                    {Number(s.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={td}>{s.counterparty ?? '-'}</td>
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
        <select className={field} value={voucherId} onChange={(e) => setVoucherId(e.target.value)}>
          <option value="">{t('selectVoucher')}</option>
          {vouchers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.voucherNo}
              {v.summary ? ` · ${v.summary}` : ''}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={selected.length === 0 || !voucherId || attach.isPending}
          onClick={() => attach.mutate()}
        >
          <Link2 className="h-3.5 w-3.5" />
          {t('attachToVoucher')}
        </Button>
      </div>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
