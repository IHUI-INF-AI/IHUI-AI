// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Loader2, Play, Save } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatDigestScheduleView } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

function formatTime(value: string | null): string {
  if (!value) return '从未执行'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function DigestPanel({ accountId }: { accountId: string }) {
  const [enabled, setEnabled] = React.useState(false)
  const [hour, setHour] = React.useState('9')
  const [minute, setMinute] = React.useState('0')
  const [timezone, setTimezone] = React.useState('Asia/Shanghai')
  const [target, setTarget] = React.useState('')
  const [last, setLast] = React.useState<WechatDigestScheduleView | null>(null)
  const queryClient = useQueryClient()

  const scheduleQuery = useQuery({
    queryKey: ['wechat-hub', 'digest-schedule', accountId],
    queryFn: () => wechatHubApi.digestSchedule(accountId),
  })

  React.useEffect(() => {
    const schedule = scheduleQuery.data
    if (!schedule) return
    setLast(schedule)
    setEnabled(schedule.enabled)
    setHour(String(schedule.hour))
    setMinute(String(schedule.minute))
    setTimezone(schedule.timezone)
    setTarget(schedule.target)
  }, [scheduleQuery.data])

  const saveMutation = useMutation({
    mutationFn: () =>
      wechatHubApi.saveDigestSchedule(accountId, {
        enabled,
        hour: Number(hour) || 0,
        minute: Number(minute) || 0,
        timezone: timezone.trim() || 'Asia/Shanghai',
        target: target.trim(),
      }),
    onSuccess: (schedule) => {
      setLast(schedule)
      queryClient.setQueryData(['wechat-hub', 'digest-schedule', accountId], schedule)
      void scheduleQuery.refetch()
    },
  })
  const runMutation = useMutation({
    mutationFn: () => wechatHubApi.runDigest(accountId),
    onSuccess: (schedule) => {
      setLast(schedule)
      queryClient.setQueryData(['wechat-hub', 'digest-schedule', accountId], schedule)
      void scheduleQuery.refetch()
    },
  })

  const current = last ?? saveMutation.data ?? runMutation.data ?? scheduleQuery.data ?? null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-body">
          <Clock className="h-4 w-4" />
          定时日报
        </CardTitle>
        <CardDescription>
          进程内调度（不用 Windows
          计划任务）：每天到点生成跨会话日报并推送到目标；目标为空只生成不发送。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="wechat-digest-hour">小时</Label>
            <Input
              id="wechat-digest-hour"
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(event) => setHour(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wechat-digest-minute">分钟</Label>
            <Input
              id="wechat-digest-minute"
              type="number"
              min={0}
              max={59}
              value={minute}
              onChange={(event) => setMinute(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wechat-digest-timezone">时区</Label>
            <Input
              id="wechat-digest-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="Asia/Shanghai"
            />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch
              id="wechat-digest-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              size="sm"
            />
            <Label htmlFor="wechat-digest-enabled">启用</Label>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="wechat-digest-target">推送目标（可选）</Label>
          <Input
            id="wechat-digest-target"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="私聊 user_id / 群 chat_id；留空只生成不发送"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            保存计划
          </Button>
          <Button
            variant="outline"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1 h-4 w-4" />
            )}
            立即生成并发送
          </Button>
          {current?.lastRunAt ? (
            <span className="font-[weight:inherit] text-label text-muted-foreground">
              上次 {formatTime(current.lastRunAt)} · {current.lastStatus ?? '未知'}
            </span>
          ) : null}
        </div>
        {current ? (
          <div className="font-[weight:inherit] rounded-md bg-muted/40 px-3 py-2 text-label text-muted-foreground">
            每天 {String(current.hour).padStart(2, '0')}:{String(current.minute).padStart(2, '0')} ·{' '}
            {current.timezone} · {current.enabled ? '已启用' : '未启用'} ·{' '}
            {current.target ? `推送到 ${current.target}` : '目标为空，只生成不发送'}
          </div>
        ) : null}
        {saveMutation.isError ? (
          <Alert
            variant="danger"
            title="保存失败"
            description={
              saveMutation.error instanceof Error ? saveMutation.error.message : '未知错误'
            }
          />
        ) : null}
        {runMutation.isError ? (
          <Alert
            variant="danger"
            title="日报执行失败"
            description={
              runMutation.error instanceof Error ? runMutation.error.message : '未知错误'
            }
          />
        ) : null}
        {runMutation.isSuccess ? (
          <Alert
            variant="success"
            title="日报已执行"
            description={`状态：${current?.lastStatus ?? 'success'}`}
          />
        ) : null}
        {current?.lastError ? (
          <Alert variant="warning" title="上次错误" description={current.lastError} />
        ) : null}
        {!scheduleQuery.isLoading && !current ? (
          <Alert
            variant="info"
            title="尚未保存日报计划"
            description="设置时间与目标后点「保存计划」，API 进程内调度会自动执行。"
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
