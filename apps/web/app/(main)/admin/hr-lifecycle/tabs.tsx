// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, RefreshCw, UserCheck } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { rowsOf } from '@/lib/api-rows'
import {
  api,
  HR_RESOURCE,
  DEPT_RESOURCE,
  CANDIDATE_STAGES,
  todayStr,
  type HrContract,
  type HrProbationDue,
  type HrOpening,
  type HrCandidate,
  type HrOverview,
  type HrDepartment,
} from './types'

// 共享小组件在 ui.tsx;离职/发薪两 tab 在各自文件(单文件行数门)
import { Card, Empty, Badge, field, th, td, btnGhost } from './ui'

/** 看板:今天该干什么(合同到期 / 试用到期 / 招聘缺口 / 离职在途) */
export function BoardTab() {
  const t = useTranslations('hrLifecycle')
  const overviewQ = useQuery({
    queryKey: ['hrl', 'overview'],
    queryFn: () => api<HrOverview>(`${HR_RESOURCE}/overview`),
  })
  const ov = overviewQ.data

  if (overviewQ.isLoading) return <Empty text={t('loading')} />
  if (!ov) return <Empty text={t('noData')} />

  const cards: Array<{ key: string; label: string; value: string | number; hint: string }> = [
    {
      key: 'contracts',
      label: t('kContracts'),
      value: ov.contracts.total,
      hint: t('kContractsHint', { signed: ov.contracts.signed, draft: ov.contracts.draft }),
    },
    {
      key: 'expiring',
      label: t('kExpiring'),
      value: ov.contracts.expiring,
      hint: t('kExpiringHint', { expired: ov.contracts.expired }),
    },
    {
      key: 'probation',
      label: t('kProbation'),
      value: ov.probationDue.count,
      hint: t('kProbationHint'),
    },
    {
      key: 'gap',
      label: t('kGap'),
      value: ov.recruitment.openings.openGap,
      hint: t('kGapHint', { candidates: ov.recruitment.candidates.total }),
    },
    {
      key: 'resign',
      label: t('kResign'),
      value: ov.resignations.total,
      hint: t('kResignHint', { settled: ov.resignations.byStatus.settled ?? 0 }),
    },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.key} className="rounded-lg border border-stroke-subtle bg-card p-3">
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{c.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>

      <Card title={t('probationDueTitle')}>
        {ov.probationDue.employees.length === 0 ? (
          <Empty text={t('probationNone')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('employeeNo')}</th>
                <th className={th}>{t('employeeName')}</th>
                <th className={th}>{t('probationEnd')}</th>
                <th className={th}>{t('contractStart')}</th>
              </tr>
            </thead>
            <tbody>
              {ov.probationDue.employees.map((p) => (
                <tr key={p.contractId} className="border-t border-stroke-subtle">
                  <td className={td}>{p.employeeNo}</td>
                  <td className={td}>{p.employeeName}</td>
                  <td className={td}>{p.probationEndDate}</td>
                  <td className={td}>{p.startDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

/** 合同:列表 + 签发/终止/到期 + 续签 + 试用转正 */
export function ContractsTab() {
  const t = useTranslations('hrLifecycle')
  const qc = useQueryClient()
  const [status, setStatus] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [renewStart, setRenewStart] = React.useState(todayStr())
  const [renewEnd, setRenewEnd] = React.useState('')
  const [extendTo, setExtendTo] = React.useState('')

  const contractsQ = useQuery({
    queryKey: ['hrl', 'contracts', status],
    queryFn: () => api<unknown>(`${HR_RESOURCE}/contracts${status ? `?status=${status}` : ''}`),
  })
  const dueQ = useQuery({
    queryKey: ['hrl', 'probationDue'],
    queryFn: () => api<unknown>(`${HR_RESOURCE}/probation/due`),
  })
  const contracts = rowsOf<HrContract>(contractsQ.data)
  const due = rowsOf<HrProbationDue>(dueQ.data)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hrl'] })
  }

  const transit = useMutation({
    mutationFn: (input: { id: string; to: 'sign' | 'expire' | 'terminate' }) =>
      api(`${HR_RESOURCE}/contracts/${input.id}/${input.to}`, {
        method: 'POST',
        body: input.to === 'terminate' ? JSON.stringify({ reason: reason.trim() }) : undefined,
      }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const renew = useMutation({
    mutationFn: (id: string) =>
      api(`${HR_RESOURCE}/contracts/${id}/renew`, {
        method: 'POST',
        body: JSON.stringify({ startDate: renewStart, endDate: renewEnd || null }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const review = useMutation({
    mutationFn: (input: { employeeId: string; contractId: string; result: 'pass' | 'extend' }) =>
      api(`${HR_RESOURCE}/probation/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: input.employeeId,
          contractId: input.contractId,
          result: input.result,
          extendedUntil: input.result === 'extend' ? extendTo || null : null,
        }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <Card
        title={t('contractsTitle')}
        actions={
          <div className="flex items-center gap-1">
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('allStatus')}</option>
              {['draft', 'signed', 'expired', 'terminated', 'renewed'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className={btnGhost} onClick={() => contractsQ.refetch()}>
              <RefreshCw className="h-3 w-3" />
              {t('refresh')}
            </button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <input
            className={field}
            placeholder={t('terminateReason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <span className="text-[11px] text-muted-foreground">{t('renewHint')}</span>
          <input
            type="date"
            className={field}
            value={renewStart}
            onChange={(e) => setRenewStart(e.target.value)}
          />
          <input
            type="date"
            className={field}
            value={renewEnd}
            onChange={(e) => setRenewEnd(e.target.value)}
          />
        </div>
        {contracts.length === 0 ? (
          <Empty text={t('noContracts')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('contractNo')}</th>
                <th className={th}>{t('employee')}</th>
                <th className={th}>{t('contractType')}</th>
                <th className={th}>{t('period')}</th>
                <th className={th}>{t('probationEnd')}</th>
                <th className={th}>{t('status')}</th>
                <th className={th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-t border-stroke-subtle">
                  <td className={td}>{c.contractNo}</td>
                  <td className={td}>{c.employeeId.slice(0, 8)}</td>
                  <td className={td}>{c.contractType}</td>
                  <td className={td}>
                    {c.startDate} ~ {c.endDate ?? t('indefiniteEnd')}
                  </td>
                  <td className={td}>{c.probationEndDate ?? '-'}</td>
                  <td className={td}>
                    <Badge status={c.status} />
                    {c.expiryState && c.expiryState !== 'active' ? (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {c.expiryState}
                      </span>
                    ) : null}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-0.5">
                      {c.status === 'draft' && (
                        <button
                          className={btnGhost}
                          disabled={transit.isPending}
                          onClick={() => transit.mutate({ id: c.id, to: 'sign' })}
                        >
                          {t('sign')}
                        </button>
                      )}
                      {(c.status === 'signed' || c.status === 'draft') && (
                        <>
                          <button
                            className={btnGhost}
                            disabled={transit.isPending}
                            onClick={() => transit.mutate({ id: c.id, to: 'expire' })}
                          >
                            {t('expire')}
                          </button>
                          <button
                            className={btnGhost}
                            disabled={transit.isPending}
                            onClick={() => transit.mutate({ id: c.id, to: 'terminate' })}
                          >
                            {t('terminate')}
                          </button>
                          <button
                            className={btnGhost}
                            disabled={renew.isPending}
                            onClick={() => renew.mutate(c.id)}
                          >
                            {t('renew')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card
        title={t('probationDueTitle')}
        actions={
          <span className="text-[11px] text-muted-foreground">{t('probationExtendHint')}</span>
        }
      >
        <div className="mb-2">
          <input
            type="date"
            className={field}
            value={extendTo}
            onChange={(e) => setExtendTo(e.target.value)}
          />
        </div>
        {due.length === 0 ? (
          <Empty text={t('probationNone')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('employeeNo')}</th>
                <th className={th}>{t('employeeName')}</th>
                <th className={th}>{t('probationEnd')}</th>
                <th className={th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {due.map((p) => (
                <tr key={p.contractId} className="border-t border-stroke-subtle">
                  <td className={td}>{p.employeeNo}</td>
                  <td className={td}>{p.employeeName}</td>
                  <td className={td}>{p.probationEndDate}</td>
                  <td className={td}>
                    <div className="flex gap-0.5">
                      <button
                        className={btnGhost}
                        disabled={review.isPending}
                        onClick={() =>
                          review.mutate({
                            employeeId: p.employeeId,
                            contractId: p.contractId,
                            result: 'pass',
                          })
                        }
                      >
                        <UserCheck className="h-3 w-3" />
                        {t('passProbation')}
                      </button>
                      <button
                        className={btnGhost}
                        disabled={review.isPending || !extendTo}
                        onClick={() =>
                          review.mutate({
                            employeeId: p.employeeId,
                            contractId: p.contractId,
                            result: 'extend',
                          })
                        }
                      >
                        {t('extendProbation')}
                      </button>
                    </div>
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

/** 招聘:岗位 → 候选人 → 面试 → 录用入职(录用即建员工+合同草稿) */
export function RecruitTab() {
  const t = useTranslations('hrLifecycle')
  const qc = useQueryClient()
  const [title, setTitle] = React.useState('')
  const [deptId, setDeptId] = React.useState('')
  const [headCount, setHeadCount] = React.useState('1')
  const [candName, setCandName] = React.useState('')
  const [openingId, setOpeningId] = React.useState('')
  const [hireFor, setHireFor] = React.useState<string | null>(null)
  const [hireNo, setHireNo] = React.useState('')
  const [hireDept, setHireDept] = React.useState('')

  const deptQ = useQuery({
    queryKey: ['hrl', 'departments'],
    queryFn: () => api<unknown>(`${DEPT_RESOURCE}/departments`),
  })
  const openingsQ = useQuery({
    queryKey: ['hrl', 'openings'],
    queryFn: () => api<unknown>(`${HR_RESOURCE}/openings`),
  })
  const candsQ = useQuery({
    queryKey: ['hrl', 'candidates'],
    queryFn: () => api<unknown>(`${HR_RESOURCE}/candidates`),
  })
  const depts = rowsOf<HrDepartment>(deptQ.data)
  const openings = rowsOf<HrOpening>(openingsQ.data)
  const cands = rowsOf<HrCandidate>(candsQ.data)
  const invalidate = () => qc.invalidateQueries({ queryKey: ['hrl'] })

  const createOpening = useMutation({
    mutationFn: () =>
      api(`${HR_RESOURCE}/openings`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          departmentId: deptId,
          headCount: Number(headCount) || 1,
          status: 'open',
        }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setTitle('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const createCand = useMutation({
    mutationFn: () =>
      api(`${HR_RESOURCE}/candidates`, {
        method: 'POST',
        body: JSON.stringify({ openingId, name: candName.trim() }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setCandName('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const advance = useMutation({
    mutationFn: (input: { id: string; stage: string }) =>
      api(`${HR_RESOURCE}/candidates/${input.id}/advance`, {
        method: 'POST',
        body: JSON.stringify({ stage: input.stage }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const hire = useMutation({
    mutationFn: (id: string) =>
      api(`${HR_RESOURCE}/candidates/${id}/hire`, {
        method: 'POST',
        body: JSON.stringify({ employeeNo: hireNo.trim(), departmentId: hireDept }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setHireFor(null)
      setHireNo('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <Card title={t('openingsTitle')}>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <input
            className={field}
            placeholder={t('openingTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select className={field} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            <option value="">{t('pickDept')}</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            className={`${field} w-16`}
            type="number"
            min="1"
            value={headCount}
            onChange={(e) => setHeadCount(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!title.trim() || !deptId || createOpening.isPending}
            onClick={() => createOpening.mutate()}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('create')}
          </Button>
        </div>
        {openings.length === 0 ? (
          <Empty text={t('noOpenings')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('openingCode')}</th>
                <th className={th}>{t('openingTitle')}</th>
                <th className={th}>{t('hiringProgress')}</th>
                <th className={th}>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {openings.map((o) => (
                <tr key={o.id} className="border-t border-stroke-subtle">
                  <td className={td}>{o.code}</td>
                  <td className={td}>{o.title}</td>
                  <td className={`${td} tabular-nums`}>
                    {o.hiredCount}/{o.headCount}
                  </td>
                  <td className={td}>
                    <Badge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={t('candidatesTitle')}>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <input
            className={field}
            placeholder={t('candidateName')}
            value={candName}
            onChange={(e) => setCandName(e.target.value)}
          />
          <select
            className={field}
            value={openingId}
            onChange={(e) => setOpeningId(e.target.value)}
          >
            <option value="">{t('pickOpening')}</option>
            {openings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!candName.trim() || !openingId || createCand.isPending}
            onClick={() => createCand.mutate()}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('create')}
          </Button>
        </div>
        {cands.length === 0 ? (
          <Empty text={t('noCandidates')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('candidateName')}</th>
                <th className={th}>{t('stage')}</th>
                <th className={th}>{t('phone')}</th>
                <th className={th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {cands.map((c) => (
                <tr key={c.id} className="border-t border-stroke-subtle">
                  <td className={td}>{c.name}</td>
                  <td className={td}>
                    <Badge status={c.stage} />
                  </td>
                  <td className={td}>{c.phone ?? '-'}</td>
                  <td className={td}>
                    <div className="flex flex-wrap items-center gap-1">
                      <select
                        className={`${field} !py-0.5 text-[11px]`}
                        value={c.stage}
                        onChange={(e) => advance.mutate({ id: c.id, stage: e.target.value })}
                        disabled={advance.isPending || c.stage === 'hired'}
                      >
                        {CANDIDATE_STAGES.map((s) => (
                          <option key={s} value={s} disabled={s === 'hired'}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {c.stage === 'offer' && (
                        <button
                          className={btnGhost}
                          onClick={() => setHireFor(hireFor === c.id ? null : c.id)}
                        >
                          {t('hire')}
                        </button>
                      )}
                    </div>
                    {hireFor === c.id && (
                      <div className="mt-1 flex flex-wrap items-end gap-1 rounded-md border border-stroke-subtle p-1.5">
                        <input
                          className={`${field} w-24`}
                          placeholder={t('employeeNo')}
                          value={hireNo}
                          onChange={(e) => setHireNo(e.target.value)}
                        />
                        <select
                          className={`${field} text-[11px]`}
                          value={hireDept}
                          onChange={(e) => setHireDept(e.target.value)}
                        >
                          <option value="">{t('pickDept')}</option>
                          {depts.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          disabled={!hireNo.trim() || !hireDept || hire.isPending}
                          onClick={() => hire.mutate(c.id)}
                        >
                          {t('hireConfirm')}
                        </Button>
                      </div>
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

/** 离职:申请 → 批准 → 交接清单 → 办结(出证明、终止合同、员工置 left) */

// 页面仍从 './tabs' 一处导入(拆分不改变调用方)
export { ResignTab } from './resign-tab'
export { PayoutTab } from './payout-tab'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
