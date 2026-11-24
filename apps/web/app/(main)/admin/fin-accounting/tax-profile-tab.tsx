// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CalendarPlus, Link2, Plus, RefreshCw, Save } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { rowsOf } from '@/lib/api-rows'
import { api, FIN_RESOURCE, type FinClient, type FinLedger } from './types'
import { Card, Empty, StatusBadge, field, th, td } from './tabs'

interface FinTaxProfile {
  id: string
  clientId: string
  taxType: string
  taxpayerType: string | null
  collectionMethod: string | null
  filingCycle: string | null
  dueMonthOffset: number | null
  dueDay: number | null
  rate: string | null
  deemedRate: string | null
  status: string
  effectiveFrom: string | null
  effectiveTo: string | null
}

/** 税种代码 → 展示名(键值同后端枚举,不翻译代码本身) */
const TAX_TYPES = [
  'VAT',
  'CIT',
  'IIT',
  'SURTAX',
  'STAMP',
  'CONSUMPTION',
  'PROPERTY',
  'LAND_USE',
  'VEHICLE_VESSEL',
  'CULTURE',
  'OTHER',
] as const
const CYCLES = ['monthly', 'quarterly', 'annual'] as const
const METHODS = ['audit', 'deemed'] as const

/** 枚举 → 文案键(const 字面量映射,禁渲染侧内联拼接) */
const CYCLE_KEY = {
  monthly: 'cycle_monthly',
  quarterly: 'cycle_quarterly',
  annual: 'cycle_annual',
} as const
const METHOD_KEY = { audit: 'method_audit', deemed: 'method_deemed' } as const
const cycleKey = (c: string) => CYCLE_KEY[c as keyof typeof CYCLE_KEY] ?? CYCLE_KEY.monthly
const methodKey = (m: string) => METHOD_KEY[m as keyof typeof METHOD_KEY] ?? METHOD_KEY.audit

const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const thisMonth = () => ymOf(new Date())
const nextMonth = () => {
  const d = new Date()
  return ymOf(new Date(d.getFullYear(), d.getMonth() + 1, 1))
}

/**
 * 税种核定(2026-11-23 补):一个税种一张核定档 → 扇出申报日历。
 * 此前税页只有"申报任务推进",没有建/停核定档的入口,新客户上线只能调 API。
 */
export function TaxProfileTab({
  clients,
  ledgers,
}: {
  clients: FinClient[]
  ledgers: FinLedger[]
}) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [clientId, setClientId] = React.useState('')
  const [fromMonth, setFromMonth] = React.useState(thisMonth())
  const [toMonth, setToMonth] = React.useState(nextMonth())
  const [ledgerToBind, setLedgerToBind] = React.useState('')
  const [editing, setEditing] = React.useState<{
    id: string
    cycle: string
    offset: string
    day: string
    rate: string
    deemedRate: string
  } | null>(null)

  const [taxType, setTaxType] = React.useState<string>('VAT')
  const [cycle, setCycle] = React.useState<string>('monthly')
  const [method, setMethod] = React.useState<string>('audit')
  const [offset, setOffset] = React.useState('1')
  const [day, setDay] = React.useState('15')
  const [rate, setRate] = React.useState('')
  const [deemedRate, setDeemedRate] = React.useState('')

  const profilesQ = useQuery({
    queryKey: ['fin', 'tax-profiles', clientId],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/clients/${clientId}/tax-profiles`),
    enabled: !!clientId,
  })
  const profiles = rowsOf<FinTaxProfile>(profilesQ.data)

  const saveProfile = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/clients/${clientId}/tax-profiles`, {
        method: 'POST',
        body: JSON.stringify({
          taxType,
          collectionMethod: method,
          filingCycle: cycle,
          dueMonthOffset: Number(offset),
          dueDay: Number(day),
          rate: rate || undefined,
          deemedRate: deemedRate || null,
        }),
      }),
    onSuccess: () => {
      toast.success(t('taxProfileSaved'))
      setRate('')
      setDeemedRate('')
      qc.invalidateQueries({ queryKey: ['fin', 'tax-profiles', clientId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) =>
      api(`${FIN_RESOURCE}/tax-profiles/${id}/deactivate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('taxProfileDeactivated'))
      qc.invalidateQueries({ queryKey: ['fin', 'tax-profiles', clientId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const genCalendar = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/clients/${clientId}/filing-calendar`, {
        method: 'POST',
        body: JSON.stringify({ fromMonth, toMonth }),
      }),
    onSuccess: () => {
      toast.success(t('calendarGenerated'))
      qc.invalidateQueries({ queryKey: ['fin', 'filing'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const patchProfile = useMutation({
    mutationFn: (p: {
      id: string
      cycle: string
      offset: string
      day: string
      rate: string
      deemedRate: string
    }) =>
      api(`${FIN_RESOURCE}/tax-profiles/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          filingCycle: p.cycle,
          dueMonthOffset: Number(p.offset),
          dueDay: Number(p.day),
          rate: p.rate || undefined,
          deemedRate: p.deemedRate || null,
        }),
      }),
    onSuccess: () => {
      toast.success(t('taxProfileSaved'))
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['fin', 'tax-profiles', clientId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const backfillAll = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/filing-calendar/backfill`, {
        method: 'POST',
        body: JSON.stringify({ fromMonth, toMonth }),
      }),
    onSuccess: () => {
      toast.success(t('calendarGenerated'))
      qc.invalidateQueries({ queryKey: ['fin', 'filing'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bindLedgerMut = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/clients/${clientId}/bind-ledger`, {
        method: 'POST',
        body: JSON.stringify({ ledgerId: ledgerToBind }),
      }),
    onSuccess: () => {
      toast.success(t('actionDone'))
      setLedgerToBind('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

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
        <Button
          size="sm"
          variant="outline"
          disabled={!clientId}
          onClick={() => profilesQ.refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('refresh')}
        </Button>
      </div>

      {!clientId ? (
        <Empty text={t('needClient')} />
      ) : (
        <>
          <Card
            title={t('taxProfilesTitle')}
            actions={<span className="text-[11px] text-muted-foreground">{profiles.length}</span>}
          >
            {profiles.length === 0 ? (
              <Empty text={t('noTaxProfiles')} />
            ) : (
              <div className="max-h-64 overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={th}>{t('taxType')}</th>
                      <th className={th}>{t('filingCycle')}</th>
                      <th className={th}>{t('dueMonthOffset')}</th>
                      <th className={th}>{t('dueDay')}</th>
                      <th className={th}>{t('collectionMethod')}</th>
                      <th className={th}>{t('rate')}</th>
                      <th className={th}>{t('status')}</th>
                      <th className={th}>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => (
                      <tr key={p.id} className="border-t border-stroke-subtle">
                        <td className={`${td} font-mono`}>{p.taxType}</td>
                        <td className={td}>{p.filingCycle ? t(cycleKey(p.filingCycle)) : '-'}</td>
                        <td className={`${td} tabular-nums`}>{p.dueMonthOffset ?? '-'}</td>
                        <td className={`${td} tabular-nums`}>{p.dueDay ?? '-'}</td>
                        <td className={td}>
                          {p.collectionMethod ? t(methodKey(p.collectionMethod)) : '-'}
                        </td>
                        <td className={`${td} tabular-nums`}>
                          {p.rate ?? '-'}
                          {p.deemedRate ? ` / ${p.deemedRate}` : ''}
                        </td>
                        <td className={td}>
                          <StatusBadge status={p.status} />
                        </td>
                        <td className={`${td} space-x-2 whitespace-nowrap`}>
                          {p.status === 'active' && (
                            <>
                              <button
                                className="text-[11px] underline"
                                onClick={() =>
                                  setEditing({
                                    id: p.id,
                                    cycle: p.filingCycle ?? 'monthly',
                                    offset: String(p.dueMonthOffset ?? 1),
                                    day: String(p.dueDay ?? 15),
                                    rate: p.rate ?? '',
                                    deemedRate: p.deemedRate ?? '',
                                  })
                                }
                              >
                                {t('edit')}
                              </button>
                              <button
                                className="text-[11px] text-destructive underline"
                                onClick={() => deactivate.mutate(p.id)}
                              >
                                {t('deactivate')}
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
              <select
                className={field}
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
              >
                {TAX_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              <select className={field} value={cycle} onChange={(e) => setCycle(e.target.value)}>
                {CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {t(CYCLE_KEY[c])}
                  </option>
                ))}
              </select>
              <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(METHOD_KEY[m])}
                  </option>
                ))}
              </select>
              <input
                className={`${field} w-16`}
                placeholder={t('dueMonthOffset')}
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
              />
              <input
                className={`${field} w-16`}
                placeholder={t('dueDay')}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <input
                className={`${field} w-20`}
                placeholder="0.13"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              <input
                className={`${field} w-20`}
                placeholder={t('deemedRate')}
                value={deemedRate}
                onChange={(e) => setDeemedRate(e.target.value)}
              />
              <Button
                size="sm"
                disabled={saveProfile.isPending}
                onClick={() => saveProfile.mutate()}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('taxProfileSave')}
              </Button>
            </div>

            {editing && (
              <div className="mt-2 flex flex-wrap items-center gap-1 pt-1">
                <span className="text-[11px] text-muted-foreground">{t('editProfileHint')}</span>
                <select
                  className={field}
                  value={editing.cycle}
                  onChange={(e) => setEditing({ ...editing, cycle: e.target.value })}
                >
                  {CYCLES.map((c) => (
                    <option key={c} value={c}>
                      {t(CYCLE_KEY[c])}
                    </option>
                  ))}
                </select>
                <input
                  className={`${field} w-16`}
                  placeholder={t('dueMonthOffset')}
                  value={editing.offset}
                  onChange={(e) => setEditing({ ...editing, offset: e.target.value })}
                />
                <input
                  className={`${field} w-16`}
                  placeholder={t('dueDay')}
                  value={editing.day}
                  onChange={(e) => setEditing({ ...editing, day: e.target.value })}
                />
                <input
                  className={`${field} w-20`}
                  placeholder={t('rate')}
                  value={editing.rate}
                  onChange={(e) => setEditing({ ...editing, rate: e.target.value })}
                />
                <input
                  className={`${field} w-20`}
                  placeholder={t('deemedRate')}
                  value={editing.deemedRate}
                  onChange={(e) => setEditing({ ...editing, deemedRate: e.target.value })}
                />
                <Button
                  size="sm"
                  disabled={patchProfile.isPending}
                  onClick={() => patchProfile.mutate(editing)}
                >
                  <Save className="h-3.5 w-3.5" />
                  {t('save')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                  {t('cancel')}
                </Button>
              </div>
            )}
          </Card>

          <Card title={t('filingCalendarTitle')}>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-muted-foreground">{t('fromMonth')}</span>
              <input
                className={`${field} w-28`}
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
              />
              <span className="text-[11px] text-muted-foreground">{t('toMonth')}</span>
              <input
                className={`${field} w-28`}
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!fromMonth || !toMonth || genCalendar.isPending}
                onClick={() => genCalendar.mutate()}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                {t('generateCalendar')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!fromMonth || !toMonth || backfillAll.isPending}
                onClick={() => backfillAll.mutate()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('backfillAll')}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[11px] text-muted-foreground">{t('bindLedgerHint')}</span>
              <select
                className={field}
                value={ledgerToBind}
                onChange={(e) => setLedgerToBind(e.target.value)}
              >
                <option value="">{t('selectLedger')}</option>
                {ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!ledgerToBind || bindLedgerMut.isPending}
                onClick={() => bindLedgerMut.mutate()}
              >
                <Link2 className="h-3.5 w-3.5" />
                {t('bindLedger')}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
