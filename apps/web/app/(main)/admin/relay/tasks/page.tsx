// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 号池任务中心(2026-10-27 立,号池对标缺口清单第 4 项,机主定案「观测面+手动触发」)。
 *
 * 数据源 GET /api/admin/relay/account-pool/tasks(四载体聚合:bullmq×3/guardian×2/
 * schtasks×1/apscheduler×1);不新造调度器、不落执行历史表(服务端 relay-task-center.ts
 * 边界定案)。每行:任务名/载体徽章/频率/上次执行(成败色)/下次执行/触发按钮;
 * 状态源读不到 ⇒ 黄条如实显示未判定原因(§0.3 不冒绿)。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Play, RefreshCw } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { BackButton } from '@/components/common'
import { Button } from '@ihui/ui-react'

interface RelayTask {
  id: string
  name: string
  carrier: 'bullmq' | 'guardian' | 'schtasks' | 'apscheduler'
  schedule: string
  cron?: string
  triggerable: boolean
  note?: string
  schedulable: boolean
  sourceOk: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  lastRunOk: boolean | null
  lastRunDetail: string | null
  indeterminateReason: string | null
}

const CARRIER_LABEL: Record<RelayTask['carrier'], string> = {
  bullmq: 'BullMQ',
  guardian: 'guardian 守护',
  schtasks: '计划任务',
  apscheduler: 'ai-service',
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

export default function RelayTasksPage() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['relay-task-center'],
    queryFn: async () => {
      return apiOrThrow<{ tasks: RelayTask[] }>('/api/admin/relay/account-pool/tasks').then(
        (d) => d.tasks,
      )
    },
    refetchInterval: 60_000,
  })

  const runMut = useMutation({
    mutationFn: async (id: string) => {
      return apiOrThrow<{ id: string; detail: string }>(
        `/api/admin/relay/account-pool/tasks/${id}/run`,
        { method: 'POST' },
      )
    },
    onSuccess: (r) => toast.success(`已触发:${r.detail}`),
    onError: (e: Error) => toast.error(`触发失败:${e.message}`),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['relay-task-center'] }),
  })

  const tasks = query.data ?? []

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">号池任务中心</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            四类载体的周期任务一张表:上次执行/下次执行/成败。调度仍由各载体自己承载,此处只观测与手动触发。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BackButton />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            刷新
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 p-8 text-sm">
          <Loader2 className="size-4 animate-spin" /> 加载中…
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="px-3 py-2 font-medium">任务</th>
                <th className="px-3 py-2 font-medium">载体</th>
                <th className="px-3 py-2 font-medium">频率</th>
                <th className="px-3 py-2 font-medium">上次执行</th>
                <th className="px-3 py-2 font-medium">下次执行</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.name}</div>
                    {t.indeterminateReason && (
                      <div className="mt-1 text-xs text-amber-600">
                        ⚠ 未判定:{t.indeterminateReason}
                      </div>
                    )}
                    {!t.indeterminateReason && t.lastRunDetail && (
                      <div className="text-muted-foreground mt-1 text-xs">{t.lastRunDetail}</div>
                    )}
                    {t.note && (
                      <div className="text-muted-foreground mt-1 text-xs">出路:{t.note}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {CARRIER_LABEL[t.carrier]}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">{t.schedule}</td>
                  <td className="px-3 py-2">
                    <div>{fmtTime(t.lastRunAt)}</div>
                    {t.lastRunOk === false && (
                      <div className="text-xs text-red-600">失败:{t.lastRunDetail}</div>
                    )}
                    {t.lastRunOk === true && !t.indeterminateReason && (
                      <div className="text-xs text-emerald-600">正常</div>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {fmtTime(t.nextRunAt)}
                  </td>
                  <td className="px-3 py-2">
                    {t.triggerable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={runMut.isPending}
                        onClick={() => runMut.mutate(t.id)}
                      >
                        {runMut.isPending && runMut.variables === t.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Play className="size-4" />
                        )}
                        触发
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
