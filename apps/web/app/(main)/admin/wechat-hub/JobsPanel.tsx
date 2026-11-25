// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Loader2, Play, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatJobView } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

const WEEKDAYS = ['每天', '周日', '周一', '周二', '周三', '周四', '周五', '周六']

function describe(job: WechatJobView): string {
  const day = job.weekly === null ? '每天' : (WEEKDAYS[job.weekly] ?? `周${job.weekly}`)
  const time = `${String(job.hour).padStart(2, '0')}:${String(job.minute).padStart(2, '0')}`
  if (job.kind === 'report') {
    const kindLabel =
      job.payload.reportKind === 'pair'
        ? '双人报告'
        : job.payload.reportKind === 'group'
          ? '群聊报告'
          : '年度报告'
    return `${day} ${time} · 生成${kindLabel}并推送到 ${job.payload.targets?.[0] ?? '（未设目标）'}`
  }
  const scope = job.payload.targets?.length
    ? `${job.payload.targets.length} 个指定目标`
    : job.payload.tags?.length
      ? `标签 ${job.payload.tags.join('、')}`
      : '全部联系人'
  return `${day} ${time} · 群发到${scope}`
}

export default function JobsPanel({ accountId }: { accountId: string }) {
  const qc = useQueryClient()
  const [kind, setKind] = React.useState<'broadcast' | 'report'>('broadcast')
  const [hour, setHour] = React.useState('9')
  const [minute, setMinute] = React.useState('30')
  const [weekly, setWeekly] = React.useState('every')
  const [text, setText] = React.useState('')
  const [targets, setTargets] = React.useState('')
  const [reportKind, setReportKind] = React.useState<'annual' | 'pair' | 'group'>('annual')
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const jobsQuery = useQuery({
    queryKey: ['wechat-hub', 'jobs', accountId],
    queryFn: () => wechatHubApi.jobs(accountId),
  })
  const jobs = jobsQuery.data ?? []

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['wechat-hub', 'jobs', accountId] })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const targetList = targets
        .split(/[\s,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
      return wechatHubApi.saveJob(accountId, {
        kind,
        hour: Number(hour),
        minute: Number(minute),
        weekly: weekly === 'every' ? null : Number(weekly),
        payload:
          kind === 'report' ? { reportKind, targets: targetList } : { text, targets: targetList },
      })
    },
    onSuccess: (job) => {
      setMessage(`已保存：${describe(job)}`)
      setError(null)
      refresh()
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : '保存定时任务失败')
      setMessage(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (job: WechatJobView) => wechatHubApi.toggleJob(accountId, job.id, !job.enabled),
    onSuccess: () => refresh(),
    onError: (e) => setError(e instanceof Error ? e.message : '切换失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => wechatHubApi.deleteJob(accountId, jobId),
    onSuccess: () => refresh(),
    onError: (e) => setError(e instanceof Error ? e.message : '删除失败'),
  })

  const runNowMutation = useMutation({
    mutationFn: () => wechatHubApi.runJobsNow(),
    onSuccess: (results) => {
      setMessage(
        results.length === 0
          ? '本轮没有到点的任务（只在设定分钟触发，不会补发）'
          : results
              .map((item) => `${item.jobId}：${item.ok ? '成功' : '失败'} ${item.detail}`)
              .join('；'),
      )
      setError(null)
      refresh()
    },
    onError: (e) => setError(e instanceof Error ? e.message : '执行失败'),
  })

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-body">
            <CalendarClock className="h-4 w-4 text-primary" />
            定时群发与定时报告
          </CardTitle>
          <CardDescription>
            按账号所在时区每天或每周固定时刻触发；执行时仍走白名单、敏感词、限流与审计，只读账号会被直接拒绝。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <Alert variant="danger" title="操作失败" description={error} /> : null}
          {message ? <Alert variant="info" title="执行结果" description={message} /> : null}

          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
            <div className="space-y-1">
              <Label>任务类型</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value === 'report' ? 'report' : 'broadcast')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broadcast">定时群发</SelectItem>
                  <SelectItem value="report">定时报告</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>星期</Label>
              <Select value={weekly} onValueChange={setWeekly}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((label, index) => (
                    <SelectItem key={label} value={index === 0 ? 'every' : String(index - 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>时</Label>
              <Input value={hour} onChange={(e) => setHour(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <Label>分</Label>
              <Input
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>

          {kind === 'broadcast' ? (
            <div className="space-y-1">
              <Label>群发正文</Label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-stroke-field bg-transparent px-3 py-2 text-sm"
                placeholder="到点发给每个目标；单条超过 4500 字会被截断"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label>报告类型</Label>
              <Select
                value={reportKind}
                onValueChange={(value) =>
                  setReportKind(value === 'pair' ? 'pair' : value === 'group' ? 'group' : 'annual')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">年度报告</SelectItem>
                  <SelectItem value="pair">双人报告</SelectItem>
                  <SelectItem value="group">群聊报告</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>目标（可选，逗号或换行分隔；留空=按标签/全部联系人）</Label>
            <Input
              value={targets}
              onChange={(e) => setTargets(e.target.value)}
              placeholder="wxid_xxx, 群名或会话标识"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              新增任务
            </Button>
            <Button
              variant="outline"
              onClick={() => runNowMutation.mutate()}
              disabled={runNowMutation.isPending}
            >
              {runNowMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              立刻扫一轮
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-body">已配置任务（{jobs.length}）</CardTitle>
          <CardDescription>同一分钟内只执行一次；服务重启不会补发当天错过的任务。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-sm text-muted-foreground">还没有定时任务。</div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stroke-field px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {job.kind === 'report' ? '定时报告' : '定时群发'}
                    <span className="ml-2 text-xs text-muted-foreground">{describe(job)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    最近执行{' '}
                    {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString('zh-CN') : '尚未执行'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleMutation.mutate(job)}>
                    {job.enabled ? '停用' : '启用'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(job.id)}
                    aria-label="删除任务"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
