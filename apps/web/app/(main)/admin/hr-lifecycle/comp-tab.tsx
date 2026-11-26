// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@ihui/ui-react'
import { api } from './types'
import { Card, Empty, Badge, field, th, td } from './ui'

/**
 * 人事补口页(2026-11-24):排班 / 社保增减员 / 年终奖 / 经济补偿 / 算薪复核。
 * 全部走 /api/hr-shift 与 /api/hr-comp;缺事实时后端点名缺项,前端不塞默认值。
 */

type Row = Record<string, unknown>
const SHIFT = '/api/hr-shift'
const COMP = '/api/hr-comp'

function rowsOf(v: unknown): Row[] {
  if (Array.isArray(v)) return v as Row[]
  const o = v as { rows?: Row[]; list?: Row[] }
  return o?.rows ?? o?.list ?? []
}

function Money({ v }: { v: unknown }) {
  return <b>{v === null || v === undefined || v === '' ? '-' : String(v)}</b>
}

export function CompTab() {
  const qc = useQueryClient()
  const [employeeId, setEmployeeId] = React.useState('')
  const [month, setMonth] = React.useState(new Date().toISOString().slice(0, 7))
  const [shiftId, setShiftId] = React.useState('')
  const [workDate, setWorkDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [bonus, setBonus] = React.useState('')
  const [lastBonus, setLastBonus] = React.useState<Row | null>(null)
  const [hireDate, setHireDate] = React.useState('')
  const [lastWorkDate, setLastWorkDate] = React.useState('')
  const [avgWage, setAvgWage] = React.useState('')
  const [localWage, setLocalWage] = React.useState('')
  const [lastSeverance, setLastSeverance] = React.useState<Row | null>(null)
  const [refRow, setRefRow] = React.useState('')
  const [platformRef, setPlatformRef] = React.useState('')
  const [note, setNote] = React.useState('')

  const employeesQ = useQuery({
    queryKey: ['hr', 'employees'],
    queryFn: () => api<unknown>('/api/hr-attendance/employees'),
  })
  const shiftsQ = useQuery({
    queryKey: ['hr', 'shifts'],
    queryFn: () => api<unknown>(`${SHIFT}/shifts`),
  })
  const calendarQ = useQuery({
    queryKey: ['hr', 'calendar', month],
    queryFn: () => api<unknown>(`${SHIFT}/calendar?month=${month}`),
  })
  const socialQ = useQuery({
    queryKey: ['hr', 'social', month],
    queryFn: () => api<unknown>(`${SHIFT}/social-changes?effectiveMonth=${month}`),
  })
  const periodsQ = useQuery({
    queryKey: ['hr', 'periods'],
    queryFn: () => api<unknown>('/api/hr-payroll/periods'),
  })

  const employees = rowsOf(employeesQ.data)
  const shifts = rowsOf(shiftsQ.data)
  const calendar = (calendarQ.data as { employees?: Row[] })?.employees ?? []
  const social = rowsOf(socialQ.data)
  const periods = rowsOf(periodsQ.data)

  const assignMut = useMutation({
    mutationFn: () =>
      api(`${SHIFT}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ employeeId, shiftId, workDates: [workDate] }),
      }),
    onSuccess: () => {
      toast.success('已排班')
      qc.invalidateQueries({ queryKey: ['hr', 'calendar'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const socialSubmitMut = useMutation({
    mutationFn: () =>
      api(`${SHIFT}/social-changes/${refRow}/submit`, {
        method: 'POST',
        body: JSON.stringify({ platformRef }),
      }),
    onSuccess: () => {
      toast.success('已回填平台回执')
      setPlatformRef('')
      qc.invalidateQueries({ queryKey: ['hr', 'social'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bonusMut = useMutation({
    mutationFn: () =>
      api<Row>(`${COMP}/bonus-payments`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId,
          periodMonth: month,
          bonusAmount: Number(bonus),
        }),
      }),
    onSuccess: (r) => {
      setLastBonus(r)
      toast.success('年终奖已登记并单独计税')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const severanceMut = useMutation({
    mutationFn: () =>
      api<{ record: Row; calc: Row }>(`${COMP}/severance-records`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId,
          hireDate,
          lastWorkDate,
          monthlyAvgWage: Number(avgWage),
          localAvgMonthlyWage: Number(localWage),
        }),
      }),
    onSuccess: (r) => {
      setLastSeverance(r.calc)
      toast.success('经济补偿已测算并留痕')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const reviewMut = useMutation({
    mutationFn: (p: { periodMonth: string; decision: 'approve' | 'reject' }) =>
      api(`${COMP}/payroll/review`, {
        method: 'POST',
        body: JSON.stringify({ ...p, note: note || undefined }),
      }),
    onSuccess: () => {
      toast.success('复核完成')
      qc.invalidateQueries({ queryKey: ['hr', 'periods'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitMut = useMutation({
    mutationFn: (periodMonth: string) =>
      api(`${COMP}/payroll/submit`, { method: 'POST', body: JSON.stringify({ periodMonth }) }),
    onSuccess: () => {
      toast.success('已提交复核')
      qc.invalidateQueries({ queryKey: ['hr', 'periods'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={field}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          <option value="">选择员工</option>
          {employees.map((e) => (
            <option key={String(e.id)} value={String(e.id)}>
              {String(e.name)}（{String(e.employeeNo)}）
            </option>
          ))}
        </select>
        <input
          className={field}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          placeholder="YYYY-MM"
        />
      </div>

      <Card title="排班">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select className={field} value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            <option value="">选择班次</option>
            {shifts.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>
                {String(s.name)} {String(s.startTime)}-{String(s.endTime)}
              </option>
            ))}
          </select>
          <input className={field} value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
          <Button
            size="sm"
            disabled={!employeeId || !shiftId || assignMut.isPending}
            onClick={() => assignMut.mutate()}
          >
            排班
          </Button>
        </div>
        {calendar.length === 0 ? (
          <Empty text="本月暂无排班" />
        ) : (
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>员工</th>
                  <th className={th}>日期</th>
                  <th className={th}>班次</th>
                  <th className={th}>时间</th>
                </tr>
              </thead>
              <tbody>
                {calendar.slice(0, 40).map((e) =>
                  ((e.days as Row[]) ?? []).map((d) => (
                    <tr
                      key={`${String(e.employeeId)}-${String(d.date)}`}
                      className="border-t border-stroke-subtle"
                    >
                      <td className={td}>{String(e.employeeName)}</td>
                      <td className={td}>{String(d.date)}</td>
                      <td className={td}>{String(d.shiftName)}</td>
                      <td className={td}>
                        {String(d.startTime)}-{String(d.endTime)}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="社保/公积金增减员台账">
        {social.length === 0 ? (
          <Empty text="本月暂无增减员(入职/离职会自动生成)" />
        ) : (
          <div className="space-y-2">
            {social.slice(0, 15).map((c) => (
              <div key={String(c.id)} className="font-[weight:inherit] flex flex-wrap items-center gap-2 text-label">
                <span>{String(c.changeType)}</span>
                <span className="text-muted-foreground">{String(c.effectiveMonth)}</span>
                <Badge status={String(c.status)} />
                <button className="text-[11px] underline" onClick={() => setRefRow(String(c.id))}>
                  选中回填
                </button>
              </div>
            ))}
            {refRow && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={field}
                  placeholder="平台回执号"
                  value={platformRef}
                  onChange={(e) => setPlatformRef(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!platformRef.trim() || socialSubmitMut.isPending}
                  onClick={() => socialSubmitMut.mutate()}
                >
                  标记已报
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="年终奖单独计税">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={field}
            placeholder="奖金金额"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!employeeId || !bonus || bonusMut.isPending}
            onClick={() => bonusMut.mutate()}
          >
            登记并计税
          </Button>
        </div>
        {lastBonus && (
          <p className="font-[weight:inherit] mt-2 text-label">
            税额 <Money v={lastBonus.taxAmount} /> / 实发 <Money v={lastBonus.netAmount} />
            （税率 {String((lastBonus.calcDetail as Row)?.rate ?? '-')}）
          </p>
        )}
      </Card>

      <Card title="经济补偿测算">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input
            className={field}
            placeholder="入职 YYYY-MM-DD"
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
          />
          <input
            className={field}
            placeholder="最后工作日"
            value={lastWorkDate}
            onChange={(e) => setLastWorkDate(e.target.value)}
          />
          <input
            className={field}
            placeholder="月平均工资"
            value={avgWage}
            onChange={(e) => setAvgWage(e.target.value)}
          />
          <input
            className={field}
            placeholder="当地社平月工资"
            value={localWage}
            onChange={(e) => setLocalWage(e.target.value)}
          />
          <Button
            size="sm"
            disabled={
              !employeeId ||
              !hireDate ||
              !lastWorkDate ||
              !avgWage ||
              !localWage ||
              severanceMut.isPending
            }
            onClick={() => severanceMut.mutate()}
          >
            测算并留痕
          </Button>
        </div>
        {lastSeverance && (
          <p className="font-[weight:inherit] text-label">
            补偿 <Money v={lastSeverance.compensationAmount} /> / 免税{' '}
            <Money v={lastSeverance.exemptAmount} /> / 个税 <Money v={lastSeverance.taxAmount} /> /
            实发 <Money v={lastSeverance.netAmount} />
          </p>
        )}
      </Card>

      <Card title="算薪复核（制单≠复核）">
        <input
          className={field}
          placeholder="复核意见/退回原因"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {periods.length === 0 ? (
          <Empty text="暂无薪资周期" />
        ) : (
          <ul className="mt-2 space-y-1">
            {periods.slice(0, 12).map((p) => (
              <li key={String(p.periodMonth)} className="font-[weight:inherit] flex flex-wrap items-center gap-2 text-label">
                <span className="font-mono">{String(p.periodMonth)}</span>
                <Badge status={String(p.status)} />
                {String(p.status) === 'calculated' && (
                  <>
                    <button
                      className="text-[11px] underline"
                      onClick={() => submitMut.mutate(String(p.periodMonth))}
                    >
                      提交复核
                    </button>
                    <button
                      className="text-[11px] text-success underline"
                      onClick={() =>
                        reviewMut.mutate({
                          periodMonth: String(p.periodMonth),
                          decision: 'approve',
                        })
                      }
                    >
                      批准
                    </button>
                    <button
                      className="text-[11px] text-destructive underline"
                      onClick={() =>
                        reviewMut.mutate({ periodMonth: String(p.periodMonth), decision: 'reject' })
                      }
                    >
                      退回
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
