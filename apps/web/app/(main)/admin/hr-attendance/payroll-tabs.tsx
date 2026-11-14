// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 薪资 tab 组件集(2026-11-13 立,HR-5 端到端打通)。
 * 从 hr-attendance 主页面拆出,保持主页面 <600 行。
 * 三个面板:
 *   · MonthlyTab    月结生成 + 查询(前置:考勤数据已导入)
 *   · SalaryConfigTab 员工薪资 / 社保费率 / 个税扣除 配置入口
 *   · PayrollTab    一键算薪 + 工资单查看 + 状态推进
 */

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { BookOpen, Calculator, Download, Settings, Play } from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'
import { apiOrThrow as api, fetchRaw } from '@/lib/api'
import { PERM, RESOURCE as ATT_RESOURCE } from './helpers'

const HR_SETTLE = '/api/hr-settle'
const HR_PAYROLL = '/api/hr-payroll'
const HR_SAL_CFG = '/api/hr-salary-config'
const PAY_PERM = 'hr:payroll'

const inputCls =
  'rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

type TFunc = ReturnType<typeof useTranslations>

// ---------------------------------------------------------------------------
// 月结生成
// ---------------------------------------------------------------------------

interface MonthlyResult {
  periodMonth: string
  employees: number
  inserted: number
  updated: number
  skippedSigned: number
}

export function MonthlyTab({ t }: { t: TFunc }) {
  const qc = useQueryClient()
  const [month, setMonth] = React.useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [overwriteSigned, setOverwriteSigned] = React.useState(false)
  const [result, setResult] = React.useState<MonthlyResult | null>(null)

  const buildMut = useMutation({
    mutationFn: () =>
      api<MonthlyResult>(`${HR_SETTLE}/monthly`, {
        method: 'POST',
        body: JSON.stringify({ periodMonth: month, overwriteSigned }),
      }),
    onSuccess: (d) => {
      setResult(d as MonthlyResult)
      toast.success(t('monthlyBuilt'))
      qc.invalidateQueries({ queryKey: ['hr', 'monthly'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Play className="h-4 w-4 text-primary" />
        {t('tabMonthly')}
      </h2>
      <p className="text-body text-muted-foreground">{t('monthlyHint')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="font-[weight:inherit] text-body">
          {t('colMonth')}
          <input
            className={inputCls}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1 text-body">
          <input
            type="checkbox"
            checked={overwriteSigned}
            onChange={(e) => setOverwriteSigned(e.target.checked)}
          />
          {t('overwriteSigned')}
        </label>
        <HasPermi code={`${PERM}:manage`}>
          <Button size="sm" disabled={buildMut.isPending} onClick={() => buildMut.mutate()}>
            {t('generateMonthly')}
          </Button>
        </HasPermi>
      </div>
      {result && (
        <div className="rounded-lg border bg-muted/50 px-4 py-3 text-body">
          <div className="font-medium">{t('monthlyResult')}</div>
          <div className="font-[weight:inherit] mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-body">
            <span>{t('colPeriodMonth')}:</span>
            <span>{result.periodMonth}</span>
            <span>{t('colTotalEmployees')}:</span>
            <span>{result.employees}</span>
            <span>{t('colInserted')}:</span>
            <span>{result.inserted}</span>
            <span>{t('colUpdated')}:</span>
            <span>{result.updated}</span>
            <span>{t('colSkippedSigned')}:</span>
            <span>{result.skippedSigned}</span>
          </div>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 薪资配置
// ---------------------------------------------------------------------------

interface SalaryConfigRow {
  id: string
  employeeId: string
  baseSalary: string
  fixedAllowance: string
  otBase: string | null
  insuranceBase: string | null
  housingFundRate: string | null
  effectiveFrom: string
  effectiveTo: string | null
}

interface InsuranceRateRow {
  id: string
  regionName: string
  effectiveYear: number
  pensionPersonal: string | null
  medicalPersonal: string | null
  unemploymentPersonal: string | null
  housingFundRate: string | null
  enabled: boolean
}

export function SalaryConfigTab({ t }: { t: TFunc }) {
  const qc = useQueryClient()
  const [subTab, setSubTab] = React.useState<'emp' | 'ins' | 'tax'>('emp')

  // 员工列表(HR 选员工用,替代手填 UUID —— HR 不知道员工 UUID)
  const employeesQuery = useQuery({
    queryKey: ['hr', 'employees', 'forSalary'],
    queryFn: () =>
      api<{ list: Array<{ id: string; name: string; employeeNo: string }> }>(
        `${ATT_RESOURCE}/employees`,
      ),
  })
  const employeeOptions = employeesQuery.data?.list ?? []

  // ---- 员工薪资 ----
  const [empId, setEmpId] = React.useState('')
  const empQuery = useQuery({
    queryKey: ['hr', 'salaryCfg', empId],
    enabled: Boolean(empId),
    queryFn: () => api<{ rows: SalaryConfigRow[] }>(`${HR_SAL_CFG}/employees?employeeId=${empId}`),
  })

  const [empForm, setEmpForm] = React.useState({
    employeeId: '',
    baseSalary: '',
    fixedAllowance: '0',
    otBase: '',
    insuranceBase: '',
    housingFundRate: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
  })
  const addEmpMut = useMutation({
    mutationFn: () =>
      api(`${HR_SAL_CFG}/employees`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: empForm.employeeId,
          baseSalary: empForm.baseSalary,
          fixedAllowance: empForm.fixedAllowance || '0',
          otBase: empForm.otBase || undefined,
          insuranceBase: empForm.insuranceBase || undefined,
          housingFundRate: empForm.housingFundRate || undefined,
          effectiveFrom: empForm.effectiveFrom,
        }),
      }),
    onSuccess: () => {
      toast.success(t('salaryCfgSaved'))
      setEmpId(empForm.employeeId)
      qc.invalidateQueries({ queryKey: ['hr', 'salaryCfg'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ---- 社保费率 ----
  const insQuery = useQuery({
    queryKey: ['hr', 'insRates'],
    queryFn: () => api<{ rows: InsuranceRateRow[] }>(`${HR_SAL_CFG}/insurance`),
  })

  const [insForm, setInsForm] = React.useState({
    regionName: '',
    effectiveYear: new Date().getFullYear(),
    pensionPersonal: '',
    medicalPersonal: '',
    unemploymentPersonal: '',
    housingFundRate: '',
  })
  const addInsMut = useMutation({
    mutationFn: () =>
      api(`${HR_SAL_CFG}/insurance`, {
        method: 'POST',
        body: JSON.stringify({
          regionName: insForm.regionName,
          effectiveYear: Number(insForm.effectiveYear),
          pensionPersonal: insForm.pensionPersonal || undefined,
          medicalPersonal: insForm.medicalPersonal || undefined,
          unemploymentPersonal: insForm.unemploymentPersonal || undefined,
          housingFundRate: insForm.housingFundRate || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(t('insRateSaved'))
      qc.invalidateQueries({ queryKey: ['hr', 'insRates'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ---- 个税扣除 ----
  const [taxEmpId, setTaxEmpId] = React.useState('')
  const taxQuery = useQuery({
    queryKey: ['hr', 'taxProfile', taxEmpId],
    enabled: Boolean(taxEmpId),
    queryFn: () => api<Record<string, unknown> | null>(`${HR_SAL_CFG}/tax-profile/${taxEmpId}`),
  })
  const [taxForm, setTaxForm] = React.useState({
    employeeId: '',
    childrenCount: '0',
    infantCount: '0',
    isOnlyChild: true,
    housingType: 'none' as 'none' | 'rent' | 'loan',
    housingRentAmount: '',
    otherMonthlyDeduction: '0',
  })
  const saveTaxMut = useMutation({
    mutationFn: () =>
      api(`${HR_SAL_CFG}/tax-profile`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: taxForm.employeeId || taxEmpId,
          childrenCount: Number(taxForm.childrenCount) || 0,
          infantCount: Number(taxForm.infantCount) || 0,
          isOnlyChild: taxForm.isOnlyChild,
          housingType: taxForm.housingType,
          housingRentAmount: taxForm.housingRentAmount || undefined,
          otherMonthlyDeduction: taxForm.otherMonthlyDeduction || '0',
        }),
      }),
    onSuccess: () => {
      toast.success(t('taxProfileSaved'))
      setTaxEmpId(taxForm.employeeId)
      qc.invalidateQueries({ queryKey: ['hr', 'taxProfile'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // 保存成功或切换员工后,回填已有扣除信息
  React.useEffect(() => {
    const tp = taxQuery.data
    if (tp) {
      setTaxForm((f) => ({
        ...f,
        childrenCount: String(tp['childrenCount'] ?? f.childrenCount),
        infantCount: String(tp['infantCount'] ?? f.infantCount),
        isOnlyChild: Boolean(tp['isOnlyChild'] ?? f.isOnlyChild),
        housingType: (tp['housingType'] as 'none' | 'rent' | 'loan') ?? f.housingType,
        housingRentAmount: tp['housingRentAmount']
          ? String(tp['housingRentAmount'])
          : f.housingRentAmount,
        otherMonthlyDeduction: String(tp['otherMonthlyDeduction'] ?? f.otherMonthlyDeduction),
      }))
    }
  }, [taxQuery.data])

  const subTabs: Array<{ key: 'emp' | 'ins' | 'tax'; label: string; icon: React.ReactNode }> = [
    { key: 'emp', label: t('subTabEmpSalary'), icon: <Settings className="h-3 w-3" /> },
    { key: 'ins', label: t('subTabInsurance'), icon: <Settings className="h-3 w-3" /> },
    { key: 'tax', label: t('subTabTax'), icon: <Settings className="h-3 w-3" /> },
  ]

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Settings className="h-4 w-4 text-primary" />
        {t('tabSalaryConfig')}
      </h2>
      <div className="flex gap-1 border-b">
        {subTabs.map((st) => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            className={`px-2 py-1 text-body ${
              subTab === st.key
                ? 'border-b-2 border-primary font-medium text-primary'
                : 'text-muted-foreground'
            }`}
          >
            {st.icon}
            {st.label}
          </button>
        ))}
      </div>

      {subTab === 'emp' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="font-[weight:inherit] text-body">
              {t('colEmployee')}
              <select
                className={inputCls}
                value={empForm.employeeId}
                onChange={(e) => {
                  setEmpForm({ ...empForm, employeeId: e.target.value })
                  if (e.target.value) setEmpId(e.target.value)
                }}
              >
                <option value="">— {t('colSelectEmployee')} —</option>
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeNo} · {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colBaseSalary')}
              <input
                className={inputCls}
                value={empForm.baseSalary}
                onChange={(e) => setEmpForm({ ...empForm, baseSalary: e.target.value })}
                placeholder="8000.00"
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colFixedAllowance')}
              <input
                className={inputCls}
                value={empForm.fixedAllowance}
                onChange={(e) => setEmpForm({ ...empForm, fixedAllowance: e.target.value })}
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colOtBase')}
              <input
                className={inputCls}
                value={empForm.otBase}
                onChange={(e) => setEmpForm({ ...empForm, otBase: e.target.value })}
                placeholder={t('phOptional')}
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colInsuranceBase')}
              <input
                className={inputCls}
                value={empForm.insuranceBase}
                onChange={(e) => setEmpForm({ ...empForm, insuranceBase: e.target.value })}
                placeholder={t('phOptional')}
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colFundRate')}
              <input
                className={inputCls}
                value={empForm.housingFundRate}
                onChange={(e) => setEmpForm({ ...empForm, housingFundRate: e.target.value })}
                placeholder="0.12"
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colEffectiveFrom')}
              <input
                className={inputCls}
                type="date"
                value={empForm.effectiveFrom}
                onChange={(e) => setEmpForm({ ...empForm, effectiveFrom: e.target.value })}
              />
            </label>
            <HasPermi code={`${PAY_PERM}:manage`}>
              <Button
                size="sm"
                disabled={addEmpMut.isPending || !empForm.employeeId || !empForm.baseSalary}
                onClick={() => addEmpMut.mutate()}
              >
                {t('save')}
              </Button>
            </HasPermi>
          </div>
          {empId && <EmpSalaryList data={empQuery.data?.rows ?? []} t={t} />}
        </div>
      )}

      {subTab === 'ins' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="font-[weight:inherit] text-body">
              {t('colRegion')}
              <input
                className={inputCls}
                value={insForm.regionName}
                onChange={(e) => setInsForm({ ...insForm, regionName: e.target.value })}
                placeholder={t('phRegion')}
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colYear')}
              <input
                className={inputCls}
                type="number"
                value={insForm.effectiveYear}
                onChange={(e) => setInsForm({ ...insForm, effectiveYear: Number(e.target.value) })}
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colPensionPersonal')}
              <input
                className={inputCls}
                value={insForm.pensionPersonal}
                onChange={(e) => setInsForm({ ...insForm, pensionPersonal: e.target.value })}
                placeholder="0.08"
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colMedicalPersonal')}
              <input
                className={inputCls}
                value={insForm.medicalPersonal}
                onChange={(e) => setInsForm({ ...insForm, medicalPersonal: e.target.value })}
                placeholder="0.02"
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colUnemploymentPersonal')}
              <input
                className={inputCls}
                value={insForm.unemploymentPersonal}
                onChange={(e) => setInsForm({ ...insForm, unemploymentPersonal: e.target.value })}
                placeholder="0.005"
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colFundRate')}
              <input
                className={inputCls}
                value={insForm.housingFundRate}
                onChange={(e) => setInsForm({ ...insForm, housingFundRate: e.target.value })}
                placeholder="0.12"
              />
            </label>
            <HasPermi code={`${PAY_PERM}:manage`}>
              <Button
                size="sm"
                disabled={addInsMut.isPending || !insForm.regionName}
                onClick={() => addInsMut.mutate()}
              >
                {t('save')}
              </Button>
            </HasPermi>
          </div>
          <InsRateList
            data={insQuery.data?.rows ?? []}
            t={t}
            onEdit={(r) =>
              setInsForm({
                regionName: r.regionName,
                effectiveYear: r.effectiveYear,
                pensionPersonal: r.pensionPersonal ?? '',
                medicalPersonal: r.medicalPersonal ?? '',
                unemploymentPersonal: r.unemploymentPersonal ?? '',
                housingFundRate: r.housingFundRate ?? '',
              })
            }
          />
        </div>
      )}

      {subTab === 'tax' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="font-[weight:inherit] text-body">
              {t('colEmployee')}
              <select
                className={inputCls}
                value={taxForm.employeeId}
                onChange={(e) => {
                  setTaxForm({ ...taxForm, employeeId: e.target.value })
                  if (e.target.value) setTaxEmpId(e.target.value)
                }}
              >
                <option value="">— {t('colSelectEmployee')} —</option>
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeNo} · {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colChildrenCount')}
              <input
                className={inputCls}
                type="number"
                min="0"
                value={taxForm.childrenCount}
                onChange={(e) => setTaxForm({ ...taxForm, childrenCount: e.target.value })}
              />
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colInfantCount')}
              <input
                className={inputCls}
                type="number"
                min="0"
                value={taxForm.infantCount}
                onChange={(e) => setTaxForm({ ...taxForm, infantCount: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-1 text-body">
              <input
                type="checkbox"
                checked={taxForm.isOnlyChild}
                onChange={(e) => setTaxForm({ ...taxForm, isOnlyChild: e.target.checked })}
              />
              {t('colIsOnlyChild')}
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colHousingType')}
              <select
                className={inputCls}
                value={taxForm.housingType}
                onChange={(e) =>
                  setTaxForm({
                    ...taxForm,
                    housingType: e.target.value as 'none' | 'rent' | 'loan',
                  })
                }
              >
                <option value="none">{t('housingNone')}</option>
                <option value="rent">{t('housingRent')}</option>
                <option value="loan">{t('housingLoan')}</option>
              </select>
            </label>
            <label className="font-[weight:inherit] text-body">
              {t('colOtherDeduction')}
              <input
                className={inputCls}
                value={taxForm.otherMonthlyDeduction}
                onChange={(e) => setTaxForm({ ...taxForm, otherMonthlyDeduction: e.target.value })}
              />
            </label>
            <HasPermi code={`${PAY_PERM}:manage`}>
              <Button
                size="sm"
                disabled={saveTaxMut.isPending || (!taxForm.employeeId && !taxEmpId)}
                onClick={() => saveTaxMut.mutate()}
              >
                {t('save')}
              </Button>
            </HasPermi>
          </div>
        </div>
      )}
    </section>
  )
}

function EmpSalaryList({ data, t }: { data: SalaryConfigRow[]; t: TFunc }) {
  if (data.length === 0) return <p className="text-muted-foreground">{t('noData')}</p>
  return (
    <table className="font-[weight:inherit] w-full text-body">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="px-2 py-1">{t('colBaseSalary')}</th>
          <th className="px-2 py-1">{t('colFixedAllowance')}</th>
          <th className="px-2 py-1">{t('colOtBase')}</th>
          <th className="px-2 py-1">{t('colInsuranceBase')}</th>
          <th className="px-2 py-1">{t('colFundRate')}</th>
          <th className="px-2 py-1">{t('colEffectiveFrom')}</th>
          <th className="px-2 py-1">{t('colEffectiveTo')}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="px-2 py-1">{r.baseSalary}</td>
            <td className="px-2 py-1">{r.fixedAllowance}</td>
            <td className="px-2 py-1">{r.otBase ?? '-'}</td>
            <td className="px-2 py-1">{r.insuranceBase ?? '-'}</td>
            <td className="px-2 py-1">{r.housingFundRate ?? '-'}</td>
            <td className="px-2 py-1">{r.effectiveFrom}</td>
            <td className="px-2 py-1">{r.effectiveTo ?? t('openEnded')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function InsRateList({
  data,
  t,
  onEdit,
}: {
  data: InsuranceRateRow[]
  t: TFunc
  onEdit: (r: InsuranceRateRow) => void
}) {
  if (data.length === 0) return <p className="text-muted-foreground">{t('noData')}</p>
  return (
    <table className="font-[weight:inherit] w-full text-body">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="px-2 py-1">{t('colRegion')}</th>
          <th className="px-2 py-1">{t('colYear')}</th>
          <th className="px-2 py-1">{t('colPensionPersonal')}</th>
          <th className="px-2 py-1">{t('colMedicalPersonal')}</th>
          <th className="px-2 py-1">{t('colUnemploymentPersonal')}</th>
          <th className="px-2 py-1">{t('colFundRate')}</th>
          <th className="px-2 py-1">{t('colEnabled')}</th>
          <th className="px-2 py-1">{t('colActions')}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="px-2 py-1">{r.regionName}</td>
            <td className="px-2 py-1">{r.effectiveYear}</td>
            <td className="px-2 py-1">{r.pensionPersonal ?? '-'}</td>
            <td className="px-2 py-1">{r.medicalPersonal ?? '-'}</td>
            <td className="px-2 py-1">{r.unemploymentPersonal ?? '-'}</td>
            <td className="px-2 py-1">{r.housingFundRate ?? '-'}</td>
            <td className="px-2 py-1">{r.enabled ? '✓' : '✗'}</td>
            <td className="px-2 py-1">
              <button className="text-primary hover:underline" onClick={() => onEdit(r)}>
                {t('edit')}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------------------
// 工资单
// ---------------------------------------------------------------------------

interface PayrollPeriod {
  id: string
  periodMonth: string
  status: string
}

interface PayrollItem {
  employeeName: string | null
  employeeNo: string | null
  baseSalary: string
  otAmount: string
  allowance: string
  attendanceDeduction: string
  grossPay: string
  insurancePersonal: string
  housingFundPersonal: string
  incomeTax: string
  netPay: string
  breakdown: {
    steps?: Record<string, number>
    warnings?: string[]
  } | null
}

export function PayrollTab({ t }: { t: TFunc }) {
  const qc = useQueryClient()
  const [month, setMonth] = React.useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [regionName, setRegionName] = React.useState('')
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  // 周期列表
  const periodsQuery = useQuery({
    queryKey: ['hr', 'payrollPeriods'],
    queryFn: () => api<PayrollPeriod[]>(`${HR_PAYROLL}/periods`),
  })

  // 工资单
  const itemsQuery = useQuery({
    queryKey: ['hr', 'payrollItems', month],
    enabled: Boolean(month),
    queryFn: () =>
      api<{ count: number; totalGross: number; totalNet: number; rows: PayrollItem[] }>(
        `${HR_PAYROLL}/items?periodMonth=${month}`,
      ),
  })

  const calcMut = useMutation({
    mutationFn: () =>
      api(`${HR_PAYROLL}/calculate`, {
        method: 'POST',
        body: JSON.stringify({
          periodMonth: month,
          regionName: regionName || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(t('payrollCalculated'))
      qc.invalidateQueries({ queryKey: ['hr', 'payrollItems', month] })
      qc.invalidateQueries({ queryKey: ['hr', 'payrollPeriods'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const statusMut = useMutation({
    mutationFn: (nextStatus: string) =>
      api(`${HR_PAYROLL}/status`, {
        method: 'POST',
        body: JSON.stringify({ periodMonth: month, status: nextStatus }),
      }),
    onSuccess: () => {
      toast.success(t('statusUpdated'))
      qc.invalidateQueries({ queryKey: ['hr', 'payrollPeriods'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // 财务交割:生成某月薪资的财务凭证(算薪→记账联动,纯产出不入账)
  const [handoff, setHandoff] = React.useState<{
    balanced: boolean
    headcount: number
    entries: Array<{ group: string; account: string; direction: string; amount: string }>
    totals: Record<string, string>
  } | null>(null)
  const handoffMut = useMutation({
    mutationFn: () =>
      api<{
        balanced: boolean
        headcount: number
        entries: Array<{ group: string; account: string; direction: string; amount: string }>
        totals: Record<string, string>
      }>(`${HR_PAYROLL}/handoff`, { method: 'POST', body: JSON.stringify({ periodMonth: month }) }),
    onSuccess: (v) => {
      setHandoff(v)
      if (v.balanced) {
        toast.success(t('handoffGenerated'))
      } else {
        toast.error(t('handoffUnbalanced'))
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // 交割凭证单导出(Excel):fetchRaw 拿 Blob(自动带鉴权),ObjectURL 触发下载
  const [exporting, setExporting] = React.useState(false)
  const exportHandoff = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await fetchRaw(`${HR_PAYROLL}/handoff/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodMonth: month }),
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payroll-handoff-${month}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('handoffExportFailed'))
    } finally {
      setExporting(false)
    }
  }

  const items = itemsQuery.data?.rows ?? []
  const totalGross = itemsQuery.data?.totalGross ?? 0
  const totalNet = itemsQuery.data?.totalNet ?? 0

  // 当月周期状态:驱动按钮守卫,避免无效点击撞后端 409/409 锁定
  const currentPeriod = (periodsQuery.data ?? []).find((p) => p.periodMonth === month)
  const status = currentPeriod?.status
  // draft/calculated 可算;approved 除非 overwriteApproved 否则拒绝;paid 完全锁定
  const canCalc = status !== 'paid' && status !== 'approved'
  // 只能从 calculated → approved(未算过先审批没意义;已 approved/paid 不可重复)
  const canApprove = status === 'calculated'
  // 只能 approved → paid(跳过审批直接发钱要拦住)
  const canMarkPaid = status === 'approved'
  // 交割点 = approved(财务已审账);paid 完全锁定但凭证仍可查(只读)
  const canHandoff = status === 'approved' || status === 'paid'

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Calculator className="h-4 w-4 text-primary" />
        {t('tabPayroll')}
      </h2>

      {/* 操作栏 */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="font-[weight:inherit] text-body">
          {t('colMonth')}
          <input
            className={inputCls}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label className="font-[weight:inherit] text-body">
          {t('colRegion')}
          <input
            className={inputCls}
            value={regionName}
            onChange={(e) => setRegionName(e.target.value)}
            placeholder={t('phRegionOptional')}
          />
        </label>
        <HasPermi code={`${PAY_PERM}:manage`}>
          <Button
            size="sm"
            disabled={!canCalc || calcMut.isPending}
            onClick={() => calcMut.mutate()}
          >
            <Calculator className="mr-1 h-3 w-3" />
            {t('calculatePayroll')}
          </Button>
        </HasPermi>
        <HasPermi code={`${PAY_PERM}:manage`}>
          <Button
            size="sm"
            variant="outline"
            disabled={!canApprove || statusMut.isPending}
            onClick={() => statusMut.mutate('approved')}
          >
            {t('approvePayroll')}
          </Button>
        </HasPermi>
        <HasPermi code={`${PAY_PERM}:manage`}>
          <Button
            size="sm"
            variant="outline"
            disabled={!canMarkPaid || statusMut.isPending}
            onClick={() => statusMut.mutate('paid')}
          >
            {t('markPaid')}
          </Button>
        </HasPermi>
        <HasPermi code={`${PAY_PERM}:manage`}>
          <Button
            size="sm"
            variant="outline"
            disabled={!canHandoff || handoffMut.isPending}
            onClick={() => handoffMut.mutate()}
          >
            <BookOpen className="mr-1 h-3 w-3" />
            {t('generateHandoff')}
          </Button>
        </HasPermi>
        {status && (
          <span
            className={`font-[weight:inherit] ml-2 rounded-full px-2 py-0.5 text-label ${
              status === 'paid'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : status === 'approved'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {status}
          </span>
        )}
      </div>

      {/* 财务交割凭证(算薪→记账联动,纯产出不入账) */}
      {handoff && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-body">
          <div className="flex items-center gap-2 text-body font-semibold">
            <BookOpen className="h-4 w-4 text-primary" />
            {t('handoffTitle', { month })}
            <span
              className={`font-[weight:inherit] rounded-full px-2 py-0.5 text-label ${
                handoff.balanced
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {handoff.balanced ? t('handoffBalanced') : t('handoffUnbalanced')}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              disabled={exporting}
              onClick={exportHandoff}
            >
              <Download className="mr-1 h-3 w-3" />
              {exporting ? t('handoffExporting') : t('handoffExportExcel')}
            </Button>
          </div>
          <p className="font-[weight:inherit] text-label text-muted-foreground">
            {t('handoffHeadcount', { count: handoff.headcount })} · {t('handoffDisclaimer')}
          </p>
          <table className="font-[weight:inherit] w-full text-body">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1">{t('handoffGroup')}</th>
                <th className="px-2 py-1">{t('handoffAccount')}</th>
                <th className="px-2 py-1">{t('handoffDirection')}</th>
                <th className="px-2 py-1 text-right">{t('handoffAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {handoff.entries.map((e, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{e.group}</td>
                  <td className="px-2 py-1">{e.account}</td>
                  <td className="px-2 py-1">{e.direction}</td>
                  <td className="px-2 py-1 text-right font-medium">{e.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="font-[weight:inherit] flex gap-4 border-t pt-2 text-label text-muted-foreground">
            <span>
              {t('colTotalGross')}: ¥{handoff.totals.grossPay}
            </span>
            <span>
              {t('colTotalNet')}: ¥{handoff.totals.netPay}
            </span>
            <span>
              {t('colInsurance')}: ¥{handoff.totals.insurancePersonal}
            </span>
            <span>
              {t('colFund')}: ¥{handoff.totals.housingFundPersonal}
            </span>
            <span>
              {t('colIncomeTax')}: ¥{handoff.totals.incomeTax}
            </span>
          </div>
        </div>
      )}

      {/* 汇总 */}
      {items.length > 0 && (
        <div className="flex gap-4 rounded-lg border bg-muted/50 px-4 py-2 text-body">
          <span>
            {t('colCount')}: <strong>{items.length}</strong>
          </span>
          <span>
            {t('colTotalGross')}: <strong className="text-primary">¥{totalGross.toFixed(2)}</strong>
          </span>
          <span>
            {t('colTotalNet')}: <strong className="text-primary">¥{totalNet.toFixed(2)}</strong>
          </span>
        </div>
      )}

      {/* 工资单表格 */}
      {itemsQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">{t('noPayrollHint')}</p>
      ) : (
        <table className="font-[weight:inherit] w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colEmployeeNo')}</th>
              <th className="px-2 py-1">{t('colName')}</th>
              <th className="px-2 py-1">{t('colBaseSalary')}</th>
              <th className="px-2 py-1">{t('colOtAmount')}</th>
              <th className="px-2 py-1">{t('colGrossPay')}</th>
              <th className="px-2 py-1">{t('colInsurance')}</th>
              <th className="px-2 py-1">{t('colFund')}</th>
              <th className="px-2 py-1">{t('colIncomeTax')}</th>
              <th className="px-2 py-1">{t('colNetPay')}</th>
              <th className="px-2 py-1">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => {
              const key = `${r.employeeNo ?? r.employeeName ?? i}`
              return (
                <React.Fragment key={key}>
                  <tr className="border-t">
                    <td className="px-2 py-1">{r.employeeNo ?? '-'}</td>
                    <td className="px-2 py-1">{r.employeeName ?? '-'}</td>
                    <td className="px-2 py-1">{r.baseSalary}</td>
                    <td className="px-2 py-1">{r.otAmount}</td>
                    <td className="px-2 py-1 font-medium">{r.grossPay}</td>
                    <td className="px-2 py-1">{r.insurancePersonal}</td>
                    <td className="px-2 py-1">{r.housingFundPersonal}</td>
                    <td className="px-2 py-1">{r.incomeTax}</td>
                    <td className="px-2 py-1 font-medium text-primary">{r.netPay}</td>
                    <td className="px-2 py-1">
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setExpandedId(expandedId === key ? null : key)}
                      >
                        {expandedId === key ? t('hideDetail') : t('showDetail')}
                      </button>
                    </td>
                  </tr>
                  {expandedId === key && r.breakdown && (
                    <tr>
                      <td colSpan={10} className="border-t bg-muted/30 px-4 py-2">
                        <BreakdownDetail breakdown={r.breakdown} t={t} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      )}

      {/* 周期列表 */}
      {(periodsQuery.data?.length ?? 0) > 0 && (
        <div className="space-y-1">
          <h3 className="text-body font-medium text-muted-foreground">{t('payrollPeriods')}</h3>
          <div className="flex flex-wrap gap-2">
            {(periodsQuery.data ?? []).map((p) => (
              <span
                key={p.id}
                className={`font-[weight:inherit] rounded-full px-2 py-0.5 text-label ${
                  p.status === 'paid'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : p.status === 'approved'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {p.periodMonth} · {p.status}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function BreakdownDetail({ breakdown, t }: { breakdown: PayrollItem['breakdown']; t: TFunc }) {
  const steps = breakdown?.steps
  if (!steps) return null
  const stepLabels: Array<[string, string]> = [
    ['dailyRate', 'colDailyRate'],
    ['basePay', 'colBasePay'],
    ['otAmount', 'colOtAmount'],
    ['absenceDeduction', 'colAbsenceDeduction'],
    ['grossPay', 'colGrossPay'],
    ['insurancePersonal', 'colInsurance'],
    ['housingFundPersonal', 'colFund'],
    ['specialDeduction', 'colSpecialDeduction'],
    ['taxableIncome', 'colTaxableIncome'],
    ['incomeTax', 'colIncomeTax'],
    ['netPay', 'colNetPay'],
  ]
  return (
    <div className="space-y-1">
      <div className="text-label font-medium text-muted-foreground">{t('breakdownTitle')}</div>
      <div className="font-[weight:inherit] grid grid-cols-2 gap-x-6 gap-y-0.5 text-label md:grid-cols-4">
        {stepLabels.map(([k, labelKey]) => (
          <div key={k} className="flex justify-between">
            <span className="text-muted-foreground">{t(labelKey as 'colNetPay')}:</span>
            <span className="font-mono">
              {typeof steps[k] === 'number' ? (steps[k] as number).toFixed(2) : '-'}
            </span>
          </div>
        ))}
      </div>
      {breakdown?.warnings && breakdown.warnings.length > 0 && (
        <div className="font-[weight:inherit] mt-1 space-y-0.5 text-label text-destructive">
          {breakdown.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
