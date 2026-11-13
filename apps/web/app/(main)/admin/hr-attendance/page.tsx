// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  Users,
  CalendarClock,
  BarChart3,
  ClipboardList,
  FileText,
  Play,
  Settings,
  Calculator,
} from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { RESOURCE, PERM, api } from './helpers'
import { MonthlyTab, SalaryConfigTab, PayrollTab } from './payroll-tabs'
import type {
  HrDepartment,
  HrEmployee,
  HrAttendanceRuleDto,
  HrAttendanceRecord,
  HrLeaveRequest,
  ListData,
} from './types'
import { BackButton } from '@/components/common'

type TabKey =
  | 'departments'
  | 'employees'
  | 'rule'
  | 'records'
  | 'stats'
  | 'leave'
  | 'monthly'
  | 'salaryConfig'
  | 'payroll'

const inputCls =
  'rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

export default function HrAttendancePage() {
  const t = useTranslations('hrAttendance')
  const [tab, setTab] = React.useState<TabKey>('departments')
  const [deptId, setDeptId] = React.useState('')

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'departments', label: t('tabDepartments'), icon: <Users className="h-4 w-4" /> },
    { key: 'employees', label: t('tabEmployees'), icon: <Users className="h-4 w-4" /> },
    { key: 'rule', label: t('tabRule'), icon: <CalendarClock className="h-4 w-4" /> },
    { key: 'records', label: t('tabRecords'), icon: <ClipboardList className="h-4 w-4" /> },
    { key: 'stats', label: t('tabStats'), icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'leave', label: t('tabLeave'), icon: <FileText className="h-4 w-4" /> },
    { key: 'monthly', label: t('tabMonthly'), icon: <Play className="h-4 w-4" /> },
    { key: 'salaryConfig', label: t('tabSalaryConfig'), icon: <Settings className="h-4 w-4" /> },
    { key: 'payroll', label: t('tabPayroll'), icon: <Calculator className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <h1 className="flex items-center gap-2 text-display font-bold tracking-tight">
        <Users className="h-6 w-6 text-primary" />
        {t('title')}
      </h1>

      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1 px-3 py-2 text-body ${
              tab === tb.key
                ? 'border-b-2 border-primary font-medium text-primary'
                : 'text-muted-foreground'
            }`}
          >
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'departments' && <DepartmentsTab t={t} />}
      {tab === 'employees' && <EmployeesTab t={t} />}
      {tab === 'rule' && <RuleTab t={t} deptId={deptId} setDeptId={setDeptId} />}
      {tab === 'records' && <RecordsTab t={t} deptId={deptId} setDeptId={setDeptId} />}
      {tab === 'stats' && <StatsTab t={t} deptId={deptId} setDeptId={setDeptId} />}
      {tab === 'leave' && <LeaveTab t={t} />}
      {tab === 'monthly' && <MonthlyTab t={t} />}
      {tab === 'salaryConfig' && <SalaryConfigTab t={t} />}
      {tab === 'payroll' && <PayrollTab t={t} />}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function DepartmentsTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'departments'],
    queryFn: () => api<ListData<HrDepartment>>(`${RESOURCE}/departments`),
  })
  const [name, setName] = React.useState('')
  const createMut = useMutation({
    mutationFn: () =>
      api(`${RESOURCE}/departments`, { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'departments'] })
      toast.success(t('createSuccess'))
      setName('')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const list = data?.list ?? []
  return (
    <Section title={t('tabDepartments')}>
      <div className="flex items-end gap-2">
        <label className="font-[weight:inherit] text-body">
          {t('colName')}
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <HasPermi code={`${PERM}:manage`}>
          <Button
            size="sm"
            disabled={!name || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            <Plus className="h-4 w-4" />
            {t('add')}
          </Button>
        </HasPermi>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="font-[weight:inherit] w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colName')}</th>
              <th className="px-2 py-1">{t('colId')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-2 py-1">{d.name}</td>
                <td className="px-2 py-1">{d.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

function EmployeesTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'employees'],
    queryFn: () => api<ListData<HrEmployee>>(`${RESOURCE}/employees`),
  })
  const [form, setForm] = React.useState({
    employeeNo: '',
    name: '',
    departmentId: '',
    position: '',
  })
  const createMut = useMutation({
    mutationFn: () => api(`${RESOURCE}/employees`, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'employees'] })
      toast.success(t('createSuccess'))
      setForm({ employeeNo: '', name: '', departmentId: '', position: '' })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const list = data?.list ?? []
  return (
    <Section title={t('tabEmployees')}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="font-[weight:inherit] text-body">
          {t('colEmployeeNo')}
          <input
            className={inputCls}
            value={form.employeeNo}
            onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
          />
        </label>
        <label className="font-[weight:inherit] text-body">
          {t('colName')}
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="font-[weight:inherit] text-body">
          {t('colDepartment')}
          <input
            className={inputCls}
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          />
        </label>
        <label className="font-[weight:inherit] text-body">
          {t('colPosition')}
          <input
            className={inputCls}
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          />
        </label>
        <HasPermi code={`${PERM}:manage`}>
          <Button size="sm" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
            {t('add')}
          </Button>
        </HasPermi>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="font-[weight:inherit] w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colEmployeeNo')}</th>
              <th className="px-2 py-1">{t('colName')}</th>
              <th className="px-2 py-1">{t('colDepartment')}</th>
              <th className="px-2 py-1">{t('colPosition')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-2 py-1">{e.employeeNo}</td>
                <td className="px-2 py-1">{e.name}</td>
                <td className="px-2 py-1">{e.departmentId}</td>
                <td className="px-2 py-1">{e.position ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

function RuleTab({
  t,
  deptId,
  setDeptId,
}: {
  t: ReturnType<typeof useTranslations>
  deptId: string
  setDeptId: (v: string) => void
}) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'rule', deptId],
    enabled: Boolean(deptId),
    queryFn: () =>
      api<{ rule: HrAttendanceRuleDto | null }>(
        `${RESOURCE}/attendance/rule?departmentId=${deptId}`,
      ),
  })
  const rule = data?.rule ?? null
  const [form, setForm] = React.useState({
    lateAfter: '',
    earlyBefore: '',
    absentAfter: '',
    workdays: '127',
    enabled: true,
  })
  React.useEffect(() => {
    if (rule)
      setForm({
        lateAfter: rule.lateAfter ?? '',
        earlyBefore: rule.earlyBefore ?? '',
        absentAfter: rule.absentAfter ?? '',
        workdays: String(rule.workdays),
        enabled: rule.enabled,
      })
  }, [rule])
  const upsertMut = useMutation({
    mutationFn: () =>
      api(`${RESOURCE}/attendance/rule`, {
        method: 'PUT',
        body: JSON.stringify({
          departmentId: deptId,
          lateAfter: form.lateAfter || null,
          earlyBefore: form.earlyBefore || null,
          absentAfter: form.absentAfter || null,
          workdays: Number(form.workdays) || 127,
          enabled: form.enabled,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'rule', deptId] })
      toast.success(t('updateSuccess'))
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Section title={t('tabRule')}>
      <div className="flex items-end gap-2">
        <label className="font-[weight:inherit] text-body">
          {t('colDepartment')}
          <input className={inputCls} value={deptId} onChange={(e) => setDeptId(e.target.value)} />
        </label>
      </div>
      {!deptId ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="font-[weight:inherit] text-body">
            {t('ruleLateAfter')}
            <input
              className={inputCls}
              value={form.lateAfter}
              placeholder="HH:MM"
              onChange={(e) => setForm({ ...form, lateAfter: e.target.value })}
            />
          </label>
          <label className="font-[weight:inherit] text-body">
            {t('ruleEarlyBefore')}
            <input
              className={inputCls}
              value={form.earlyBefore}
              placeholder="HH:MM"
              onChange={(e) => setForm({ ...form, earlyBefore: e.target.value })}
            />
          </label>
          <label className="font-[weight:inherit] text-body">
            {t('ruleAbsentAfter')}
            <input
              className={inputCls}
              value={form.absentAfter}
              placeholder="HH:MM"
              onChange={(e) => setForm({ ...form, absentAfter: e.target.value })}
            />
          </label>
          <label className="font-[weight:inherit] text-body">
            {t('ruleWorkdays')}
            <input
              className={inputCls}
              value={form.workdays}
              onChange={(e) => setForm({ ...form, workdays: e.target.value })}
            />
          </label>
          <label className="font-[weight:inherit] text-body flex items-center gap-1">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            {t('ruleEnabled')}
          </label>
          <HasPermi code={`${PERM}:manage`}>
            <Button size="sm" disabled={upsertMut.isPending} onClick={() => upsertMut.mutate()}>
              {t('save')}
            </Button>
          </HasPermi>
        </div>
      )}
    </Section>
  )
}

function RecordsTab({
  t,
  deptId,
  setDeptId,
}: {
  t: ReturnType<typeof useTranslations>
  deptId: string
  setDeptId: (v: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'records', deptId],
    queryFn: () =>
      api<ListData<HrAttendanceRecord>>(`${RESOURCE}/attendance/records?departmentId=${deptId}`),
  })
  const list = data?.list ?? []
  return (
    <Section title={t('tabRecords')}>
      <label className="font-[weight:inherit] text-body">
        {t('colDepartment')}
        <input className={inputCls} value={deptId} onChange={(e) => setDeptId(e.target.value)} />
      </label>
      {!deptId ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="font-[weight:inherit] w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colDate')}</th>
              <th className="px-2 py-1">{t('colEmployeeNo')}</th>
              <th className="px-2 py-1">{t('colCheckIn')}</th>
              <th className="px-2 py-1">{t('colCheckOut')}</th>
              <th className="px-2 py-1">{t('colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1">{r.date}</td>
                <td className="px-2 py-1">{r.employeeId}</td>
                <td className="px-2 py-1">{r.checkInTime ?? '-'}</td>
                <td className="px-2 py-1">{r.checkOutTime ?? '-'}</td>
                <td className="px-2 py-1">
                  {t(
                    `status${r.status.charAt(0).toUpperCase()}${r.status.slice(1)}` as 'statusPresent',
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

function StatsTab({
  t,
  deptId,
  setDeptId,
}: {
  t: ReturnType<typeof useTranslations>
  deptId: string
  setDeptId: (v: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'stats', deptId],
    queryFn: () =>
      api<{ stats: { total: number; byStatus: Record<string, number> } }>(
        `${RESOURCE}/attendance/stats?departmentId=${deptId}`,
      ),
  })
  return (
    <Section title={t('tabStats')}>
      <label className="font-[weight:inherit] text-body">
        {t('colDepartment')}
        <input className={inputCls} value={deptId} onChange={(e) => setDeptId(e.target.value)} />
      </label>
      {!deptId ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : (
        <div className="flex gap-3">
          {Object.entries(data?.stats.byStatus ?? {}).map(([k, v]) => (
            <div key={k} className="rounded-lg border px-3 py-2 text-center">
              <div className="text-lg font-bold">{v}</div>
              <div className="font-[weight:inherit] text-label text-muted-foreground">
                {t(`status${k.charAt(0).toUpperCase()}${k.slice(1)}` as 'statusPresent')}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function LeaveTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'leave'],
    queryFn: () => api<ListData<HrLeaveRequest>>(`${RESOURCE}/leave`),
  })
  const decide = useMutation({
    mutationFn: (p: { id: string; decision: 'approved' | 'rejected' }) =>
      api(`${RESOURCE}/leave/${p.id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ decision: p.decision }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'leave'] })
      toast.success(t('updateSuccess'))
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const list = data?.list ?? []
  return (
    <Section title={t('tabLeave')}>
      {isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="font-[weight:inherit] w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colEmployeeNo')}</th>
              <th className="px-2 py-1">{t('colStart')}</th>
              <th className="px-2 py-1">{t('colEnd')}</th>
              <th className="px-2 py-1">{t('colReason')}</th>
              <th className="px-2 py-1">{t('colStatus')}</th>
              <th className="px-2 py-1">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-2 py-1">{l.employeeId}</td>
                <td className="px-2 py-1">{l.startDate}</td>
                <td className="px-2 py-1">{l.endDate}</td>
                <td className="px-2 py-1">{l.reason}</td>
                <td className="px-2 py-1">
                  {t(
                    `status${l.status.charAt(0).toUpperCase()}${l.status.slice(1)}` as 'statusPending',
                  )}
                </td>
                <td className="px-2 py-1 space-x-2">
                  <HasPermi code={`${PERM}:manage`}>
                    <button
                      className="text-primary hover:underline"
                      onClick={() => decide.mutate({ id: l.id, decision: 'approved' })}
                    >
                      {t('approve')}
                    </button>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => decide.mutate({ id: l.id, decision: 'rejected' })}
                    >
                      {t('reject')}
                    </button>
                  </HasPermi>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
