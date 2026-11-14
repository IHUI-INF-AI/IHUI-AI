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
 *   · 薪资配置 —— hr_salary_config / hr_insurance_rate_config / hr_employee_tax_profile
 *                 目前只有表与算薪读取逻辑,尚未注册读写接口,故本 tab 只读员工清单。
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

export function SalaryConfigTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const employeesQuery = useQuery({
    queryKey: ['hr', 'employees', 'salary-config'],
    queryFn: () => api<ListData<HrEmployee>>(`${RESOURCE}/employees`),
  })
  const list = employeesQuery.data?.list ?? []

  return (
    <Section title={t('tabSalaryConfig')}>
      <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-body text-warning">
        员工薪资(hr_salary_config)、社保费率(hr_insurance_rate_config)、个税扣除(hr_employee_tax_profile)
        目前只有数据表与算薪读取逻辑,后端尚未注册配置读写接口。本 tab 先列出待配置员工,
        接口补齐后再在此接入。
      </p>

      {employeesQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : employeesQuery.isError ? (
        <p className="text-destructive">{employeesQuery.error?.message ?? '加载员工列表失败'}</p>
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
              <th className="px-2 py-1">{t('colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-2 py-1">{e.employeeNo}</td>
                <td className="px-2 py-1">{e.name}</td>
                <td className="px-2 py-1">{e.departmentId}</td>
                <td className="px-2 py-1">{e.position ?? '-'}</td>
                <td className="px-2 py-1">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
