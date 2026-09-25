// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { confirmDialog } from '@/components/feedback'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ClipboardList,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Lock,
} from 'lucide-react'

import { getMySignUps, cancelSignUp } from '@ihui/api-client'
import { Button } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface SignUpRow {
  id: string
  examId: string
  status: string
  signedAt: string
  examTitle?: string | null
  examStartTime?: string | null
  examEndTime?: string | null
}

interface SignUpsData {
  list: SignUpRow[]
  total: number
}

const PAGE_SIZE = 10

/** 后端 fail-closed 判据(判据源 apps/api/src/routes/exam.ts 报名域注释)对本账号返回的状态码;
 *  错误对象带上它,UI 才能把"无权读取"与"其它失败"分流 */
const FORBIDDEN_STATUS = 403
type ForbiddenAwareError = Error & { status?: number }

const EXAM_STATUS_KEYS: Record<'pending' | 'attended' | 'canceled', string> = {
  pending: 'status.pending',
  attended: 'status.attended',
  canceled: 'status.canceled',
}

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  attended: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  canceled: 'bg-muted text-muted-foreground',
}

function statusClsOf(s: string) {
  return STATUS_CLS[s] ?? 'bg-muted text-muted-foreground'
}

export default function MemberExamSignUpPage() {
  const t = useTranslations('memberExamSignUpPage')
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'exam', 'signups', page],
    queryFn: async () => {
      const r = await getMySignUps({ page, pageSize: PAGE_SIZE })
      if (!r.success) {
        // 状态码必须带出来:403 是"本路由对普通会员结构性不可用",与其它失败混在一起就藏掉了结论
        const e = new Error(r.error) as ForbiddenAwareError
        e.status = r.status
        throw e
      }
      return r.data as SignUpsData
    },
    // 403 是永久结论而非抖动,重试只会把同一个拒绝打四遍
    retry: (failureCount, err) =>
      (err as ForbiddenAwareError).status === FORBIDDEN_STATUS ? false : failureCount < 3,
  })

  const cancelMut = useMutation({
    mutationFn: (examId: string) => cancelSignUp(examId),
    onSuccess: (r) => {
      if (r.success) {
        toast.success(t('cancelSuccess'))
        qc.invalidateQueries({ queryKey: ['member', 'exam', 'signups'] })
      } else {
        toast.error(r.error || t('cancelFailed'))
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const queryError = error as ForbiddenAwareError | null
  // 普通会员拿到的是 403 而非空列表:服务端无法把登录身份换算成报名表沿用的历史会员编号,
  // 这张表对本账号结构性不可读 —— 必须说出来,不得用"暂无报名记录"把一次授权拒绝洗成"你没有数据"。
  const denied = queryError?.status === FORBIDDEN_STATUS
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  function handleCancel(examId: string) {
    void confirmDialog({ title: t('cancelConfirm') }).then((ok) => {
      if (ok) cancelMut.mutate(examId)
    })
  }

  function statusLabel(s: string) {
    if (s === 'pending' || s === 'attended' || s === 'canceled') {
      return t(EXAM_STATUS_KEYS[s as 'pending' | 'attended' | 'canceled']!)
    }
    return s || t('status.unknown')
  }

  return (
    <div className="px-4 space-y-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ClipboardList className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {queryError && !denied && <Alert variant="danger" description={queryError.message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : denied ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center">
          <Lock className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium">{t('adminOnly.title')}</p>
          <p className="text-sm text-muted-foreground">{t('adminOnly.description')}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('columns.examName')}</th>
                  <th className="px-3 py-2 font-medium">{t('columns.signedAt')}</th>
                  <th className="px-3 py-2 font-medium">{t('columns.examTime')}</th>
                  <th className="px-3 py-2 font-medium">{t('columns.status')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('columns.action')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const sc = statusClsOf(r.status)
                  const canCancel = r.status === 'pending'
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        {r.examTitle ?? r.examId.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.signedAt ? dateFmt.format(new Date(r.signedAt)) : '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.examStartTime ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {dateFmt.format(new Date(r.examStartTime))}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                            sc,
                          )}
                        >
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canCancel ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={cancelMut.isPending}
                            onClick={() => handleCancel(r.examId)}
                          >
                            {t('cancelBtn')}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('total', { n: total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
