// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, RefreshCw, Star } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { rowsOf } from '@/lib/api-rows'
import { api, HR_RESOURCE, DEPT_RESOURCE, type HrCandidate, type HrProbationDue } from './types'
import { Card, Empty, Badge, field, th, td, btnGhost } from './ui'

/** 面试方式 → 文案键(const 字面量映射;守门 213/235 禁止渲染侧内联拼接 t(`mode_${x}`)) */
const MODE_KEY = {
  onsite: 'mode_onsite',
  phone: 'mode_phone',
  video: 'mode_video',
} as const
const modeKey = (m: string | null | undefined) =>
  MODE_KEY[(m ?? 'onsite') as keyof typeof MODE_KEY] ?? MODE_KEY.onsite

/** 时间戳 → 本地短格式(时区交由 Intl 处理,不手拼) */
const fmtTime = (v: string | null | undefined) => {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

interface HrInterview {
  id: string
  candidateId: string
  round?: number | null
  scheduledAt?: string | null
  mode?: string | null
  interviewerName?: string | null
  result?: string | null
  score?: number | null
  feedback?: string | null
}

interface HrProbationReview {
  id: string
  employeeId: string
  contractId?: string | null
  result: string
  score?: number | null
  managerComment?: string | null
  decidedAt?: string | null
  extendedUntil?: string | null
}

/** 面试与试用复核(2026-11-23 补):排期 / 面评 / 试用期结论历史。 */
export function InterviewTab() {
  const t = useTranslations('hrLifecycle')
  const qc = useQueryClient()

  // ---------- 候选人下拉 ----------
  const candidatesQ = useQuery({
    queryKey: ['hrl', 'candidates', 'for-interview'],
    queryFn: () => api<unknown>(`${HR_RESOURCE}/candidates?limit=100`),
  })
  const candidates = rowsOf<HrCandidate>(candidatesQ.data)

  // 员工名册(id → 姓名;复核历史里的员工多半不在"待评估"清单里)
  const employeesQ = useQuery({
    queryKey: ['hrl', 'employees', 'name-map'],
    queryFn: () => api<unknown>(`${DEPT_RESOURCE}/employees`),
  })
  const employees = rowsOf<{ id: string; name: string; employeeNo?: string }>(employeesQ.data)
  const empNameOf = (id: string) => employees.find((e) => e.id === id)?.name

  // ---------- 面试列表 ----------
  const [pendingOnly, setPendingOnly] = React.useState(true)
  const interviewsQ = useQuery({
    queryKey: ['hrl', 'interviews', pendingOnly],
    queryFn: () => api<unknown>(`${HR_RESOURCE}/interviews?pending=${pendingOnly ? '1' : '0'}`),
  })
  const interviews = rowsOf<HrInterview>(interviewsQ.data)

  const [candidateId, setCandidateId] = React.useState('')
  const [scheduledAt, setScheduledAt] = React.useState('')
  const [mode, setMode] = React.useState<'onsite' | 'phone' | 'video'>('onsite')
  const [interviewerName, setInterviewerName] = React.useState('')

  const schedule = useMutation({
    mutationFn: () =>
      api(`${HR_RESOURCE}/candidates/${candidateId}/interviews`, {
        method: 'POST',
        body: JSON.stringify({
          scheduledAt,
          mode,
          interviewerName: interviewerName.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(t('interviewScheduled'))
      setScheduledAt('')
      setInterviewerName('')
      qc.invalidateQueries({ queryKey: ['hrl', 'interviews'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const [scoreInput, setScoreInput] = React.useState<Record<string, string>>({})
  const feedback = useMutation({
    mutationFn: (p: { id: string; result: 'pass' | 'fail' }) =>
      api(`${HR_RESOURCE}/interviews/${p.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          result: p.result,
          score: scoreInput[p.id] ? Number(scoreInput[p.id]) : undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(t('interviewFeedbackSaved'))
      qc.invalidateQueries({ queryKey: ['hrl', 'interviews'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ---------- 试用复核 ----------
  const dueQ = useQuery({
    queryKey: ['hrl', 'probation-due'],
    queryFn: () => api<unknown>(`${HR_RESOURCE}/probation/due`),
  })
  const dueRows = rowsOf<HrProbationDue>(dueQ.data)

  const reviewsQ = useQuery({
    queryKey: ['hrl', 'probation-reviews'],
    queryFn: () => api<unknown>(`${HR_RESOURCE}/probation/reviews`),
  })
  const reviews = rowsOf<HrProbationReview>(reviewsQ.data)

  const [reviewEmployeeId, setReviewEmployeeId] = React.useState('')
  const [reviewResult, setReviewResult] = React.useState<'pass' | 'extend' | 'fail'>('pass')
  const [reviewScore, setReviewScore] = React.useState('')
  const [reviewComment, setReviewComment] = React.useState('')
  const [extendedUntil, setExtendedUntil] = React.useState('')

  const submitReview = useMutation({
    mutationFn: () =>
      api(`${HR_RESOURCE}/probation/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: reviewEmployeeId,
          result: reviewResult,
          score: reviewScore ? Number(reviewScore) : undefined,
          managerComment: reviewComment.trim() || undefined,
          extendedUntil: reviewResult === 'extend' && extendedUntil ? extendedUntil : undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(t('reviewSaved'))
      setReviewComment('')
      setReviewScore('')
      qc.invalidateQueries({ queryKey: ['hrl', 'probation-reviews'] })
      qc.invalidateQueries({ queryKey: ['hrl', 'probation-due'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <Card
        title={t('interviewsTitle')}
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => setPendingOnly(e.target.checked)}
              />
              {t('pendingOnly')}
            </label>
            <Button size="sm" variant="outline" onClick={() => interviewsQ.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
              {t('refresh')}
            </Button>
          </div>
        }
      >
        {interviews.length === 0 ? (
          <Empty text={t('noInterviews')} />
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>{t('candidateName')}</th>
                  <th className={th}>{t('interviewRound')}</th>
                  <th className={th}>{t('scheduledAt')}</th>
                  <th className={th}>{t('interviewMode')}</th>
                  <th className={th}>{t('interviewer')}</th>
                  <th className={th}>{t('status')}</th>
                  <th className={th}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((r) => {
                  const cand = candidates.find((c) => c.id === r.candidateId)
                  return (
                    <tr key={r.id} className="border-t border-stroke-subtle">
                      <td className={td}>{cand?.name ?? r.candidateId.slice(0, 8)}</td>
                      <td className={`${td} tabular-nums`}>{r.round ?? 1}</td>
                      <td className={td}>{fmtTime(r.scheduledAt)}</td>
                      <td className={td}>{r.mode ? t(modeKey(r.mode)) : '-'}</td>
                      <td className={td}>{r.interviewerName ?? '-'}</td>
                      <td className={td}>
                        <Badge status={r.result ?? 'pending'} />
                      </td>
                      <td className={`${td} space-x-1`}>
                        {!r.result || r.result === 'pending' ? (
                          <>
                            <input
                              className={`${field} w-14`}
                              placeholder={t('score')}
                              value={scoreInput[r.id] ?? ''}
                              onChange={(e) =>
                                setScoreInput((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                            />
                            <button
                              className={btnGhost}
                              onClick={() => feedback.mutate({ id: r.id, result: 'pass' })}
                            >
                              <Star className="h-3 w-3" />
                              {t('pass')}
                            </button>
                            <button
                              className={btnGhost}
                              onClick={() => feedback.mutate({ id: r.id, result: 'fail' })}
                            >
                              {t('fail')}
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {r.score ?? '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <select
            className={field}
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
          >
            <option value="">{t('pickCandidate')}</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className={`${field} w-48`}
            type="datetime-local"
            placeholder={t('scheduledAtHint')}
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <select
            className={field}
            value={mode}
            onChange={(e) => setMode(e.target.value as 'onsite' | 'phone' | 'video')}
          >
            <option value="onsite">{t('mode_onsite')}</option>
            <option value="phone">{t('mode_phone')}</option>
            <option value="video">{t('mode_video')}</option>
          </select>
          <input
            className={`${field} w-32`}
            placeholder={t('interviewer')}
            value={interviewerName}
            onChange={(e) => setInterviewerName(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!candidateId || !scheduledAt || schedule.isPending}
            onClick={() => schedule.mutate()}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('scheduleInterview')}
          </Button>
        </div>
      </Card>

      <Card title={t('probationReviewsTitle')}>
        {reviews.length === 0 ? (
          <Empty text={t('noReviews')} />
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>{t('employeeName')}</th>
                  <th className={th}>{t('result')}</th>
                  <th className={th}>{t('score')}</th>
                  <th className={th}>{t('managerComment')}</th>
                  <th className={th}>{t('decidedAt')}</th>
                  <th className={th}>{t('extendedUntil')}</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => {
                  const due = dueRows.find((d) => d.employeeId === r.employeeId)
                  return (
                    <tr key={r.id} className="border-t border-stroke-subtle">
                      <td className={td}>
                        {empNameOf(r.employeeId) ?? due?.employeeName ?? r.employeeId.slice(0, 8)}
                      </td>
                      <td className={td}>
                        <Badge status={r.result} />
                      </td>
                      <td className={`${td} tabular-nums`}>{r.score ?? '-'}</td>
                      <td className={td}>{r.managerComment ?? '-'}</td>
                      <td className={td}>{fmtTime(r.decidedAt)}</td>
                      <td className={td}>{r.extendedUntil ?? '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <select
            className={field}
            value={reviewEmployeeId}
            onChange={(e) => setReviewEmployeeId(e.target.value)}
          >
            <option value="">{t('pickProbationEmployee')}</option>
            {dueRows.map((d) => (
              <option key={d.employeeId} value={d.employeeId}>
                {d.employeeNo} {d.employeeName}({d.probationEndDate})
              </option>
            ))}
          </select>
          <select
            className={field}
            value={reviewResult}
            onChange={(e) => setReviewResult(e.target.value as 'pass' | 'extend' | 'fail')}
          >
            <option value="pass">{t('reviewPass')}</option>
            <option value="extend">{t('reviewExtend')}</option>
            <option value="fail">{t('reviewFail')}</option>
          </select>
          <input
            className={`${field} w-16`}
            placeholder={t('score')}
            value={reviewScore}
            onChange={(e) => setReviewScore(e.target.value)}
          />
          {reviewResult === 'extend' && (
            <input
              className={`${field} w-32`}
              placeholder={t('extendedUntil')}
              value={extendedUntil}
              onChange={(e) => setExtendedUntil(e.target.value)}
            />
          )}
          <input
            className={`${field} w-56`}
            placeholder={t('managerComment')}
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!reviewEmployeeId || submitReview.isPending}
            onClick={() => submitReview.mutate()}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('saveReview')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
