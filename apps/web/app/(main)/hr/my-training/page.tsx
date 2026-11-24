// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 员工培训自助端(2026-11-24 十波):本人跨计划报名记录 + 累计学时(后端快照聚合,前端只展示)。
 */
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { apiOrThrow as api } from '@/lib/api'
import { AuthGatePrompt } from '@/components/common'
import { FeaturePageShell } from '@/components/layout'

const TR = '/api/hr-training'

type Enrollment = {
  id: string
  status: string
  planId: string
  courseId: string
  hoursAtCompletion: string | null
  completedAt: string | null
}

function useSelfAuth() {
  const [ready, setReady] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    fetch(`${TR}/my/enrollments`, { credentials: 'include' })
      .then((r) => setReady(r.status !== 401))
      .catch(() => setReady(false))
  }, [])
  return ready
}

export default function MyTrainingPage() {
  const t = useTranslations('hrGap')
  const ready = useSelfAuth()

  const listQ = useQuery({
    queryKey: ['hrt', 'my'],
    queryFn: () =>
      api<{ list: Enrollment[]; hours: { courses: number; totalHours: string } }>(`${TR}/my/enrollments`),
    enabled: ready === true,
  })
  const rows = listQ.data?.list ?? []
  const hours = listQ.data?.hours

  if (ready === null) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (ready === false) return <AuthGatePrompt message="请先登录后查看我的培训" />

  return (
    <FeaturePageShell title={t('myTrainingTitle')}>
      <div className="mb-3 rounded-lg border border-stroke-subtle bg-card p-3">
        <p className="text-[11px] text-muted-foreground">{t('trTotalHours')}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {hours?.totalHours ?? '0.0'}
          <span className="ml-1 text-xs font-normal text-muted-foreground">{t('hoursLabel')}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {t('trCourseTitle')}: {hours?.courses ?? 0}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] text-muted-foreground">
              <th className="px-2 py-1 font-normal">{t('trCourse')}</th>
              <th className="px-2 py-1 font-normal">{t('colStatus')}</th>
              <th className="px-2 py-1 font-normal">{t('trDuration')}</th>
              <th className="px-2 py-1 font-normal">{t('gradeEffective')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-stroke-subtle text-xs">
                <td className="px-2 py-1 font-mono">{e.courseId.slice(0, 8)}</td>
                <td className="px-2 py-1">{e.status}</td>
                <td className="px-2 py-1 tabular-nums">{e.hoursAtCompletion ?? '-'}</td>
                <td className="px-2 py-1">{e.completedAt ? String(e.completedAt).slice(0, 10) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FeaturePageShell>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
