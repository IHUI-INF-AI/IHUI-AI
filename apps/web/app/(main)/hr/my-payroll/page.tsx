// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 员工自助查本人工资单(HR-5,2026-11-13 立)。
 * 仅需登录(requireAuth):后端按登录 userId → 绑定员工 → 只返回本人工资条,绝不越权。
 * 与 admin/hr-attendance 的薪资管理页分离:那是 HR 管理面,这里是员工自助面。
 */

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Wallet, Loader2, Calculator } from 'lucide-react'

import { Card, CardContent, Button } from '@ihui/ui-react'
import { apiOrThrow as api } from '@/lib/api'
import { AuthGatePrompt, BackButton } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'

interface MyPayrollRow {
  periodMonth: string
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
  breakdown: {
    steps?: Record<string, number>
    warnings?: string[]
  } | null
}

// 列定义:[breakdown.stepKey, 表头 i18n key]。供明细展开逐项回溯。
// 键名对齐 admin payroll-tabs.tsx 的 BREAKDOWN_STEPS(单一真相源,两页共用同一套列名)。
const BREAKDOWN_STEPS: Array<
  [
    string,
    (
      | 'colDailyRate'
      | 'colBasePay'
      | 'colOtAmount'
      | 'colAbsenceDeduction'
      | 'colGrossPay'
      | 'colInsurance'
      | 'colFund'
      | 'colSpecialDeduction'
      | 'colTaxableIncome'
      | 'colIncomeTax'
      | 'colNetPay'
    ),
  ]
> = [
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

export default function MyPayrollPage() {
  const t = useTranslations('myPayroll')
  const th = useTranslations('hrAttendance')
  const [month, setMonth] = React.useState('')
  const [expandedMonth, setExpandedMonth] = React.useState<string | null>(null)

  // 登录态门:未登录不发注定 401 的请求
  const { allow } = useAuthGate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr', 'my-payroll', month],
    queryFn: () => {
      const qs = month ? `?periodMonth=${month}` : ''
      return api<{ periodMonth: string | null; count: number; rows: MyPayrollRow[] }>(
        `/api/hr-payroll/mine${qs}`,
      )
    },
    enabled: allow,
  })

  const rows = data?.rows ?? []

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-5xl space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-heading font-bold tracking-tight min-[768px]:text-display">
          <Wallet className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-label text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 月份筛选(留空 = 全部月份) */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="font-[weight:inherit] text-body">
          {th('colMonth')}
          <input
            className="font-[weight:inherit] rounded-md border border-input bg-background px-2 py-1 text-body focus:outline-none focus:ring-1 focus:ring-primary"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        {month && (
          <Button size="sm" variant="outline" onClick={() => setMonth('')}>
            {th('none')}
          </Button>
        )}
      </div>

      {!allow ? (
        <AuthGatePrompt message={t('subtitle')} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {th('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-body text-destructive">
          {(error as Error).message}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <Wallet className="h-8 w-8 text-muted-foreground" />
          <p className="text-body text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const expanded = expandedMonth === r.periodMonth
            return (
              <Card key={r.periodMonth} className="transition-colors hover:bg-accent">
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium">{r.periodMonth}</h3>
                      <p className="text-label text-muted-foreground">
                        {r.employeeNo ?? '-'} · {r.employeeName ?? '-'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-label text-muted-foreground">{th('colNetPay')}</div>
                      <div className="font-semibold text-primary">¥{r.netPay}</div>
                    </div>
                  </div>

                  {/* 摘要:实发 + 应发 + 个税 */}
                  <div className="font-[weight:inherit] flex flex-wrap gap-4 rounded-md bg-muted/50 px-3 py-2 text-body">
                    <span>
                      {th('colGrossPay')}: <strong>{r.grossPay}</strong>
                    </span>
                    <span>
                      {th('colInsurance')}: {r.insurancePersonal}
                    </span>
                    <span>
                      {th('colFund')}: {r.housingFundPersonal}
                    </span>
                    <span>
                      {th('colIncomeTax')}: {r.incomeTax}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedMonth(expanded ? null : r.periodMonth)}
                  >
                    <Calculator className="mr-1 h-3 w-3" />
                    {expanded ? th('hideDetail') : th('showDetail')}
                  </Button>

                  {expanded && r.breakdown?.steps && (
                    <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2">
                      <div className="text-label font-medium text-muted-foreground">
                        {th('breakdownTitle')}
                      </div>
                      <div className="font-[weight:inherit] grid grid-cols-2 gap-x-6 gap-y-0.5 text-label md:grid-cols-4">
                        {BREAKDOWN_STEPS.map(([stepKey, labelKey]) => {
                          const v = r.breakdown?.steps?.[stepKey]
                          return (
                            <div key={stepKey} className="flex justify-between">
                              <span className="text-muted-foreground">{th(labelKey)}:</span>
                              <span className="font-mono">
                                {typeof v === 'number' ? v.toFixed(2) : '-'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      {r.breakdown?.warnings && r.breakdown.warnings.length > 0 && (
                        <div className="font-[weight:inherit] mt-1 space-y-0.5 text-label text-destructive">
                          {r.breakdown.warnings.map((w, i) => (
                            <div key={i}>⚠ {w}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
