'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, Play, Loader2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import {
  fetchActiveDispatches,
  fetchDispatchDag,
  fetchDispatchQuotas,
  fetchDispatchMessages,
  cancelDispatch,
  resumeDispatch,
} from '@/lib/subagents-api'
import { DagGraph } from '@/components/subagents/DagGraph'
import { AgentMessageList } from '@/components/subagents/AgentMessageList'
import type { DispatchStatus, AgentRole, DispatchPriority } from '@ihui/shared/subagents/index'

const STATUS_BADGE: Record<DispatchStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  cancelled: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}
const STATUS_LABEL: Record<DispatchStatus, string> = {
  pending: '等待',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  paused: '已暂停',
}
const ROLE_LABEL: Record<AgentRole, string> = {
  researcher: '研究员',
  coder: '编码员',
  reviewer: '评审员',
  architect: '架构师',
  debugger: '调试员',
}
const PRIORITY_LABEL: Record<DispatchPriority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function QuotaBar({ label, used, total, unit }: { label: string; used: number; total: number; unit: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const barColor = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {used.toLocaleString()} / {total.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-muted">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function SubagentDetailClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()
  const qc = useQueryClient()

  const activeQ = useQuery({
    queryKey: ['subagents', 'active'],
    queryFn: fetchActiveDispatches,
    refetchInterval: 5000,
  })
  const dagQ = useQuery({ queryKey: ['subagents', id, 'dag'], queryFn: () => fetchDispatchDag(id), enabled: !!id })
  const quotasQ = useQuery({ queryKey: ['subagents', id, 'quotas'], queryFn: () => fetchDispatchQuotas(id), enabled: !!id })
  const msgsQ = useQuery({
    queryKey: ['subagents', id, 'messages'],
    queryFn: () => fetchDispatchMessages(id),
    enabled: !!id,
    refetchInterval: 3000,
  })

  const dispatch = activeQ.data?.dispatches.find((d) => d.id === id)

  const cancelMut = useMutation({
    mutationFn: () => cancelDispatch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subagents'] }),
  })
  const resumeMut = useMutation({
    mutationFn: () => resumeDispatch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subagents'] }),
  })

  if (!id) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">缺少派单 ID 参数</div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <button
        type="button"
        onClick={() => router.push('/subagents')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </button>

      <Card>
        <CardHeader className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">{dispatch?.goal ?? `派单 ${id}`}</CardTitle>
              <p className="text-xs text-muted-foreground">ID: {id}</p>
            </div>
            {dispatch && (
              <div className="flex gap-2">
                {dispatch.status === 'paused' && (
                  <Button size="sm" variant="outline" disabled={resumeMut.isPending} onClick={() => resumeMut.mutate()}>
                    {resumeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    恢复
                  </Button>
                )}
                {(dispatch.status === 'pending' || dispatch.status === 'running' || dispatch.status === 'paused') && (
                  <Button size="sm" variant="outline" disabled={cancelMut.isPending} onClick={() => cancelMut.mutate()}>
                    {cancelMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                    取消
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {!dispatch ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {activeQ.isLoading ? '加载中...' : '派单不存在或已结束(不在活跃列表)'}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">状态</p>
                <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[dispatch.status]}`}>
                  {STATUS_LABEL[dispatch.status]}
                </span>
              </div>
              {dispatch.agentRole && (
                <div>
                  <p className="text-xs text-muted-foreground">角色</p>
                  <p className="mt-1 text-sm">{ROLE_LABEL[dispatch.agentRole]}</p>
                </div>
              )}
              {dispatch.priority && (
                <div>
                  <p className="text-xs text-muted-foreground">优先级</p>
                  <p className="mt-1 text-sm">{PRIORITY_LABEL[dispatch.priority]}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">创建时间</p>
                <p className="mt-1 text-sm tabular-nums">{dateFmt.format(new Date(dispatch.createdAt))}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm">DAG 可视化</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {dagQ.isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中...
              </div>
            ) : (
              <DagGraph dag={dagQ.data} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm">资源配额</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {quotasQ.isLoading || !quotasQ.data ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {quotasQ.isLoading ? '加载中...' : '无配额数据'}
              </p>
            ) : (
              <div className="space-y-3">
                <QuotaBar label="时间" used={quotasQ.data.used.elapsedMs} total={quotasQ.data.quota.timeoutMs} unit="ms" />
                <QuotaBar label="Token" used={quotasQ.data.used.tokensUsed} total={quotasQ.data.quota.tokenQuota} unit="" />
                <QuotaBar label="重试" used={quotasQ.data.used.retriesUsed} total={quotasQ.data.quota.maxRetries} unit="次" />
                {quotasQ.data.exceeded && (
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400">⚠ 配额已超限</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AgentMessageList messages={msgsQ.data?.messages} isLoading={msgsQ.isLoading} />
    </div>
  )
}
