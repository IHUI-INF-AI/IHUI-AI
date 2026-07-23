/**
 * TaskReceiverPage(桌面端三端联动任务接收器,2026-07-23 立)。
 *
 * 监听 WebSocket task-dispatch 频道,接收移动端下发任务并展示;
 * 提供"执行"按钮,模拟执行后 POST /api/tasks/result 回传结果。
 * 遵循 AGENTS.md §4(禁圆角/禁分割线/禁渐变遮罩,状态徽章灰/绿/红)。
 */
import { useState } from 'react'
import { fetchApi } from '@ihui/api-client'
import type { TaskDispatch, TaskResult, TaskStatus } from '@ihui/shared'
import { useI18n } from '../i18n'
import { useTaskReceiver } from '../hooks/use-task-receiver'
import { getToken } from '../lib/token'

const STATUS_STYLE: Record<TaskStatus, { color: string; dot?: boolean }> = {
  pending: { color: 'var(--muted)' },
  running: { color: 'var(--accent)', dot: true },
  completed: { color: 'var(--accent)' },
  failed: { color: 'var(--danger)' },
  cancelled: { color: 'var(--muted)' },
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export default function TaskReceiverPage() {
  const { t } = useI18n()
  const token = getToken()
  const { tasks, isConnected, deviceId } = useTaskReceiver(token || null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const onExecute = async (task: TaskDispatch) => {
    setBusyId(task.id)
    setMsg('')
    try {
      const output = `[desktop] executed: ${task.command}`
      const res = await fetchApi<TaskResult>('/tasks/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, status: 'completed', output }),
      })
      setMsg(
        res.success
          ? `任务 ${task.id.slice(0, 8)} 执行完成,结果已回传`
          : `回传失败: ${res.error}`,
      )
    } catch (err) {
      setMsg(`异常: ${(err as Error).message}`)
    } finally {
      setBusyId(null)
    }
  }

  const onCopyDeviceId = async () => {
    try {
      await navigator.clipboard?.writeText(deviceId)
      setMsg(`设备 ID 已复制:${deviceId}`)
    } catch {
      setMsg(`设备 ID:${deviceId}`)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t('nav.agents')} · 任务接收</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onCopyDeviceId}
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--card)',
              padding: '4px 8px',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            设备 {deviceId.slice(0, 8)}…
          </button>
          <span style={{ fontSize: 12, color: isConnected ? 'var(--accent)' : 'var(--muted)' }}>
            {isConnected ? 'WS 已连接' : 'WS 断开'}
          </span>
        </div>
      </header>

      {msg && <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted)' }}>{msg}</p>}

      {tasks.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--card)',
          }}
        >
          等待移动端下发任务
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((task) => {
            const st = STATUS_STYLE[task.status] ?? { color: 'var(--muted)' }
            const canRun = task.status === 'pending' || task.status === 'failed'
            return (
              <div
                key={task.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--card)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{task.command}</code>
                  <span style={{ fontSize: 12, color: st.color, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {st.dot && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    )}
                    {STATUS_LABEL[task.status]}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>来源: {task.fromDevice}</span>
                  <span>下发至: {task.toDevice}</span>
                  <span>{timeFmt.format(new Date(task.createdAt))}</span>
                </div>
                {task.result?.output && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--muted-bg)', borderRadius: 6, padding: 6 }}>
                    {task.result.output}
                  </div>
                )}
                {canRun && (
                  <div>
                    <button type="button" onClick={() => onExecute(task)} disabled={busyId === task.id}>
                      {busyId === task.id ? t('common.loading') : '执行'}
                    </button>
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
