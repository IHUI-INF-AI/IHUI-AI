// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 人事自助 · 关联确认面板(2026-11-16 立)。
 *
 * 数据隔离:不同用户的数据默认完全隔离。HR 只能「邀请」某个平台账号关联员工档案,
 * 必须由该账号本人在此明确同意后才写入绑定;同意前自助页读不到任何员工数据。
 * 未绑定且无待确认邀请时,只显示"请联系 HR 关联账号"的提示,不暴露任何档案信息。
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Loader2, ShieldCheck, TriangleAlert, X } from 'lucide-react'

import { Card, CardContent, Button } from '@ihui/ui-react'
import { apiOrThrow as api } from '@/lib/api'

export interface HrSelfEmployee {
  id: string
  employeeNo: string
  name: string
  departmentId: string
  departmentName: string | null
  position: string | null
  hireDate?: string | null
  status?: string
}

export interface HrPendingLink {
  id: string
  employeeNo: string
  name: string
  departmentName: string | null
  position: string | null
  invitedAt: string
}

export interface HrSelfMe {
  employee: HrSelfEmployee | null
  today?: unknown
  pendingLinks: HrPendingLink[]
}

/** 自助页 /me 查询的单一真相源:三个自助页与确认面板共用同一 queryKey(命中同一份缓存)。 */
export const HR_SELF_ME_KEY = ['hr', 'self', 'me'] as const

export function useHrSelfMe(enabled: boolean) {
  return useQuery({
    queryKey: HR_SELF_ME_KEY,
    queryFn: () => api<HrSelfMe>('/api/hr-attendance/me'),
    enabled,
  })
}

/**
 * 未绑定员工档案时的统一出口:
 * 有待确认邀请 → 列出来源(员工/部门/岗位)并让本人选择同意或拒绝;
 * 无待确认邀请 → 仅提示联系 HR,不显示任何档案线索。
 */
export function HrSelfLinkPanel({ hint }: { hint?: string }) {
  const t = useTranslations('hrAttendance')
  const qc = useQueryClient()
  const meQuery = useHrSelfMe(true)

  const decide = useMutation({
    mutationFn: (vars: { id: string; action: 'accept' | 'reject' }) =>
      api(`/api/hr-attendance/me/link-requests/${vars.id}/${vars.action}`, { method: 'POST' }),
    onSuccess: (_data, vars) => {
      toast.success(vars.action === 'accept' ? t('linkAcceptOk') : t('linkRejectOk'))
      // 同意后 /me 会返回 employee,/me 与依赖本人档案的查询一起失效
      void qc.invalidateQueries({ queryKey: ['hr', 'self'] })
      void qc.invalidateQueries({ queryKey: ['hr', 'my-payroll'] })
    },
    onError: (e: Error) => toast.error(e.message || t('actionFailed')),
  })

  if (meQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  const pending = meQuery.data?.pendingLinks ?? []
  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
        <TriangleAlert className="h-8 w-8 text-muted-foreground" />
        <p className="max-w-md text-center text-body text-muted-foreground">
          {hint ?? t('noEmployeeHint')}
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <h2 className="text-body font-semibold">{t('linkPendingTitle')}</h2>
          <p className="text-label text-muted-foreground">{t('linkPendingDesc')}</p>
        </div>
      </div>
      {pending.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-heading font-semibold">{p.name}</span>
                <span className="text-label text-muted-foreground">{p.employeeNo}</span>
              </div>
              <p className="text-label text-muted-foreground">
                {t('colDepartment')}: {p.departmentName ?? '—'}
                {p.position ? ` · ${p.position}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: p.id, action: 'accept' })}
              >
                {decide.isPending &&
                decide.variables?.id === p.id &&
                decide.variables.action === 'accept' ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1 h-4 w-4" />
                )}
                {t('linkAccept')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: p.id, action: 'reject' })}
              >
                <X className="mr-1 h-4 w-4" />
                {t('linkReject')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
