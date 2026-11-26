// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 职级 tab(2026-11-24 九波):字典维护 + 授予 + 分布。走 /api/hr-grade。
 */
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { RefreshCw, Share2 } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { api } from './types'
import { Card, Empty, Badge, field, th, td, btnGhost } from './ui'

const GRADE = '/api/hr-grade'

type Row = Record<string, unknown>
function rowsOf(v: unknown): Row[] {
  if (Array.isArray(v)) return v as Row[]
  const o = v as { rows?: Row[]; list?: Row[] }
  return o?.rows ?? o?.list ?? []
}

export function GradeTab() {
  const t = useTranslations('hrGap')
  const qc = useQueryClient()
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [level, setLevel] = React.useState('1')
  const [employeeId, setEmployeeId] = React.useState('')
  const [gradeId, setGradeId] = React.useState('')
  const [effectiveFrom, setEffectiveFrom] = React.useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = React.useState('promotion')

  const gradesQ = useQuery({
    queryKey: ['hrg', 'grades'],
    queryFn: () => api<unknown>(`${GRADE}/grades`),
  })
  const distQ = useQuery({
    queryKey: ['hrg', 'distribution'],
    queryFn: () => api<unknown>(`${GRADE}/distribution`),
  })
  const employeesQ = useQuery({
    queryKey: ['hr', 'employees'],
    queryFn: () => api<unknown>('/api/hr-attendance/employees'),
  })
  const grades = rowsOf(gradesQ.data)
  const dist = rowsOf(distQ.data)
  const employees = rowsOf(employeesQ.data)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hrg'] })
  const create = useMutation({
    mutationFn: () =>
      api(`${GRADE}/grades`, {
        method: 'POST',
        body: JSON.stringify({ code: code.trim(), name: name.trim(), level: Number(level) || 1 }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setCode('')
      setName('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const grant = useMutation({
    mutationFn: () =>
      api(`${GRADE}/grant`, {
        method: 'POST',
        body: JSON.stringify({ employeeId, gradeId, effectiveFrom, reason }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const retire = useMutation({
    mutationFn: (id: string) =>
      api(`${GRADE}/grades/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'retired' }) }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <Card
        title={t('gradeCreateTitle')}
        actions={
          <button className={btnGhost} onClick={() => gradesQ.refetch()}>
            <RefreshCw className="h-3 w-3" />
            {t('refresh')}
          </button>
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <input className={field} placeholder={t('colCode')} value={code} onChange={(e) => setCode(e.target.value)} />
          <input className={field} placeholder={t('colName')} value={name} onChange={(e) => setName(e.target.value)} />
          <input className={`${field} w-20`} type="number" min="1" placeholder={t('gradeLevel')} value={level} onChange={(e) => setLevel(e.target.value)} />
          <Button size="sm" disabled={!code.trim() || !name.trim() || create.isPending} onClick={() => create.mutate()}>
            {t('create')}
          </Button>
        </div>
        {grades.length === 0 ? (
          <Empty text={t('noData')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('colCode')}</th>
                <th className={th}>{t('colName')}</th>
                <th className={th}>{t('gradeLevel')}</th>
                <th className={th}>{t('colStatus')}</th>
                <th className={th}>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={String(g.id)} className="border-t border-stroke-subtle">
                  <td className={td}>{String(g.code)}</td>
                  <td className={td}>{String(g.name)}</td>
                  <td className={`${td} tabular-nums`}>{String(g.level)}</td>
                  <td className={td}>
                    <Badge status={String(g.status)} />
                  </td>
                  <td className={td}>
                    {g.status === 'active' ? (
                      <button className={btnGhost} disabled={retire.isPending} onClick={() => retire.mutate(String(g.id))}>
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

      <Card title={t('gradeGrantTitle')}>
        <div className="mb-2 flex flex-wrap items-end gap-2">
          <select className={field} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">{t('pickEmployee')}</option>
            {employees.map((emp) => (
              <option key={String(emp.id)} value={String(emp.id)}>
                {String(emp.name ?? emp.id)}
              </option>
            ))}
          </select>
          <select className={field} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
            <option value="">{t('pickGrade')}</option>
            {grades
              .filter((g) => g.status === 'active')
              .map((g) => (
                <option key={String(g.id)} value={String(g.id)}>
                  {String(g.code)} {String(g.name)}
                </option>
              ))}
          </select>
          <input type="date" className={field} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          <select className={field} value={reason} onChange={(e) => setReason(e.target.value)}>
            {['hire', 'promotion', 'transfer', 'demotion', 'other'].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={!employeeId || !gradeId || grant.isPending} onClick={() => grant.mutate()}>
            <Share2 className="h-3.5 w-3.5" />
            {t('gradeGrantTitle')}
          </Button>
        </div>
      </Card>

      <Card title={t('gradeDistTitle')}>
        {dist.length === 0 ? (
          <Empty text={t('noData')} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {dist.map((d) => (
              <div key={String(d.gradeCode)} className="font-[weight:inherit] rounded-md border border-stroke-subtle px-3 py-1.5 text-label">
                <b>{d.gradeCode ? String(d.gradeCode) : '-'}</b>
                <span className="ml-1 tabular-nums text-muted-foreground">{String(d.count)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
