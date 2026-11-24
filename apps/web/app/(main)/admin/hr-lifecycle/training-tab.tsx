// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 培训 tab(2026-11-24 九波):课程/计划/报名/完成。走 /api/hr-training。
 */
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { RefreshCw, BookOpen, CalendarPlus, Trophy, UserMinus, RotateCcw } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { api } from './types'
import { Card, Empty, Badge, field, th, td, btnGhost } from './ui'

const TR = '/api/hr-training'

type Row = Record<string, unknown>
function rowsOf(v: unknown): Row[] {
  if (Array.isArray(v)) return v as Row[]
  const o = v as { rows?: Row[]; list?: Row[] }
  return o?.rows ?? o?.list ?? []
}

export function TrainingTab() {
  const t = useTranslations('hrGap')
  const qc = useQueryClient()
  const [courseCode, setCourseCode] = React.useState('')
  const [courseName, setCourseName] = React.useState('')
  const [hours, setHours] = React.useState('1')
  const [planName, setPlanName] = React.useState('')
  const [planStart, setPlanStart] = React.useState(new Date().toISOString().slice(0, 10))
  const [planEnd, setPlanEnd] = React.useState('')
  const [selectedPlan, setSelectedPlan] = React.useState('')
  const [empId, setEmpId] = React.useState('')
  const [courseId, setCourseId] = React.useState('')

  const coursesQ = useQuery({ queryKey: ['hrt', 'courses'], queryFn: () => api<unknown>(`${TR}/courses`) })
  const plansQ = useQuery({ queryKey: ['hrt', 'plans'], queryFn: () => api<unknown>(`${TR}/plans`) })
  const employeesQ = useQuery({ queryKey: ['hr', 'employees'], queryFn: () => api<unknown>('/api/hr-attendance/employees') })
  const enrQ = useQuery({
    queryKey: ['hrt', 'enrollments', selectedPlan],
    queryFn: () => api<unknown>(`${TR}/plans/${selectedPlan}/enrollments`),
    enabled: Boolean(selectedPlan),
  })
  const progressQ = useQuery({
    queryKey: ['hrt', 'progress', selectedPlan],
    queryFn: () => api<unknown>(`${TR}/plans/${selectedPlan}/progress`),
    enabled: Boolean(selectedPlan),
  })
  const courses = rowsOf(coursesQ.data)
  const plans = rowsOf(plansQ.data)
  const employees = rowsOf(employeesQ.data)
  const enrollments = rowsOf(enrQ.data)
  const progress = (progressQ.data ?? {}) as Record<string, number>
  const invalidate = () => qc.invalidateQueries({ queryKey: ['hrt'] })

  const createCourse = useMutation({
    mutationFn: () =>
      api(`${TR}/courses`, {
        method: 'POST',
        body: JSON.stringify({ code: courseCode.trim(), name: courseName.trim(), durationHours: hours || '1' }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setCourseCode('')
      setCourseName('')
      invalidate()
      coursesQ.refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const createPlan = useMutation({
    mutationFn: () =>
      api(`${TR}/plans`, {
        method: 'POST',
        body: JSON.stringify({ name: planName.trim(), startFrom: planStart, endTo: planEnd || planStart }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setPlanName('')
      invalidate()
      plansQ.refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const planStatus = useMutation({
    mutationFn: (input: { id: string; status: 'open' | 'closed' }) =>
      api(`${TR}/plans/${input.id}/status`, { method: 'POST', body: JSON.stringify({ status: input.status }) }),
    onSuccess: () => {
      toast.success(t('done'))
      plansQ.refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const enroll = useMutation({
    // TData 由泛型显式给定:onSuccess 的参数标注要求 TData 是具体形状,
    // 而 apiOrThrow 不传泛型时 TData 推断成 unknown ⇒ TS2322(mutationFn 不是 MutationFunction<TData>)。
    mutationFn: () =>
      api<{ created?: number; skipped?: string[] }>(`${TR}/plans/${selectedPlan}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ assignments: [{ employeeId: empId, courseId }] }),
      }),
    onSuccess: (r: { created?: number; skipped?: string[] }) => {
      toast.success(`${t('done')} created=${r?.created ?? 0} skipped=${(r?.skipped ?? []).join(';')}`)
      invalidate()
      enrQ.refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const act = useMutation({
    mutationFn: (input: { id: string; what: 'complete' | 'drop' | 'reopen' }) =>
      api(`${TR}/enrollments/${input.id}/${input.what}`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
      enrQ.refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <Card
        title={t('trCourseTitle')}
        actions={
          <button className={btnGhost} onClick={() => coursesQ.refetch()}>
            <RefreshCw className="h-3 w-3" />
            {t('refresh')}
          </button>
        }
      >
        <div className="mb-2 flex flex-wrap items-end gap-2">
          <input className={field} placeholder={t('colCode')} value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
          <input className={field} placeholder={t('colName')} value={courseName} onChange={(e) => setCourseName(e.target.value)} />
          <input className={`${field} w-20`} placeholder={t('trDuration')} value={hours} onChange={(e) => setHours(e.target.value)} />
          <Button size="sm" disabled={!courseCode.trim() || !courseName.trim() || createCourse.isPending} onClick={() => createCourse.mutate()}>
            {t('create')}
          </Button>
        </div>
        {courses.length === 0 ? (
          <Empty text={t('noData')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('colCode')}</th>
                <th className={th}>{t('colName')}</th>
                <th className={th}>{t('trDuration')}</th>
                <th className={th}>{t('colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={String(c.id)} className="border-t border-stroke-subtle">
                  <td className={td}>{String(c.code)}</td>
                  <td className={td}>
                    <BookOpen className="mr-1 inline h-3 w-3" />
                    {String(c.name)}
                  </td>
                  <td className={`${td} tabular-nums`}>{String(c.durationHours)}</td>
                  <td className={td}>
                    <Badge status={String(c.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={t('trPlanTitle')}>
        <div className="mb-2 flex flex-wrap items-end gap-2">
          <input className={field} placeholder={t('perfCycleName')} value={planName} onChange={(e) => setPlanName(e.target.value)} />
          <input type="date" className={field} value={planStart} onChange={(e) => setPlanStart(e.target.value)} />
          <input type="date" className={field} value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} />
          <Button size="sm" disabled={!planName.trim() || createPlan.isPending} onClick={() => createPlan.mutate()}>
            <CalendarPlus className="h-3.5 w-3.5" />
            {t('create')}
          </Button>
        </div>
        {plans.length === 0 ? (
          <Empty text={t('noData')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('perfCycleName')}</th>
                <th className={th}>{t('perfRange')}</th>
                <th className={th}>{t('colStatus')}</th>
                <th className={th}>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={String(p.id)} className="border-t border-stroke-subtle">
                  <td className={td}>
                    <button className={btnGhost} onClick={() => setSelectedPlan(String(p.id))}>
                      {String(p.name)}
                    </button>
                  </td>
                  <td className={td}>
                    {String(p.startFrom).slice(0, 10)} ~ {String(p.endTo).slice(0, 10)}
                  </td>
                  <td className={td}>
                    <Badge status={String(p.status)} />
                  </td>
                  <td className={td}>
                    {p.status === 'draft' ? (
                      <button className={btnGhost} onClick={() => planStatus.mutate({ id: String(p.id), status: 'open' })}>
                        {t('perfOpenCycle')}
                      </button>
                    ) : null}
                    {p.status === 'open' ? (
                      <button className={btnGhost} onClick={() => planStatus.mutate({ id: String(p.id), status: 'closed' })}>
                        {t('perfCloseCycle')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selectedPlan ? (
        <>
          <Card title={t('trEnrollTitle')}>
            <div className="mb-2 flex flex-wrap items-end gap-2">
              <select className={field} value={empId} onChange={(e) => setEmpId(e.target.value)}>
                <option value="">{t('pickEmployee')}</option>
                {employees.map((emp) => (
                  <option key={String(emp.id)} value={String(emp.id)}>
                    {String(emp.name ?? emp.id)}
                  </option>
                ))}
              </select>
              <select className={field} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">{t('pickCourse')}</option>
                {courses.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.name)}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={!empId || !courseId || enroll.isPending} onClick={() => enroll.mutate()}>
                {t('enrollBtn')}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {`${t('trProgressTitle')}: enrolled=${progress.enrolled ?? 0} completed=${progress.completed ?? 0} dropped=${progress.dropped ?? 0}`}
            </p>
          </Card>
          <Card title={`${t('expTitle')} · ${plans.find((p) => String(p.id) === selectedPlan)?.name ?? ''}`}>
            {enrollments.length === 0 ? (
              <Empty text={t('noData')} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>{t('expEmployee')}</th>
                    <th className={th}>{t('colName')}</th>
                    <th className={th}>{t('colStatus')}</th>
                    <th className={th}>{t('trTotalHours')}</th>
                    <th className={th}>{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => {
                    const course = courses.find((c) => String(c.id) === String(e.courseId))
                    return (
                      <tr key={String(e.id)} className="border-t border-stroke-subtle">
                        <td className={td}>{String(e.employeeId).slice(0, 8)}</td>
                        <td className={td}>{course ? String(course.name) : String(e.courseId).slice(0, 8)}</td>
                        <td className={td}>
                          <Badge status={String(e.status)} />
                        </td>
                        <td className={`${td} tabular-nums`}>{String(e.hoursAtCompletion ?? '-')}</td>
                        <td className={td}>
                          {e.status === 'enrolled' ? (
                            <div className="flex gap-0.5">
                              <button className={btnGhost} onClick={() => act.mutate({ id: String(e.id), what: 'complete' })}>
                                <Trophy className="h-3 w-3" />
                                {t('trComplete')}
                              </button>
                              <button className={btnGhost} onClick={() => act.mutate({ id: String(e.id), what: 'drop' })}>
                                <UserMinus className="h-3 w-3" />
                                {t('trDrop')}
                              </button>
                            </div>
                          ) : null}
                          {e.status === 'dropped' ? (
                            <button className={btnGhost} onClick={() => act.mutate({ id: String(e.id), what: 'reopen' })}>
                              <RotateCcw className="h-3 w-3" />
                              {t('trReopen')}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
