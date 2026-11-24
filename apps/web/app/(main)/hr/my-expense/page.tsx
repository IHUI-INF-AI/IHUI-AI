// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 员工报销自助页(2026-11-24 十一波)。
 *
 * 背景:后端自助面(POST /my/submit、GET /my)在四波就落地,管理面注释也写着
 * "提单在员工自助端",但 web 侧从来没有那一页 —— 员工拿到的是"端点存在、入口不存在"。
 * 本页补上入口:表单见 claim-form.tsx(审批人自动预选、票据逐件上传),列表见 claim-list.tsx。
 * 归属与权限全在服务端(requireSelf + 本人档案解析),前端不传 employeeId。
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { apiOrThrow as api } from '@/lib/api'
import { AuthGatePrompt } from '@/components/common'
import { FeaturePageShell } from '@/components/layout'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { ClaimForm, type Roster } from './claim-form'
import { ClaimList, type Claim } from './claim-list'
import type { T } from './labels'

const EXP = '/api/hr-expense'

export default function MyExpensePage() {
  const t = useTranslations('hrGap') as unknown as T
  const qc = useQueryClient()
  const { ready, allow } = useAuthGate()

  const rosterQ = useQuery({
    queryKey: ['hrx', 'my', 'approvers'],
    queryFn: () => api<Roster>(`${EXP}/my/approvers`),
    enabled: allow,
    retry: false,
  })
  const listQ = useQuery({
    queryKey: ['hrx', 'my', 'list'],
    queryFn: () => api<{ list: Claim[] }>(`${EXP}/my`),
    enabled: allow,
    retry: false,
  })

  if (!ready) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (!allow) return <AuthGatePrompt />

  const rows = listQ.data?.list ?? []

  return (
    <FeaturePageShell title={t('myExpenseTitle')}>
      {rosterQ.isError ? (
        <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {(rosterQ.error as Error).message}
        </p>
      ) : null}

      <ClaimForm
        roster={rosterQ.data}
        onSubmitted={() => qc.invalidateQueries({ queryKey: ['hrx', 'my', 'list'] })}
      />

      <div className="mt-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('expMyList')}</h2>
        <Button size="sm" variant="outline" onClick={() => listQ.refetch()}>
          <RefreshCw className="mr-1 h-3 w-3" />
          {t('refresh')}
        </Button>
      </div>
      {listQ.isLoading ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('loading')}
        </div>
      ) : (
        <ClaimList rows={rows} />
      )}
    </FeaturePageShell>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
