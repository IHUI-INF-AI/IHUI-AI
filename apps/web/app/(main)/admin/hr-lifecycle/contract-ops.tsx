// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 合同到期作业(2026-11-23 补):合同列表只有"按状态查",看不到"30 天内到期几何";
 * /contracts/summary 与 /contracts/expiring 两个口径此前没有任何界面。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FileClock, RefreshCw, SquareX } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { rowsOf } from '@/lib/api-rows'
import { api, HR_RESOURCE, todayStr, type HrContract } from './types'
import { Card, Empty, Badge, field, th, td, btnGhost } from './ui'

interface ContractSummary {
  today: string
  total: number
  signed: number
  draft: number
  expiring: number
  expired: number
  indefinite: number
}

interface EmpRow {
  id: string
  employeeNo: string
  name: string
}

const CONTRACT_TYPES = ['fixed', 'indefinite', 'internship', 'parttime', 'labor'] as const

const CT_LABEL = {
  fixed: 'ctFixed',
  indefinite: 'ctIndefinite',
  internship: 'ctInternship',
  parttime: 'ctParttime',
  labor: 'ctLabor',
} as const

/** 合同到期作业台:新建 + 汇总 + 到期清单 + 续签/终止/置到期 */
export function ContractOps() {
  const t = useTranslations('hrLifecycle')
  const qc = useQueryClient()
  const [days, setDays] = React.useState('30')
  const [newOpen, setNewOpen] = React.useState(false)
  const [empId, setEmpId] = React.useState('')
  const [contractNo, setContractNo] = React.useState('')
  const [contractType, setContractType] = React.useState<string>('fixed')
  const [startDate, setStartDate] = React.useState(todayStr())
  const [endDate, setEndDate] = React.useState('')
  const [probMonths, setProbMonths] = React.useState('0')
  const [action, setAction] = React.useState<{
    id: string
    kind: 'renew' | 'terminate'
    startDate: string
    endDate: string
    probationMonths: string
    reason: string
  } | null>(null)

  const sumQ = useQuery({
    queryKey: ['hrl', 'contracts-summary'],
    queryFn: () => api<ContractSummary>(`${HR_RESOURCE}/contracts/summary`),
  })
  const expQ = useQuery({
    queryKey: ['hrl', 'contracts-expiring', days],
    queryFn: () =>
      api<{ days: number; count: number; rows: HrContract[] }>(
        `${HR_RESOURCE}/contracts/expiring?days=${days || '30'}`,
      ),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hrl'] })

  const empQ = useQuery({
    queryKey: ['hrl', 'employees-for-contract'],
    queryFn: () => api<unknown>('/api/hr-attendance/employees'),
  })
  const employees = rowsOf<EmpRow>(empQ.data)

  const createMut = useMutation({
    mutationFn: () =>
      api(`${HR_RESOURCE}/contracts`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: empId,
          contractNo: contractNo.trim() || null,
          contractType,
          startDate,
          endDate: endDate || null,
          probationMonths: probMonths ? Number(probMonths) : 0,
        }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setNewOpen(false)
      setContractNo('')
      setEndDate('')
      setProbMonths('0')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const renewMut = useMutation({
    mutationFn: (p: { id: string; startDate: string; endDate: string; probation: string }) =>
      api(`${HR_RESOURCE}/contracts/${p.id}/renew`, {
        method: 'POST',
        body: JSON.stringify({
          startDate: p.startDate,
          endDate: p.endDate || null,
          probationMonths: p.probation ? Number(p.probation) : 0,
        }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setAction(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const terminateMut = useMutation({
    mutationFn: (p: { id: string; reason: string }) =>
      api(`${HR_RESOURCE}/contracts/${p.id}/terminate`, {
        method: 'POST',
        body: JSON.stringify({ reason: p.reason.trim() }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setAction(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const expireMut = useMutation({
    mutationFn: (id: string) => api(`${HR_RESOURCE}/contracts/${id}/expire`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const s = sumQ.data
  const rows = expQ.data?.rows ?? []

  return (
    <div className="space-y-3">
      <Card
        title={t('newContractTitle')}
        actions={
          <button className={btnGhost} onClick={() => setNewOpen((v) => !v)}>
            {newOpen ? t('cancel') : t('newContract')}
          </button>
        }
      >
        {!newOpen ? (
          <Empty text={t('newContractHint')} />
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <select className={field} value={empId} onChange={(e) => setEmpId(e.target.value)}>
              <option value="">{t('selectEmployee')}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeNo} {e.name}
                </option>
              ))}
            </select>
            <input
              className={`${field} w-32`}
              placeholder={t('contractNo')}
              value={contractNo}
              onChange={(e) => setContractNo(e.target.value)}
            />
            <select
              className={field}
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
            >
              {CONTRACT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {t(CT_LABEL[c])}
                </option>
              ))}
            </select>
            <input
              type="date"
              className={field}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              className={field}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <input
              className={`${field} w-16`}
              placeholder={t('probationMonths')}
              value={probMonths}
              onChange={(e) => setProbMonths(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!empId || !startDate || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {t('contractCreate')}
            </Button>
          </div>
        )}
      </Card>

      <Card
        title={t('contractSummaryTitle')}
        actions={s ? <span className="text-[11px] text-muted-foreground">{s.today}</span> : null}
      >
        {!s ? (
          <Empty text={t('loading')} />
        ) : (
          <div className="font-[weight:inherit] flex flex-wrap gap-4 text-label tabular-nums">
            <span>
              {t('contractTotal')}: <b>{s.total}</b>
            </span>
            <span className="text-success">
              {t('contractSigned')}: <b>{s.signed}</b>
            </span>
            <span>
              {t('contractDraft')}: <b>{s.draft}</b>
            </span>
            <span className={s.expiring > 0 ? 'text-warning' : 'text-muted-foreground'}>
              {t('contractExpiring')}: <b>{s.expiring}</b>
            </span>
            <span className={s.expired > 0 ? 'text-destructive' : 'text-muted-foreground'}>
              {t('contractExpired')}: <b>{s.expired}</b>
            </span>
            <span className="text-muted-foreground">
              {t('contractIndefinite')}: {s.indefinite}
            </span>
          </div>
        )}
      </Card>

      <Card
        title={t('contractExpiringTitle')}
        actions={
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">{t('expiringDays')}</span>
            <input
              className={`${field} w-16`}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
        }
      >
        {rows.length === 0 ? (
          <Empty text={t('noExpiring')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('contractNo')}</th>
                <th className={th}>{t('contractType')}</th>
                <th className={th}>{t('endDate')}</th>
                <th className={th}>{t('expiryState')}</th>
                <th className={th}>{t('status')}</th>
                <th className={th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-stroke-subtle">
                  <td className={`${td} font-mono`}>{r.contractNo}</td>
                  <td className={td}>{r.contractType}</td>
                  <td className={`${td} tabular-nums`}>{r.endDate ?? '-'}</td>
                  <td className={td}>
                    <Badge status={r.expiryState ?? '-'} />
                  </td>
                  <td className={td}>
                    <Badge status={r.status} />
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-0.5">
                      <button
                        className={btnGhost}
                        onClick={() =>
                          setAction({
                            id: r.id,
                            kind: 'renew',
                            startDate: todayStr(),
                            endDate: '',
                            probationMonths: '0',
                            reason: '',
                          })
                        }
                      >
                        <RefreshCw className="h-3 w-3" />
                        {t('renewContract')}
                      </button>
                      <button
                        className={btnGhost}
                        onClick={() =>
                          setAction({
                            id: r.id,
                            kind: 'terminate',
                            startDate: '',
                            endDate: '',
                            probationMonths: '',
                            reason: '',
                          })
                        }
                      >
                        <FileClock className="h-3 w-3" />
                        {t('terminateContract')}
                      </button>
                      {r.expiryState === 'expired' && (
                        <button className={btnGhost} onClick={() => expireMut.mutate(r.id)}>
                          <SquareX className="h-3 w-3" />
                          {t('expireContract')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {action && (
          <div className="mt-3 space-y-2 pt-1">
            {action.kind === 'renew' ? (
              <div className="flex flex-wrap items-end gap-2">
                <span className="text-[11px] text-muted-foreground">{t('renewStartDate')}</span>
                <input
                  type="date"
                  className={field}
                  value={action.startDate}
                  onChange={(e) => setAction({ ...action, startDate: e.target.value })}
                />
                <span className="text-[11px] text-muted-foreground">{t('renewEndDate')}</span>
                <input
                  type="date"
                  className={field}
                  value={action.endDate}
                  onChange={(e) => setAction({ ...action, endDate: e.target.value })}
                />
                <span className="text-[11px] text-muted-foreground">{t('probationMonths')}</span>
                <input
                  className={`${field} w-16`}
                  value={action.probationMonths}
                  onChange={(e) => setAction({ ...action, probationMonths: e.target.value })}
                />
                <Button
                  size="sm"
                  disabled={!action.startDate || renewMut.isPending}
                  onClick={() =>
                    renewMut.mutate({
                      id: action.id,
                      startDate: action.startDate,
                      endDate: action.endDate,
                      probation: action.probationMonths,
                    })
                  }
                >
                  {t('renewSubmit')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAction(null)}>
                  {t('cancel')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <span className="text-[11px] text-muted-foreground">{t('terminateReason')}</span>
                <input
                  className={`${field} w-96`}
                  value={action.reason}
                  onChange={(e) => setAction({ ...action, reason: e.target.value })}
                />
                <Button
                  size="sm"
                  disabled={action.reason.trim().length < 2 || terminateMut.isPending}
                  onClick={() => terminateMut.mutate({ id: action.id, reason: action.reason })}
                >
                  {t('terminateSubmit')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAction(null)}>
                  {t('cancel')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
