// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 员工绩效自助端(2026-11-24 十波):我的评估单列表 + 自评提交 + 确认/申诉。
 * 归属由服务端从登录态解析(/my/reviews),前端不传 employeeId;
 * 后端流转闸(非本人 403/状态不符 409)如实 toast,不猜可点性。
 */
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { apiOrThrow as api } from '@/lib/api'
import { AuthGatePrompt } from '@/components/common'
import { FeaturePageShell } from '@/components/layout'

const PERF = '/api/hr-perf'

type Review = {
  id: string
  status: string
  selfScore: number | null
  finalScore: number | null
  grade: string | null
  rounds: number
  cycleId: string
}

function useSelfAuth() {
  // 登录态判定复用 useAuthGate 先例:未登录出 AuthGatePrompt
  const [ready, setReady] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    fetch(`${PERF}/my/reviews`, { credentials: 'include' })
      .then((r) => setReady(r.status !== 401))
      .catch(() => setReady(false))
  }, [])
  return ready
}

export default function MyPerfPage() {
  const t = useTranslations('hrGap')
  const qc = useQueryClient()
  const [score, setScore] = React.useState('')
  const [comment, setComment] = React.useState('')
  const ready = useSelfAuth()

  const listQ = useQuery({
    queryKey: ['hrp', 'my'],
    queryFn: () => api<{ list: Review[] }>(`${PERF}/my/reviews`),
    enabled: ready === true,
  })
  const rows = listQ.data?.list ?? []

  const self = useMutation({
    mutationFn: (input: { id: string; s: number; c: string }) =>
      api(`${PERF}/reviews/${input.id}/self`, {
        method: 'POST',
        body: JSON.stringify({ score: input.s, comment: input.c }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setScore('')
      setComment('')
      qc.invalidateQueries({ queryKey: ['hrp', 'my'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const decide = useMutation({
    mutationFn: (input: { id: string; action: 'confirm' | 'refuse' }) =>
      api(`${PERF}/reviews/${input.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ action: input.action }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      qc.invalidateQueries({ queryKey: ['hrp', 'my'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (ready === null) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (ready === false) return <AuthGatePrompt message="请先登录后查看我的绩效" />

  return (
    <FeaturePageShell title={t('myPerfTitle')}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noData')}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-stroke-subtle p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <b>{r.id.slice(0, 8)}</b>
                <span className="text-muted-foreground">{r.status}</span>
                <span className="tabular-nums">{t('perfSelfScore')}: {r.selfScore ?? '-'}</span>
                <span className="tabular-nums">{t('perfGrade')}: {r.grade ?? '-'}</span>
                <span className="tabular-nums">{t('perfRoundsLabel')}: {r.rounds}</span>
              </div>
              {r.status === 'pending' ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className="h-8 w-20 rounded-md border border-stroke-field bg-background px-2 text-xs"
                    type="number"
                    min="0"
                    max="100"
                    placeholder={t('scoreLabel')}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                  />
                  <input
                    className="h-8 min-w-40 flex-1 rounded-md border border-stroke-field bg-background px-2 text-xs"
                    placeholder={t('selfSubmit')}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!score || !comment.trim() || self.isPending}
                    onClick={() => self.mutate({ id: r.id, s: Number(score), c: comment.trim() })}
                  >
                    {t('selfSubmit')}
                  </Button>
                </div>
              ) : null}
              {r.status === 'reviewed' ? (
                <div className="mt-2 flex gap-1">
                  <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, action: 'confirm' })}>
                    {t('perfConfirm')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: r.id, action: 'refuse' })}
                  >
                    {t('perfRefuse')}
                  </Button>
                </div>
              ) : null}
              {r.status === 'self_done' ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{t('reviewWaiting')}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </FeaturePageShell>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
