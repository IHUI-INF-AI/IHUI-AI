// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Calculator, CheckCircle2, Coins, Wallet } from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { RESOURCE, PERM, api } from './helpers'
import type { HrEmployee, ListData } from './types'

/**
 * 月结 / 薪资配置 / 工资单三个 tab。
 *
 * 后端真相:
 *   · 月结     —— /api/hr-settle/monthly(GET 查结果、POST 生成)
 *   · 工资单   —— /api/hr-payroll/{items,calculate,status,periods}
 *   · 薪资配置 —— /api/hr-payroll/{configs,config/:employeeId,tax-profile/:employeeId,
 *                 insurance-rates}:薪资历史版本、个税专项附加扣除、地区社保费率。
 */

/** 结算前缀(与 apps/api/src/routes/index.ts 的 register prefix 一致)。 */
const SETTLE_RESOURCE = '/api/hr-settle'
/** 薪资前缀。 */
const PAYROLL_RESOURCE = '/api/hr-payroll'

/** 月结写面与考勤建档同档:hr:attendance:manage。 */
const MANAGE_PERM = `${PERM}:manage`
/** 薪资单独一档(后端 HR_PAYROLL)。 */
const PAYROLL_PERM = 'hr:payroll:manage'

const inputCls =
  'rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

const MONTH_RE = /^\d{4}-\d{2}$/

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtMoney(value: string | number | null | undefined): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

// =============================================================================
// 接口返回体(按 apps/api/src/routes 与 services 的返回结构声明)
// =============================================================================

interface MonthlyRow {
  id: string
  employeeId: string
  employeeNo: string | null
  employeeName: string | null
  scheduledDays: string
  actualDays: string
  lateCount: number
  earlyCount: number
  absentDays: string
  leaveDays: Record<string, number> | null
  otHours: string
  otDetail: { weekday?: number; weekend?: number; holiday?: number } | null
  signed: boolean
}

interface MonthlyBuildResult {
  periodMonth: string
  employees: number
  inserted: number
  updated: number
  skippedSigned: number
}

interface PayrollBreakdown {
  inputs?: {
    baseSalary?: number
    fixedAllowance?: number
    otBase?: number
    insuranceBase?: number
    housingFundRate?: number
    scheduledDays?: number
    actualDays?: number
    absentDays?: number
    otHours?: number
    otDetail?: { weekday?: number; weekend?: number; holiday?: number }
  }
  steps?: {
    dailyRate?: number
    basePay?: number
    otAmount?: number
    absenceDeduction?: number
    grossPay?: number
    insurancePersonal?: number
    housingFundPersonal?: number
    specialDeduction?: number
    taxableIncome?: number
    incomeTax?: number
    netPay?: number
  }
  rates?: {
    region: string
    year: number
    pensionPersonal: number
    medicalPersonal: number
    unemploymentPersonal: number
    housingFundRate: number
  } | null
  warnings?: string[]
}

interface PayrollRow {
  employeeNo: string | null
  employeeName: string | null
  baseSalary: string
  otAmount: string
  allowance: string
  attendanceDeduction: string
  grossPay: string
  insurancePersonal: string
  housingFundPersonal: string
  incomeTax: string
  netPay: string
  breakdown: PayrollBreakdown | null
}

interface PayrollItemsResult {
  periodMonth: string
  count: number
  totalGross: number
  totalNet: number
  rows: PayrollRow[]
}

interface PayrollBuildResult {
  periodMonth: string
  periodId: string
  employees: number
  inserted: number
  updated: number
  skippedNoConfig: number
  skippedSigned: number
  totalGross: number
  totalNet: number
}

interface PayrollPeriod {
  id: string
  periodMonth: string
  status: string
  updatedAt?: string | null
}

const PERIOD_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  calculated: '已计算',
  approved: '已审批',
  paid: '已发放',
}

const PAYROLL_STEPS: Array<{
  key: keyof NonNullable<PayrollBreakdown['steps']>
  label: string
}> = [
  { key: 'dailyRate', label: '日薪' },
  { key: 'basePay', label: '出勤工资' },
  { key: 'otAmount', label: '加班费' },
  { key: 'absenceDeduction', label: '缺勤折算(审计值)' },
  { key: 'grossPay', label: '应发' },
  { key: 'insurancePersonal', label: '社保(个人)' },
  { key: 'housingFundPersonal', label: '公积金(个人)' },
  { key: 'specialDeduction', label: '专项附加扣除' },
  { key: 'taxableIncome', label: '计税所得' },
  { key: 'incomeTax', label: '个税' },
  { key: 'netPay', label: '实发' },
]

// =============================================================================
// 公共小组件
// =============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Badge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'muted'
  children: React.ReactNode
}) {
  const cls =
    tone === 'ok'
      ? 'bg-success/10 text-success'
      : tone === 'danger'
        ? 'bg-destructive/10 text-destructive'
        : tone === 'warn'
          ? 'bg-warning/10 text-warning'
          : 'bg-muted text-muted-foreground'
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-label font-medium ${cls}`}>
      {children}
    </span>
  )
}

// =============================================================================
// 月结生成
// =============================================================================

export function MonthlyTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient()
  const [periodMonth, setPeriodMonth] = React.useState(currentMonth)
  const [overwriteSigned, setOverwriteSigned] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<MonthlyBuildResult | null>(null)

  const monthlyQuery = useQuery({
    queryKey: ['hr', 'monthly', periodMonth],
    enabled: MONTH_RE.test(periodMonth),
    queryFn: () =>
      api<{ periodMonth: string; rows: MonthlyRow[] }>(
        `${SETTLE_RESOURCE}/monthly?periodMonth=${periodMonth}`,
      ),
  })

  const buildMut = useMutation({
    mutationFn: () =>
      api<MonthlyBuildResult>(`${SETTLE_RESOURCE}/monthly`, {
        method: 'POST',
        body: JSON.stringify({ periodMonth, overwriteSigned }),
      }),
    onSuccess: (d) => {
      setLastResult(d)
      toast.success(
        `${t('monthlyBuilt')}:${d.employees} 人,新增 ${d.inserted},更新 ${d.updated},跳过已签字 ${d.skippedSigned}`,
      )
      qc.invalidateQueries({ queryKey: ['hr', 'monthly', periodMonth] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = monthlyQuery.data?.rows ?? []
  const monthValid = MONTH_RE.test(periodMonth)

  return (
    <Section title={t('tabMonthly')}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="font-[weight:inherit] text-body">
          {t('colMonth')}
          <input
            className={inputCls}
            type="month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
          />
        </label>
        <label className="font-[weight:inherit] flex items-center gap-1 text-body">
          <input
            type="checkbox"
            checked={overwriteSigned}
            onChange={(e) => setOverwriteSigned(e.target.checked)}
          />
          {t('overwriteSigned')}
        </label>
        <HasPermi code={MANAGE_PERM}>
          <Button
            size="sm"
            disabled={!monthValid || buildMut.isPending}
            onClick={() => buildMut.mutate()}
          >
            <Calculator className="h-4 w-4" />
            {t('generateMonthly')}
          </Button>
        </HasPermi>
      </div>
      <p className="text-label text-muted-foreground">{t('monthlyHint')}</p>

      {lastResult && (
        <div className="rounded-lg border px-3 py-2 text-body">
          <p className="font-medium">
            {t('monthlyResult')} · {lastResult.periodMonth}
          </p>
          <p className="text-muted-foreground">
            {t('colTotalEmployees')}: {lastResult.employees} · {t('colProcessed')}: 新增{' '}
            {lastResult.inserted} / 更新 {lastResult.updated} · {t('colSkippedSigned')}:{' '}
            {lastResult.skippedSigned}
          </p>
        </div>
      )}

      {!monthValid ? (
        <p className="text-muted-foreground">请输入 YYYY-MM 格式的月份</p>
      ) : monthlyQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : monthlyQuery.isError ? (
        <p className="text-destructive">{monthlyQuery.error?.message ?? '加载月结失败'}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="font-[weight:inherit] w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colEmployeeNo')}</th>
              <th className="px-2 py-1">{t('colName')}</th>
              <th className="px-2 py-1">应出勤</th>
              <th className="px-2 py-1">实出勤</th>
              <th className="px-2 py-1">迟到</th>
              <th className="px-2 py-1">早退</th>
              <th className="px-2 py-1">缺勤</th>
              <th className="px-2 py-1">请假(天)</th>
              <th className="px-2 py-1">加班(小时)</th>
              <th className="px-2 py-1">已签字</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const leaveTotal = Object.values(r.leaveDays ?? {}).reduce((s, v) => s + Number(v), 0)
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-1">{r.employeeNo ?? '-'}</td>
                  <td className="px-2 py-1">{r.employeeName ?? '-'}</td>
                  <td className="px-2 py-1">{r.scheduledDays}</td>
                  <td className="px-2 py-1">{r.actualDays}</td>
                  <td className="px-2 py-1">{r.lateCount}</td>
                  <td className="px-2 py-1">{r.earlyCount}</td>
                  <td className="px-2 py-1">{r.absentDays}</td>
                  <td className="px-2 py-1">{leaveTotal}</td>
                  <td className="px-2 py-1">{r.otHours}</td>
                  <td className="px-2 py-1">
                    {r.signed ? (
                      <Badge tone="ok">已签字</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Section>
  )
}

// =============================================================================
// 薪资配置
// =============================================================================

interface SalaryConfigDto {
  id: string
  employeeId: string
  baseSalary: string
  otBase: string | null
  insuranceBase: string | null
  housingFundRate: string | null
  fixedAllowance: string
  effectiveFrom: string
  effectiveTo: string | null
}

interface TaxProfileDto {
  employeeId: string
  childrenCount: number
  childrenDeductionRatio: string
  infantCount: number
  isOnlyChild: boolean
  elderlySupportShare: string | null
  housingType: string
  housingRentAmount: string | null
  otherMonthlyDeduction: string
}

interface InsuranceRateDto {
  id: string
  regionName: string
  effectiveYear: number
  pensionEmployer: string | null
  pensionPersonal: string | null
  unemploymentEmployer: string | null
  unemploymentPersonal: string | null
  medicalEmployer: string | null
  medicalPersonal: string | null
  injuryEmployer: string | null
  housingFundRate: string | null
  insuranceBaseMin: string | null
  insuranceBaseMax: string | null
  fundBaseMin: string | null
  fundBaseMax: string | null
  enabled: boolean
}

interface SalaryFormState {
  baseSalary: string
  fixedAllowance: string
  otBase: string
  insuranceBase: string
  housingFundRate: string
  effectiveFrom: string
  effectiveTo: string
}

interface TaxFormState {
  childrenCount: string
  childrenDeductionRatio: string
  infantCount: string
  isOnlyChild: boolean
  elderlySupportShare: string
  housingType: string
  housingRentAmount: string
  otherMonthlyDeduction: string
}

interface RateFormState {
  regionName: string
  effectiveYear: string
  pensionEmployer: string
  pensionPersonal: string
  unemploymentEmployer: string
  unemploymentPersonal: string
  medicalEmployer: string
  medicalPersonal: string
  injuryEmployer: string
  housingFundRate: string
  insuranceBaseMin: string
  insuranceBaseMax: string
  fundBaseMin: string
  fundBaseMax: string
  enabled: boolean
}

function todayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 输入框文本 → 数字;空串/非法返回 undefined(由后端校验必填)。 */
function numOrUndefined(value: string): number | undefined {
  const s = value.trim()
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** numeric 列(字符串)→ 输入框文本。 */
function fieldText(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function emptyRateForm(): RateFormState {
  return {
    regionName: '',
    effectiveYear: String(new Date().getFullYear()),
    pensionEmployer: '',
    pensionPersonal: '',
    unemploymentEmployer: '',
    unemploymentPersonal: '',
    medicalEmployer: '',
    medicalPersonal: '',
    injuryEmployer: '',
    housingFundRate: '',
    insuranceBaseMin: '',
    insuranceBaseMax: '',
    fundBaseMin: '',
    fundBaseMax: '',
    enabled: true,
  }
}

export function SalaryConfigTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient()
  const employeesQuery = useQuery({
    queryKey: ['hr', 'employees', 'salary-config'],
    queryFn: () => api<ListData<HrEmployee>>(`${RESOURCE}/employees`),
  })
  const configsQuery = useQuery({
    queryKey: ['hr', 'payroll', 'configs'],
    queryFn: () =>
      api<{ list: SalaryConfigDto[]; taxProfiles: TaxProfileDto[] }>(
        `${PAYROLL_RESOURCE}/configs`,
      ),
  })
  const ratesQuery = useQuery({
    queryKey: ['hr', 'payroll', 'insurance-rates'],
    queryFn: () =>
      api<{ list: InsuranceRateDto[] }>(`${PAYROLL_RESOURCE}/insurance-rates`),
  })

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [salaryForm, setSalaryForm] = React.useState<SalaryFormState>({
    baseSalary: '',
    fixedAllowance: '0',
    otBase: '',
    insuranceBase: '',
    housingFundRate: '',
    effectiveFrom: todayDate(),
    effectiveTo: '',
  })
  const [taxForm, setTaxForm] = React.useState<TaxFormState>({
    childrenCount: '0',
    childrenDeductionRatio: '1',
    infantCount: '0',
    isOnlyChild: true,
    elderlySupportShare: '',
    housingType: 'none',
    housingRentAmount: '',
    otherMonthlyDeduction: '0',
  })
  const [rateEditing, setRateEditing] = React.useState(false)
  const [rateForm, setRateForm] = React.useState<RateFormState>(emptyRateForm)

  const list = employeesQuery.data?.list ?? []
  const configList = configsQuery.data?.list ?? []
  const taxList = configsQuery.data?.taxProfiles ?? []
  const rateList = ratesQuery.data?.list ?? []

  const configByEmployee = React.useMemo(
    () => new Map(configList.map((c) => [c.employeeId, c])),
    [configList],
  )
  const taxByEmployee = React.useMemo(
    () => new Map(taxList.map((p) => [p.employeeId, p])),
    [taxList],
  )

  const refreshConfigs = () => qc.invalidateQueries({ queryKey: ['hr', 'payroll', 'configs'] })

  const startEdit = (employeeId: string) => {
    const cfg = configByEmployee.get(employeeId)
    const tax = taxByEmployee.get(employeeId)
    setEditingId(employeeId)
    setSalaryForm({
      baseSalary: fieldText(cfg?.baseSalary),
      fixedAllowance: fieldText(cfg?.fixedAllowance ?? '0'),
      otBase: fieldText(cfg?.otBase),
      insuranceBase: fieldText(cfg?.insuranceBase),
      housingFundRate: fieldText(cfg?.housingFundRate),
      effectiveFrom: cfg?.effectiveFrom ?? todayDate(),
      effectiveTo: cfg?.effectiveTo ?? '',
    })
    setTaxForm({
      childrenCount: String(tax?.childrenCount ?? 0),
      childrenDeductionRatio: fieldText(tax?.childrenDeductionRatio ?? '1'),
      infantCount: String(tax?.infantCount ?? 0),
      isOnlyChild: tax?.isOnlyChild ?? true,
      elderlySupportShare: fieldText(tax?.elderlySupportShare),
      housingType: tax?.housingType ?? 'none',
      housingRentAmount: fieldText(tax?.housingRentAmount),
      otherMonthlyDeduction: fieldText(tax?.otherMonthlyDeduction ?? '0'),
    })
  }

  const salaryMut = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error('请先选择员工')
      const baseSalary = numOrUndefined(salaryForm.baseSalary)
      if (baseSalary === undefined) throw new Error('底薪必填,且必须是数字')
      return api(`${PAYROLL_RESOURCE}/config/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          baseSalary,
          fixedAllowance: numOrUndefined(salaryForm.fixedAllowance) ?? 0,
          otBase: numOrUndefined(salaryForm.otBase) ?? null,
          insuranceBase: numOrUndefined(salaryForm.insuranceBase) ?? null,
          housingFundRate: numOrUndefined(salaryForm.housingFundRate) ?? null,
          effectiveFrom: salaryForm.effectiveFrom,
          effectiveTo: salaryForm.effectiveTo.trim() || null,
        }),
      })
    },
    onSuccess: () => {
      toast.success('薪资配置已保存')
      refreshConfigs()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const taxMut = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error('请先选择员工')
      return api(`${PAYROLL_RESOURCE}/tax-profile/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          childrenCount: numOrUndefined(taxForm.childrenCount) ?? 0,
          childrenDeductionRatio: numOrUndefined(taxForm.childrenDeductionRatio) ?? 1,
          infantCount: numOrUndefined(taxForm.infantCount) ?? 0,
          isOnlyChild: taxForm.isOnlyChild,
          elderlySupportShare: numOrUndefined(taxForm.elderlySupportShare) ?? null,
          housingType: taxForm.housingType,
          housingRentAmount: numOrUndefined(taxForm.housingRentAmount) ?? null,
          otherMonthlyDeduction: numOrUndefined(taxForm.otherMonthlyDeduction) ?? 0,
        }),
      })
    },
    onSuccess: () => {
      toast.success('个税专项附加扣除已保存')
      refreshConfigs()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rateMut = useMutation({
    mutationFn: () => {
      if (!rateForm.regionName.trim()) throw new Error('地区名必填')
      const effectiveYear = numOrUndefined(rateForm.effectiveYear)
      if (effectiveYear === undefined) throw new Error('年度必填')
      return api(`${PAYROLL_RESOURCE}/insurance-rates`, {
        method: 'PUT',
        body: JSON.stringify({
          regionName: rateForm.regionName.trim(),
          effectiveYear,
          pensionEmployer: numOrUndefined(rateForm.pensionEmployer) ?? null,
          pensionPersonal: numOrUndefined(rateForm.pensionPersonal) ?? null,
          unemploymentEmployer: numOrUndefined(rateForm.unemploymentEmployer) ?? null,
          unemploymentPersonal: numOrUndefined(rateForm.unemploymentPersonal) ?? null,
          medicalEmployer: numOrUndefined(rateForm.medicalEmployer) ?? null,
          medicalPersonal: numOrUndefined(rateForm.medicalPersonal) ?? null,
          injuryEmployer: numOrUndefined(rateForm.injuryEmployer) ?? null,
          housingFundRate: numOrUndefined(rateForm.housingFundRate) ?? null,
          insuranceBaseMin: numOrUndefined(rateForm.insuranceBaseMin) ?? null,
          insuranceBaseMax: numOrUndefined(rateForm.insuranceBaseMax) ?? null,
          fundBaseMin: numOrUndefined(rateForm.fundBaseMin) ?? null,
          fundBaseMax: numOrUndefined(rateForm.fundBaseMax) ?? null,
          enabled: rateForm.enabled,
        }),
      })
    },
    onSuccess: () => {
      toast.success('社保费率已保存')
      setRateEditing(false)
      qc.invalidateQueries({ queryKey: ['hr', 'payroll', 'insurance-rates'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const editingEmployee = list.find((e) => e.id === editingId)

  return (
    <Section title={t('tabSalaryConfig')}>
      <p className="text-label text-muted-foreground">
        薪资配置按生效日保留历史版本:调薪时新增一条新生效日的记录,算薪自动取最近一条。
        社保/公积金费率按(地区, 年度)唯一,个税专项附加扣除按员工唯一。
      </p>

      {employeesQuery.isLoading || configsQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : employeesQuery.isError ? (
        <p className="text-destructive">{employeesQuery.error?.message ?? '加载员工列表失败'}</p>
      ) : configsQuery.isError ? (
        <p className="text-destructive">{configsQuery.error?.message ?? '加载薪资配置失败'}</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="font-[weight:inherit] w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colEmployeeNo')}</th>
              <th className="px-2 py-1">{t('colName')}</th>
              <th className="px-2 py-1">底薪</th>
              <th className="px-2 py-1">固定津贴</th>
              <th className="px-2 py-1">公积金比例</th>
              <th className="px-2 py-1">生效日</th>
              <th className="px-2 py-1">个税扣除</th>
              <th className="px-2 py-1">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => {
              const cfg = configByEmployee.get(e.id)
              const hasTax = taxByEmployee.has(e.id)
              return (
                <tr key={e.id} className="border-t">
                  <td className="px-2 py-1">{e.employeeNo}</td>
                  <td className="px-2 py-1">{e.name}</td>
                  <td className="px-2 py-1">
                    {cfg ? fmtMoney(cfg.baseSalary) : <span className="text-warning">未配置</span>}
                  </td>
                  <td className="px-2 py-1">{cfg ? fmtMoney(cfg.fixedAllowance) : '-'}</td>
                  <td className="px-2 py-1">
                    {cfg?.housingFundRate ? fmtPercent(Number(cfg.housingFundRate)) : '-'}
                  </td>
                  <td className="px-2 py-1">{cfg?.effectiveFrom ?? '-'}</td>
                  <td className="px-2 py-1">
                    {hasTax ? <Badge tone="ok">已填报</Badge> : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-2 py-1">
                    <HasPermi code={PAYROLL_PERM}>
                      <button className="text-primary hover:underline" onClick={() => startEdit(e.id)}>
                        编辑
                      </button>
                    </HasPermi>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {editingId && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">
              编辑配置:{editingEmployee?.name ?? editingId}
              <span className="ml-2 text-label text-muted-foreground">
                修改生效日 = 新增一个版本;同日 = 覆盖该版本
              </span>
            </p>
            <button className="text-label text-muted-foreground hover:underline" onClick={() => setEditingId(null)}>
              关闭
            </button>
          </div>

          <p className="text-label font-medium">薪资</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-body">
              底薪(必填)
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={salaryForm.baseSalary}
                onChange={(e) => setSalaryForm((f) => ({ ...f, baseSalary: e.target.value }))}
              />
            </label>
            <label className="text-body">
              固定津贴
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={salaryForm.fixedAllowance}
                onChange={(e) => setSalaryForm((f) => ({ ...f, fixedAllowance: e.target.value }))}
              />
            </label>
            <label className="text-body">
              加班基数
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                placeholder="留空=底薪"
                value={salaryForm.otBase}
                onChange={(e) => setSalaryForm((f) => ({ ...f, otBase: e.target.value }))}
              />
            </label>
            <label className="text-body">
              社保基数
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                placeholder="留空=底薪"
                value={salaryForm.insuranceBase}
                onChange={(e) => setSalaryForm((f) => ({ ...f, insuranceBase: e.target.value }))}
              />
            </label>
            <label className="text-body">
              公积金比例(0.12=12%)
              <input
                className={inputCls}
                type="number"
                min="0"
                max="1"
                step="0.0001"
                placeholder="留空=用地区配置"
                value={salaryForm.housingFundRate}
                onChange={(e) => setSalaryForm((f) => ({ ...f, housingFundRate: e.target.value }))}
              />
            </label>
            <label className="text-body">
              生效起始日
              <input
                className={inputCls}
                type="date"
                value={salaryForm.effectiveFrom}
                onChange={(e) => setSalaryForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
              />
            </label>
            <label className="text-body">
              生效结束日
              <input
                className={inputCls}
                type="date"
                value={salaryForm.effectiveTo}
                onChange={(e) => setSalaryForm((f) => ({ ...f, effectiveTo: e.target.value }))}
              />
            </label>
          </div>
          <HasPermi code={PAYROLL_PERM}>
            <Button size="sm" disabled={salaryMut.isPending} onClick={() => salaryMut.mutate()}>
              保存薪资配置
            </Button>
          </HasPermi>

          <p className="text-label font-medium">个税专项附加扣除</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-body">
              子女数
              <input
                className={inputCls}
                type="number"
                min="0"
                step="1"
                value={taxForm.childrenCount}
                onChange={(e) => setTaxForm((f) => ({ ...f, childrenCount: e.target.value }))}
              />
            </label>
            <label className="text-body">
              子女扣除分摊比例(0~1)
              <input
                className={inputCls}
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={taxForm.childrenDeductionRatio}
                onChange={(e) => setTaxForm((f) => ({ ...f, childrenDeductionRatio: e.target.value }))}
              />
            </label>
            <label className="text-body">
              3 岁以下婴幼儿数
              <input
                className={inputCls}
                type="number"
                min="0"
                step="1"
                value={taxForm.infantCount}
                onChange={(e) => setTaxForm((f) => ({ ...f, infantCount: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-1 text-body">
              <input
                type="checkbox"
                checked={taxForm.isOnlyChild}
                onChange={(e) => setTaxForm((f) => ({ ...f, isOnlyChild: e.target.checked }))}
              />
              独生子女(赡养老人)
            </label>
            <label className="text-body">
              赡养老人分摊额(非独生)
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={taxForm.elderlySupportShare}
                onChange={(e) => setTaxForm((f) => ({ ...f, elderlySupportShare: e.target.value }))}
              />
            </label>
            <label className="text-body">
              住房类型
              <select
                className={inputCls}
                value={taxForm.housingType}
                onChange={(e) => setTaxForm((f) => ({ ...f, housingType: e.target.value }))}
              >
                <option value="none">无</option>
                <option value="rent">租房</option>
                <option value="loan">房贷利息</option>
              </select>
            </label>
            <label className="text-body">
              房租扣除额(留空=1500)
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={taxForm.housingRentAmount}
                onChange={(e) => setTaxForm((f) => ({ ...f, housingRentAmount: e.target.value }))}
              />
            </label>
            <label className="text-body">
              其他月度扣除
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={taxForm.otherMonthlyDeduction}
                onChange={(e) => setTaxForm((f) => ({ ...f, otherMonthlyDeduction: e.target.value }))}
              />
            </label>
          </div>
          <HasPermi code={PAYROLL_PERM}>
            <Button size="sm" variant="outline" disabled={taxMut.isPending} onClick={() => taxMut.mutate()}>
              保存个税扣除
            </Button>
          </HasPermi>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">社保 / 公积金费率配置</p>
          <HasPermi code={PAYROLL_PERM}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRateForm(emptyRateForm())
                setRateEditing(true)
              }}
            >
              新增 / 编辑费率
            </Button>
          </HasPermi>
        </div>
        {ratesQuery.isLoading ? (
          <p className="text-muted-foreground">{t('loading')}</p>
        ) : ratesQuery.isError ? (
          <p className="text-destructive">{ratesQuery.error?.message ?? '加载费率配置失败'}</p>
        ) : rateList.length === 0 ? (
          <p className="text-muted-foreground">尚无费率配置;算薪时社保与公积金将按 0 处理并给出警告。</p>
        ) : (
          <table className="font-[weight:inherit] w-full text-label">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1">年度</th>
                <th className="px-2 py-1">地区</th>
                <th className="px-2 py-1">养老(单位/个人)</th>
                <th className="px-2 py-1">医疗(单位/个人)</th>
                <th className="px-2 py-1">失业(单位/个人)</th>
                <th className="px-2 py-1">工伤(单位)</th>
                <th className="px-2 py-1">公积金</th>
                <th className="px-2 py-1">社保基数(下限~上限)</th>
                <th className="px-2 py-1">公积金基数(下限~上限)</th>
                <th className="px-2 py-1">状态</th>
                <th className="px-2 py-1">操作</th>
              </tr>
            </thead>
            <tbody>
              {rateList.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-1">{r.effectiveYear}</td>
                  <td className="px-2 py-1">{r.regionName}</td>
                  <td className="px-2 py-1">
                    {fmtPercent(Number(r.pensionEmployer ?? 0))} / {fmtPercent(Number(r.pensionPersonal ?? 0))}
                  </td>
                  <td className="px-2 py-1">
                    {fmtPercent(Number(r.medicalEmployer ?? 0))} / {fmtPercent(Number(r.medicalPersonal ?? 0))}
                  </td>
                  <td className="px-2 py-1">
                    {fmtPercent(Number(r.unemploymentEmployer ?? 0))} /{' '}
                    {fmtPercent(Number(r.unemploymentPersonal ?? 0))}
                  </td>
                  <td className="px-2 py-1">{fmtPercent(Number(r.injuryEmployer ?? 0))}</td>
                  <td className="px-2 py-1">{fmtPercent(Number(r.housingFundRate ?? 0))}</td>
                  <td className="px-2 py-1">
                    {r.insuranceBaseMin ? fmtMoney(r.insuranceBaseMin) : '-'} ~{' '}
                    {r.insuranceBaseMax ? fmtMoney(r.insuranceBaseMax) : '-'}
                  </td>
                  <td className="px-2 py-1">
                    {r.fundBaseMin ? fmtMoney(r.fundBaseMin) : '-'} ~{' '}
                    {r.fundBaseMax ? fmtMoney(r.fundBaseMax) : '-'}
                  </td>
                  <td className="px-2 py-1">
                    {r.enabled ? <Badge tone="ok">启用</Badge> : <Badge tone="muted">停用</Badge>}
                  </td>
                  <td className="px-2 py-1">
                    <HasPermi code={PAYROLL_PERM}>
                      <button
                        className="text-primary hover:underline"
                        onClick={() => {
                          setRateForm({
                            regionName: r.regionName,
                            effectiveYear: String(r.effectiveYear),
                            pensionEmployer: fieldText(r.pensionEmployer),
                            pensionPersonal: fieldText(r.pensionPersonal),
                            unemploymentEmployer: fieldText(r.unemploymentEmployer),
                            unemploymentPersonal: fieldText(r.unemploymentPersonal),
                            medicalEmployer: fieldText(r.medicalEmployer),
                            medicalPersonal: fieldText(r.medicalPersonal),
                            injuryEmployer: fieldText(r.injuryEmployer),
                            housingFundRate: fieldText(r.housingFundRate),
                            insuranceBaseMin: fieldText(r.insuranceBaseMin),
                            insuranceBaseMax: fieldText(r.insuranceBaseMax),
                            fundBaseMin: fieldText(r.fundBaseMin),
                            fundBaseMax: fieldText(r.fundBaseMax),
                            enabled: r.enabled,
                          })
                          setRateEditing(true)
                        }}
                      >
                        编辑
                      </button>
                    </HasPermi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {rateEditing && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="font-medium">费率(小数,0.16 = 16%)</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="text-body">
                地区名(必填)
                <input
                  className={inputCls}
                  value={rateForm.regionName}
                  onChange={(e) => setRateForm((f) => ({ ...f, regionName: e.target.value }))}
                />
              </label>
              <label className="text-body">
                年度(必填)
                <input
                  className={inputCls}
                  type="number"
                  min="2000"
                  max="2100"
                  step="1"
                  value={rateForm.effectiveYear}
                  onChange={(e) => setRateForm((f) => ({ ...f, effectiveYear: e.target.value }))}
                />
              </label>
              <label className="text-body">
                养老-单位
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  value={rateForm.pensionEmployer}
                  onChange={(e) => setRateForm((f) => ({ ...f, pensionEmployer: e.target.value }))}
                />
              </label>
              <label className="text-body">
                养老-个人
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  value={rateForm.pensionPersonal}
                  onChange={(e) => setRateForm((f) => ({ ...f, pensionPersonal: e.target.value }))}
                />
              </label>
              <label className="text-body">
                医疗-单位
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  value={rateForm.medicalEmployer}
                  onChange={(e) => setRateForm((f) => ({ ...f, medicalEmployer: e.target.value }))}
                />
              </label>
              <label className="text-body">
                医疗-个人
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  value={rateForm.medicalPersonal}
                  onChange={(e) => setRateForm((f) => ({ ...f, medicalPersonal: e.target.value }))}
                />
              </label>
              <label className="text-body">
                失业-单位
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  value={rateForm.unemploymentEmployer}
                  onChange={(e) => setRateForm((f) => ({ ...f, unemploymentEmployer: e.target.value }))}
                />
              </label>
              <label className="text-body">
                失业-个人
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  value={rateForm.unemploymentPersonal}
                  onChange={(e) => setRateForm((f) => ({ ...f, unemploymentPersonal: e.target.value }))}
                />
              </label>
              <label className="text-body">
                工伤-单位
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  value={rateForm.injuryEmployer}
                  onChange={(e) => setRateForm((f) => ({ ...f, injuryEmployer: e.target.value }))}
                />
              </label>
              <label className="text-body">
                公积金
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="1"
                  step="0.0001"
                  value={rateForm.housingFundRate}
                  onChange={(e) => setRateForm((f) => ({ ...f, housingFundRate: e.target.value }))}
                />
              </label>
              <label className="text-body">
                社保基数下限
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={rateForm.insuranceBaseMin}
                  onChange={(e) => setRateForm((f) => ({ ...f, insuranceBaseMin: e.target.value }))}
                />
              </label>
              <label className="text-body">
                社保基数上限
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={rateForm.insuranceBaseMax}
                  onChange={(e) => setRateForm((f) => ({ ...f, insuranceBaseMax: e.target.value }))}
                />
              </label>
              <label className="text-body">
                公积金基数下限
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={rateForm.fundBaseMin}
                  onChange={(e) => setRateForm((f) => ({ ...f, fundBaseMin: e.target.value }))}
                />
              </label>
              <label className="text-body">
                公积金基数上限
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={rateForm.fundBaseMax}
                  onChange={(e) => setRateForm((f) => ({ ...f, fundBaseMax: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-1 text-body">
                <input
                  type="checkbox"
                  checked={rateForm.enabled}
                  onChange={(e) => setRateForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                启用
              </label>
            </div>
            <div className="flex gap-2">
              <HasPermi code={PAYROLL_PERM}>
                <Button size="sm" disabled={rateMut.isPending} onClick={() => rateMut.mutate()}>
                  保存费率
                </Button>
              </HasPermi>
              <Button size="sm" variant="outline" onClick={() => setRateEditing(false)}>
                取消
              </Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

// =============================================================================
// 工资单
// =============================================================================

export function PayrollTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient()
  const [periodMonth, setPeriodMonth] = React.useState(currentMonth)
  const [region, setRegion] = React.useState('')
  const [overwriteApproved, setOverwriteApproved] = React.useState(false)
  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({})

  const itemsQuery = useQuery({
    queryKey: ['hr', 'payroll', 'items', periodMonth],
    enabled: MONTH_RE.test(periodMonth),
    queryFn: () => api<PayrollItemsResult>(`${PAYROLL_RESOURCE}/items?periodMonth=${periodMonth}`),
  })

  const periodsQuery = useQuery({
    queryKey: ['hr', 'payroll', 'periods'],
    queryFn: () => api<PayrollPeriod[]>(`${PAYROLL_RESOURCE}/periods`),
  })

  const calcMut = useMutation({
    mutationFn: () =>
      api<PayrollBuildResult>(`${PAYROLL_RESOURCE}/calculate`, {
        method: 'POST',
        body: JSON.stringify({
          periodMonth,
          regionName: region.trim() || undefined,
          overwriteApproved,
        }),
      }),
    onSuccess: (d) => {
      toast.success(
        `${t('payrollCalculated')}:${d.employees} 人,应发 ${fmtMoney(d.totalGross)},实发 ${fmtMoney(d.totalNet)},缺配置跳过 ${d.skippedNoConfig}`,
      )
      qc.invalidateQueries({ queryKey: ['hr', 'payroll', 'items', periodMonth] })
      qc.invalidateQueries({ queryKey: ['hr', 'payroll', 'periods'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const statusMut = useMutation({
    mutationFn: (status: string) =>
      api<PayrollPeriod>(`${PAYROLL_RESOURCE}/status`, {
        method: 'POST',
        body: JSON.stringify({ periodMonth, status }),
      }),
    onSuccess: () => {
      toast.success(t('statusUpdated'))
      qc.invalidateQueries({ queryKey: ['hr', 'payroll', 'periods'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = itemsQuery.data?.rows ?? []
  const currentPeriod = periodsQuery.data?.find((p) => p.periodMonth === periodMonth)
  const currentStatus = currentPeriod?.status ?? ''
  const monthValid = MONTH_RE.test(periodMonth)

  return (
    <Section title={t('tabPayroll')}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="font-[weight:inherit] text-body">
          {t('colMonth')}
          <input
            className={inputCls}
            type="month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
          />
        </label>
        <label className="font-[weight:inherit] text-body">
          {t('colRegion')}
          <input
            className={inputCls}
            value={region}
            placeholder={t('phRegionOptional')}
            onChange={(e) => setRegion(e.target.value)}
          />
        </label>
        <label className="font-[weight:inherit] flex items-center gap-1 text-body">
          <input
            type="checkbox"
            checked={overwriteApproved}
            onChange={(e) => setOverwriteApproved(e.target.checked)}
          />
          覆盖已审批周期
        </label>
        <HasPermi code={PAYROLL_PERM}>
          <Button
            size="sm"
            disabled={!monthValid || calcMut.isPending}
            onClick={() => calcMut.mutate()}
          >
            <Wallet className="h-4 w-4" />
            {t('calculatePayroll')}
          </Button>
        </HasPermi>
        {currentStatus === 'calculated' && (
          <HasPermi code={PAYROLL_PERM}>
            <Button
              size="sm"
              variant="outline"
              disabled={statusMut.isPending}
              onClick={() => statusMut.mutate('approved')}
            >
              <CheckCircle2 className="h-4 w-4" />
              {t('approvePayroll')}
            </Button>
          </HasPermi>
        )}
        {currentStatus === 'approved' && (
          <HasPermi code={PAYROLL_PERM}>
            <Button
              size="sm"
              variant="outline"
              disabled={statusMut.isPending}
              onClick={() => statusMut.mutate('paid')}
            >
              <Coins className="h-4 w-4" />
              {t('markPaid')}
            </Button>
          </HasPermi>
        )}
      </div>
      {periodsQuery.isError && (
        <p className="text-destructive">{periodsQuery.error?.message ?? '加载薪资周期失败'}</p>
      )}
      <p className="text-label text-muted-foreground">
        需该月月结已生成;缺薪资配置的员工会被跳过并计入提示。已审批的周期默认不可重算,已发放后完全锁定。
      </p>

      <div className="flex flex-wrap items-center gap-3 text-body">
        <span>
          {t('colPeriodMonth')}: {periodMonth}
        </span>
        {currentPeriod ? (
          <Badge
            tone={
              currentStatus === 'draft' ? 'muted' : currentStatus === 'calculated' ? 'warn' : 'ok'
            }
          >
            {PERIOD_STATUS_LABEL[currentStatus] ?? currentStatus}
          </Badge>
        ) : (
          <span className="text-muted-foreground">{t('none')}</span>
        )}
        <span>
          {t('colCount')}: {itemsQuery.data?.count ?? 0}
        </span>
        <span>
          {t('colTotalGross')}: <strong>{fmtMoney(itemsQuery.data?.totalGross)}</strong>
        </span>
        <span>
          {t('colTotalNet')}:{' '}
          <strong className="text-success">{fmtMoney(itemsQuery.data?.totalNet)}</strong>
        </span>
      </div>

      {!monthValid ? (
        <p className="text-muted-foreground">请输入 YYYY-MM 格式的月份</p>
      ) : itemsQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : itemsQuery.isError ? (
        <p className="text-destructive">{itemsQuery.error?.message ?? '加载工资单失败'}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">{t('noPayrollHint')}</p>
      ) : (
        <table className="font-[weight:inherit] w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colEmployeeNo')}</th>
              <th className="px-2 py-1">{t('colName')}</th>
              <th className="px-2 py-1">{t('colGrossPay')}</th>
              <th className="px-2 py-1">{t('colOtAmount')}</th>
              <th className="px-2 py-1">缺勤扣款</th>
              <th className="px-2 py-1">{t('colInsurance')}</th>
              <th className="px-2 py-1">{t('colFund')}</th>
              <th className="px-2 py-1">{t('colIncomeTax')}</th>
              <th className="px-2 py-1">{t('colNetPay')}</th>
              <th className="px-2 py-1">明细</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const warnings = r.breakdown?.warnings ?? []
              const rates = r.breakdown?.rates ?? null
              return (
                <React.Fragment key={`${r.employeeNo ?? 'row'}-${i}`}>
                  <tr className="border-t">
                    <td className="px-2 py-1">{r.employeeNo ?? '-'}</td>
                    <td className="px-2 py-1">{r.employeeName ?? '-'}</td>
                    <td className="px-2 py-1">{fmtMoney(r.grossPay)}</td>
                    <td className="px-2 py-1">{fmtMoney(r.otAmount)}</td>
                    <td className="px-2 py-1 text-destructive">
                      {Number(r.attendanceDeduction) > 0
                        ? `-${fmtMoney(r.attendanceDeduction)}`
                        : '0.00'}
                    </td>
                    <td className="px-2 py-1">{fmtMoney(r.insurancePersonal)}</td>
                    <td className="px-2 py-1">{fmtMoney(r.housingFundPersonal)}</td>
                    <td className="px-2 py-1">{fmtMoney(r.incomeTax)}</td>
                    <td className="px-2 py-1 font-medium text-success">{fmtMoney(r.netPay)}</td>
                    <td className="px-2 py-1">
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
                      >
                        {expanded[i] ? t('hideDetail') : t('showDetail')}
                      </button>
                      {warnings.length > 0 && (
                        <span className="ml-1 text-label text-warning">({warnings.length})</span>
                      )}
                    </td>
                  </tr>
                  {expanded[i] && (
                    <tr className="border-t bg-muted/30">
                      <td colSpan={10} className="space-y-2 px-2 py-2">
                        <p className="font-medium">{t('breakdownTitle')}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-label">
                          {PAYROLL_STEPS.map((s) => (
                            <span key={s.key}>
                              {s.label}: <strong>{fmtMoney(r.breakdown?.steps?.[s.key])}</strong>
                            </span>
                          ))}
                        </div>
                        {rates ? (
                          <p className="text-label text-muted-foreground">
                            {rates.region} / {rates.year} 年 · 养老个人{' '}
                            {fmtPercent(rates.pensionPersonal)} · 医疗个人{' '}
                            {fmtPercent(rates.medicalPersonal)} · 失业个人{' '}
                            {fmtPercent(rates.unemploymentPersonal)} · 公积金{' '}
                            {fmtPercent(rates.housingFundRate)}
                          </p>
                        ) : (
                          <p className="text-label text-muted-foreground">未匹配到社保费率配置</p>
                        )}
                        {warnings.length > 0 ? (
                          <ul className="space-y-0.5 text-label text-warning">
                            {warnings.map((w, wi) => (
                              <li key={wi}>{w}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-label text-muted-foreground">{t('none')}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </Section>
  )
}
