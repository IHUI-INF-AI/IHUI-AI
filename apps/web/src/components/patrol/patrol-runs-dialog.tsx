// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 巡检历史弹窗(2026-09-17 立,P3 #40)。
 * 展示单条巡检任务的执行历史(patrol_runs):判定徽章(ok/issue/error)+
 * 摘要 + 时间;issue 行提供「打开会话」深链到告警对话。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { listPatrolRuns, type PatrolTask, type PatrolRunStatus } from '@ihui/api-client'

/** 判定状态 → i18n 键(静态映射) */
const RUN_STATUS_KEYS: Record<PatrolRunStatus, 'resultOk' | 'resultIssue' | 'resultError'> = {
  ok: 'resultOk',
  issue: 'resultIssue',
  error: 'resultError',
}

const RUN_STATUS_BADGE_CLASS: Record<PatrolRunStatus, string> = {
  ok: 'border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15',
  issue: 'border-transparent bg-amber-500/15 text-amber-600 hover:bg-amber-500/15',
  error: 'border-transparent bg-destructive/15 text-destructive hover:bg-destructive/15',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: PatrolTask | null
}

export function PatrolRunsDialog({ open, onOpenChange, task }: Props) {
  const t = useTranslations('patrol')
  const [items, setItems] = React.useState<
    {
      id: string
      status: PatrolRunStatus
      summary: string
      conversationId: string | null
      createdAt: string
    }[]
  >([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !task) return
    setLoading(true)
    setItems([])
    let cancelled = false
    listPatrolRuns(task.id, { limit: 30 })
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch(() => {
        /* 加载失败展示空态,不打断关闭 */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, task])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('runs.title')}
            {task ? `: ${task.name}` : ''}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('runs.loading')}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
            {t('runs.empty')}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((run) => (
              <div key={run.id} className="rounded-md border border-border bg-card p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={RUN_STATUS_BADGE_CLASS[run.status]}>
                    {t(RUN_STATUS_KEYS[run.status])}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(run.createdAt).toLocaleString()}
                  </span>
                  {run.status === 'issue' && run.conversationId && (
                    <Button variant="outline" size="xs" asChild className="ml-auto">
                      <Link href={`/chat?conversationId=${run.conversationId}`}>
                        {t('action.openConversation')}
                      </Link>
                    </Button>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">{run.summary}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
