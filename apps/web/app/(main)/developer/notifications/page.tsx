'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bell,
  Loader2,
  Save,
  AlertTriangle,
  Webhook,
  Gauge,
  FileText,
  CreditCard,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button, Label, Switch } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface NotificationPrefs {
  apiError: boolean
  quotaWarning: boolean
  webhookFailure: boolean
  weeklyReport: boolean
  versionUpdate: boolean
  billingReminder: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  apiError: true,
  quotaWarning: true,
  webhookFailure: true,
  weeklyReport: false,
  versionUpdate: false,
  billingReminder: true,
}

const PREF_GROUPS: Array<{
  key: keyof NotificationPrefs
  label: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { key: 'apiError', label: 'API 异常告警', desc: '接口错误率超阈值时通知', icon: AlertTriangle },
  { key: 'quotaWarning', label: '额度告警', desc: '配额使用达 80% 时通知', icon: Gauge },
  { key: 'webhookFailure', label: 'Webhook 失败', desc: '回调发送失败时通知', icon: Webhook },
  { key: 'weeklyReport', label: '周报推送', desc: '每周一发送调用统计摘要', icon: FileText },
  { key: 'versionUpdate', label: '版本更新', desc: 'API 新版本或废弃提醒', icon: AlertTriangle },
  { key: 'billingReminder', label: '账单提醒', desc: '订阅到期或扣费提醒', icon: CreditCard },
]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function NotificationsPage() {
  const [prefs, setPrefs] = React.useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    api<{ preferences?: NotificationPrefs }>('/api/developer/notifications')
      .then((d) => {
        if (d.preferences) setPrefs({ ...DEFAULT_PREFS, ...d.preferences })
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const saveMut = useMutation({
    mutationFn: () =>
      api('/api/developer/notifications', {
        method: 'PUT',
        body: JSON.stringify({ preferences: prefs }),
      }),
    onSuccess: () => toast.success('设置已保存'),
    onError: (e: Error) => toast.error(e.message),
  })

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Bell className="h-5 w-5 text-primary" />
          通知设置
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">管理开发者事件通知偏好</p>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {PREF_GROUPS.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.key} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <Label className="text-sm font-medium">{item.label}</Label>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={prefs[item.key]}
                  onCheckedChange={(v) => setPrefs({ ...prefs, [item.key]: v })}
                />
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          保存设置
        </Button>
        {saveMut.isSuccess && (
          <span className="text-xs text-emerald-600 dark:text-emerald-500">已保存</span>
        )}
      </div>

      {saveMut.isError && <Alert variant="danger" description={(saveMut.error as Error).message} />}
    </div>
  )
}
