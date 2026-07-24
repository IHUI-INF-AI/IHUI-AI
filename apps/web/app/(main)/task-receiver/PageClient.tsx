'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useTaskReceiver } from '@/hooks/use-task-receiver'
import type { TaskDispatch, TaskResult, TaskStatus } from '@ihui/shared'

const STATUS_STYLE: Record<TaskStatus, { className: string; dot?: boolean }> = {
  pending: { className: 'text-muted-foreground' },
  running: { className: 'text-primary', dot: true },
  completed: { className: 'text-primary' },
  failed: { className: 'text-destructive' },
  cancelled: { className: 'text-muted-foreground' },
}

export default function TaskReceiverPageClient() {
  const t = useTranslations('taskReceiver')
  const tNav = useTranslations('nav')
  const locale = useLocale()
  const token = useAuthStore((s) => s.token)
  const { tasks, isConnected, deviceId, downloadAttachment } = useTaskReceiver(token)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const timeFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const onExecute = async (task: TaskDispatch) => {
    setBusyId(task.id)
    setMsg('')
    try {
      const output = `[web] executed: ${task.command}`
      const res = await fetchApi<TaskResult>('/api/tasks/result', {
        method: 'POST',
        body: JSON.stringify({ taskId: task.id, status: 'completed', output }),
      })
      setMsg(
        res.success
          ? t('executed', { id: task.id.slice(0, 8) })
          : t('callbackFailed', { error: res.error }),
      )
    } catch (err) {
      setMsg(`${t('errorPrefix')}: ${(err as Error).message}`)
    } finally {
      setBusyId(null)
    }
  }

  const onCopyDeviceId = async () => {
    try {
      await navigator.clipboard?.writeText(deviceId)
      setMsg(t('deviceIdCopied', { id: deviceId }))
    } catch {
      setMsg(t('deviceIdShow', { id: deviceId }))
    }
  }

  const onDownload = (taskId: string) => {
    const r = downloadAttachment(taskId)
    setMsg(r.message)
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {tNav('agents')} · {t('title')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopyDeviceId}
            className="rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            {t('deviceLabel')} {deviceId.slice(0, 8)}…
          </button>
          <span className={`text-xs ${isConnected ? 'text-primary' : 'text-muted-foreground'}`}>
            {isConnected ? t('wsConnected') : t('wsDisconnected')}
          </span>
        </div>
      </header>

      {msg && <p className="mb-2 text-xs text-muted-foreground">{msg}</p>}

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-12 py-12 text-center text-muted-foreground">
          {t('emptyWaiting')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => {
            const st = STATUS_STYLE[task.status] ?? { className: 'text-muted-foreground' }
            const canRun = task.status === 'pending' || task.status === 'failed'
            return (
              <div
                key={task.id}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="break-all text-[13px]">{task.command}</code>
                  <span className={`flex shrink-0 items-center gap-1 text-xs ${st.className}`}>
                    {st.dot && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                    {t(`status.${task.status}` as const)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>
                    {t('source')}: {task.fromDevice}
                  </span>
                  <span>
                    {t('target')}: {task.toDevice}
                  </span>
                  <span>{timeFmt.format(new Date(task.createdAt))}</span>
                </div>
                {task.result?.output && (
                  <div className="rounded-md bg-muted p-1.5 text-xs text-muted-foreground">
                    {task.result.output}
                  </div>
                )}
                {(canRun || task.filePayload) && (
                  <div className="flex gap-2">
                    {canRun && (
                      <button
                        type="button"
                        onClick={() => onExecute(task)}
                        disabled={busyId === task.id}
                        className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        {busyId === task.id ? t('loading') : t('execute')}
                      </button>
                    )}
                    {task.filePayload && (
                      <button
                        type="button"
                        onClick={() => onDownload(task.id)}
                        className="rounded-md border border-border px-3 py-1 text-xs transition-colors hover:bg-muted"
                      >
                        {task.filePayload.filename}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
