import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { executeAgentRuntimeStream } from '@ihui/api-client'

interface AgentRuntimePanelProps {
  style?: CSSProperties
}

type AgentStatus = 'idle' | 'running' | 'completed' | 'failed'

interface PermissionEvent {
  mode: string
  toolName?: string
  dangerLevel?: string
  decision: string
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: '',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: 'var(--muted)',
  running: 'var(--accent)',
  completed: 'var(--accent)',
  failed: 'var(--danger)',
}

const sectionStyle: CSSProperties = {
  marginBottom: 12,
  padding: 12,
  border: '1px solid var(--border)',
  borderRadius: 6,
  backgroundColor: 'var(--muted-bg)',
}

const labelStyle: CSSProperties = {
  marginBottom: 6,
  fontSize: 12,
  color: 'var(--muted)',
  fontWeight: 500,
}

export function AgentRuntimePanel({ style }: AgentRuntimePanelProps) {
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<PermissionEvent | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleSend = useCallback(async () => {
    const message = input.trim()
    if (!message || status === 'running') return

    setStatus('running')
    setPlan(null)
    setOutput('')
    setError(null)
    setPermission(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await executeAgentRuntimeStream(
        { message, mode: 'default', sessionId: sessionId ?? undefined },
        {
          onSession: (data) => setSessionId(data.sessionId),
          onPlan: (data) => setPlan(data.plan),
          onDelta: (data) => setOutput((prev) => prev + data.content),
          onPermission: (data) => setPermission(data),
          onDone: (data) => {
            setStatus('completed')
            if (data.summary) setOutput(data.summary)
          },
          onError: (data) => {
            setError(data.message)
            setStatus('failed')
          },
        },
        { signal: controller.signal },
      )
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus('idle')
      } else {
        setError(String(err))
        setStatus('failed')
      }
    } finally {
      abortRef.current = null
    }
  }, [input, status, sessionId])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStatus('idle')
  }, [])

  const handleClear = useCallback(() => {
    setStatus('idle')
    setInput('')
    setSessionId(null)
    setPlan(null)
    setOutput('')
    setError(null)
    setPermission(null)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)',
        borderRadius: 8,
        backgroundColor: 'var(--bg)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>Agent Runtime</span>
        {sessionId ? (
          <span
            data-testid="session-id"
            title={sessionId}
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 120,
            }}
          >
            #{sessionId.slice(0, 8)}
          </span>
        ) : null}
        {status !== 'idle' ? (
          <span
            data-testid={`status-${status}`}
            style={{ fontSize: 12, color: STATUS_COLOR[status] }}
          >
            {STATUS_LABEL[status]}
          </span>
        ) : null}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleClear}
          disabled={status === 'running'}
          style={{ padding: '4px 10px', fontSize: 12 }}
        >
          清空
        </button>
      </header>

      <div
        style={{
          minHeight: 160,
          maxHeight: 320,
          overflowY: 'auto',
          padding: 12,
        }}
      >
        {plan ? (
          <section style={sectionStyle}>
            <div style={labelStyle}>执行计划</div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6 }}>
              {plan}
            </pre>
          </section>
        ) : null}

        {permission ? (
          <section
            style={{
              ...sectionStyle,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
            }}
          >
            <div style={{ ...labelStyle, color: '#b45309' }}>权限决策:{permission.decision}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              工具:{permission.toolName ?? 'unknown'} · 等级:
              {permission.dangerLevel ?? 'read'} · 模式:{permission.mode}
            </div>
          </section>
        ) : null}

        {output ? (
          <section style={{ marginBottom: 12 }}>
            <div style={labelStyle}>输出</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{output}</div>
          </section>
        ) : null}

        {error ? (
          <section
            style={{
              ...sectionStyle,
              borderColor: 'var(--danger)',
              backgroundColor: 'var(--danger-bg)',
            }}
          >
            <div style={{ ...labelStyle, color: 'var(--danger)' }}>错误</div>
            <div style={{ fontSize: 12 }}>{error}</div>
          </section>
        ) : null}

        {!plan && !output && !error && !permission ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 120,
              fontSize: 13,
              color: 'var(--muted)',
            }}
          >
            输入任务,开始 Agent 执行
          </div>
        ) : null}
      </div>

      <footer
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          padding: 12,
          borderTop: '1px solid var(--border)',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder="输入任务..."
          disabled={status === 'running'}
          rows={2}
          style={{
            flex: 1,
            minWidth: 0,
            resize: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            backgroundColor: 'var(--bg)',
            padding: '6px 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
            opacity: status === 'running' ? 0.5 : 1,
          }}
        />
        {status === 'running' ? (
          <button
            type="button"
            onClick={handleStop}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              color: '#ffffff',
              backgroundColor: 'var(--danger)',
              border: '1px solid var(--danger)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            停止
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              color: 'var(--accent-fg)',
              backgroundColor: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              opacity: input.trim() ? 1 : 0.4,
            }}
          >
            执行
          </button>
        )}
      </footer>
    </div>
  )
}

export default AgentRuntimePanel
