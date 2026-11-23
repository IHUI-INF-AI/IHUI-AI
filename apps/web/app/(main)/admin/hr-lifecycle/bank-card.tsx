// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 员工收款账户(2026-11-23 补):代发文件要靠卡号,而此前前端没有任何维护入口 ——
 * 缺卡只能等导出时发现。这里做"选员工 → 看当前(掩码)→ 覆盖写"。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CreditCard, Save } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { rowsOf } from '@/lib/api-rows'
import { api } from './types'
import { Card, Empty, field } from './ui'

const PAYOUT_RESOURCE = '/api/hr-payout'
const DEPT_RESOURCE = '/api/hr-attendance'

interface HrEmployeeRow {
  id: string
  employeeNo: string
  name: string
}

interface BankInfo {
  id: string
  employeeNo: string
  name: string
  bankName: string | null
  bankAccountNo: string | null
  bankAccountName: string | null
}

/** 员工卡号维护卡(PAYOUT_RESOURCE 的 PUT/GET /employees/:id/bank) */
export function BankCard() {
  const t = useTranslations('hrLifecycle')
  const qc = useQueryClient()
  const [employeeId, setEmployeeId] = React.useState('')
  const [bankName, setBankName] = React.useState('')
  const [bankAccountNo, setBankAccountNo] = React.useState('')
  const [bankAccountName, setBankAccountName] = React.useState('')

  const empQ = useQuery({
    queryKey: ['hrl', 'employees-for-bank'],
    queryFn: () => api<unknown>(`${DEPT_RESOURCE}/employees`),
  })
  const employees = rowsOf<HrEmployeeRow>(empQ.data)

  const bankQ = useQuery({
    queryKey: ['hrl', 'employee-bank', employeeId],
    enabled: Boolean(employeeId),
    queryFn: () => api<BankInfo>(`${PAYOUT_RESOURCE}/employees/${employeeId}/bank`),
  })

  React.useEffect(() => {
    const b = bankQ.data
    if (!b) return
    setBankName(b.bankName ?? '')
    setBankAccountName(b.bankAccountName ?? '')
    setBankAccountNo('')
  }, [bankQ.data])

  const save = useMutation({
    mutationFn: () =>
      api(`${PAYOUT_RESOURCE}/employees/${employeeId}/bank`, {
        method: 'PUT',
        body: JSON.stringify({
          bankName: bankName.trim(),
          bankAccountNo: bankAccountNo.trim(),
          bankAccountName: bankAccountName.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast.success(t('bankSaved'))
      setBankAccountNo('')
      qc.invalidateQueries({ queryKey: ['hrl', 'employee-bank', employeeId] })
      qc.invalidateQueries({ queryKey: ['hrl', 'payout'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const b = bankQ.data

  return (
    <Card title={t('bankCardTitle')}>
      <div className="flex flex-wrap items-end gap-2">
        <select
          className={field}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          <option value="">{t('selectEmployee')}</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.employeeNo} {e.name}
            </option>
          ))}
        </select>
        <input
          className={`${field} w-40`}
          placeholder={t('bankName')}
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
        />
        <input
          className={`${field} w-56`}
          placeholder={t('bankAccountNo')}
          value={bankAccountNo}
          onChange={(e) => setBankAccountNo(e.target.value)}
        />
        <input
          className={`${field} w-40`}
          placeholder={t('bankAccountName')}
          value={bankAccountName}
          onChange={(e) => setBankAccountName(e.target.value)}
        />
        <Button
          size="sm"
          disabled={
            !employeeId ||
            bankName.trim().length < 2 ||
            bankAccountNo.trim().length < 8 ||
            save.isPending
          }
          onClick={() => save.mutate()}
        >
          <Save className="h-3.5 w-3.5" />
          {t('bankSave')}
        </Button>
      </div>

      {!employeeId ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{t('bankPickHint')}</p>
      ) : !b ? (
        <Empty text={t('loading')} />
      ) : (
        <div className="mt-2 flex items-center gap-2 text-[11px] tabular-nums">
          <CreditCard className="h-3 w-3 text-muted-foreground" />
          <span>{b.employeeNo}</span>
          <span className="font-medium">{b.name}</span>
          <span className="text-muted-foreground">
            {b.bankName ?? t('noneBank')}
            {b.bankAccountNo ? ` · ${b.bankAccountNo}` : ''}
          </span>
        </div>
      )}
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
