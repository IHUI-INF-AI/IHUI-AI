import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { executeAgentRuntimeStream } from '@ihui/api-client'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

type AgentStatus = 'idle' | 'running' | 'completed' | 'failed'

interface PermissionEvent {
  mode: string
  toolName?: string
  dangerLevel?: string
  decision: string
}

interface AgentRuntimePanelProps {
  agentId: string
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 8px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--card)',
  fontSize: 12,
}

const titleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: 12,
}

const sessionIdStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: 11,
  fontFamily: 'monospace',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 80,
}

const statusRowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  color: 'var(--muted)',
}

const statusDotBase: CSSProperties = {
  display: 'inline-block',
  width: 7,
  height: 7,
  borderRadius: '50%',
  flexShrink: 0,
}

const clearBtnStyle: CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 11,
  cursor: 'pointer',
  color: 'var(--muted)',
  flexShrink: 0,
}

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minHeight: 100,
}

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--muted)',
  fontSize: 12,
  padding: '20px 8px',
}

const sectionBaseStyle: CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 12,
}

const planStyle: CSSProperties = {
  ...sectionBaseStyle,
  background: 'var(--muted-bg)',
}

const permissionStyle: CSSProperties = {
  ...sectionBaseStyle,
  borderColor: '#f59e0b',
  background: 'rgba(245, 158, 11, 0.08)',
}

const errorSectionStyle: CSSProperties = {
  ...sectionBaseStyle,
  borderColor: 'var(--danger)',
  background: 'var(--danger-bg)',
  color: 'var(--danger)',
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--muted)',
  marginBottom: 4,
  fontWeight: 500,
}

const outputStyle: CSSProperties = {
  padding: '8px 10px',
  fontSize: 13,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const inputRowStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'stretch',
}

const textareaStyle: CSSProperties = {
  flex: 1,
  resize: 'none',
  minHeight: 48,
  fontFamily: 'inherit',
  fontSize: 13,
}

const primaryBtnStyle: CSSProperties = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  flexShrink: 0,
  alignSelf: 'stretch',
}

const dangerBtnStyle: CSSProperties = {
  ...primaryBtnStyle,
  background: 'var(--danger)',
}

const spacerStyle: CSSProperties = {
  flex: 1,
}

export function AgentRuntimePanel({ agentId }: AgentRuntimePanelProps) {
  const { t } = useI18n()
  const getStatusText = (status: AgentStatus) => {
    const map: Record<AgentStatus, string> = {
      idle: t('agent.statusIdle'),
      running: t('agent.statusRunning'),
      completed: t('agent.statusCompleted'),
      failed: t('agent.statusFailed'),
    }
    return map[status]
  }
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
        { message, mode: 'default', sessionId: sessionId ?? undefined, botId: agentId },
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
  }, [input, status, sessionId, agentId])

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

  const statusDotStyle: CSSProperties =
    status === 'running'
      ? { ...statusDotBase, background: 'var(--accent)' }
      : status === 'completed'
        ? { ...statusDotBase, background: '#16a34a' }
        : status === 'failed'
          ? { ...statusDotBase, background: 'var(--danger)' }
          : { ...statusDotBase, background: 'var(--muted)' }

  return (
    <div style={wrapperStyle} data-testid="agent-runtime-panel">
      <div style={headerStyle}>
        <span style={titleStyle}>{t('nav.tabRuntime')}</span>
        {sessionId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span style={sessionIdStyle} data-testid="session-id">
                  #{sessionId.slice(0, 8)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{sessionId}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span style={statusRowStyle}>
          <span style={statusDotStyle} aria-hidden />
          <span>{getStatusText(status)}</span>
        </span>
        <span style={spacerStyle} />
        <button
          type="button"
          style={clearBtnStyle}
          onClick={handleClear}
          disabled={status === 'running'}
        >
          {t('agent.clear')}
        </button>
      </div>

      <div style={bodyStyle}>
        {plan && (
          <section style={planStyle}>
            <div style={sectionTitleStyle}>{t('agent.executePlan')}</div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5 }}>
              {plan}
            </pre>
          </section>
        )}

        {permission && (
          <section style={permissionStyle}>
            <div style={sectionTitleStyle}>{t('agent.permissionDecision') + ': '}{permission.decision}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {t('agent.tool') + ': '}{permission.toolName ?? 'unknown'} · {t('agent.level') + ':'}
              {permission.dangerLevel ?? 'read'} · {t('agent.mode') + ': '}{permission.mode}
            </div>
          </section>
        )}

        {output && (
          <section>
            <div style={sectionTitleStyle}>{t('agent.output')}</div>
            <div style={outputStyle}>{output}</div>
          </section>
        )}

        {error && (
          <section style={errorSectionStyle}>
            <div style={{ fontSize: 11, fontWeight: 500 }}>{t('agent.error')}</div>
            <div style={{ marginTop: 4, fontSize: 11 }}>{error}</div>
          </section>
        )}

        {!plan && !output && !error && !permission && (
          <div style={emptyStyle}>{t('agent.inputTaskHint')}</div>
        )}
      </div>

      <div style={inputRowStyle}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder={t('agent.inputTaskPlaceholder')}
          disabled={status === 'running'}
          rows={2}
          style={textareaStyle}
          data-testid="agent-runtime-input"
        />
        {status === 'running' ? (
          <button
            type="button"
            style={dangerBtnStyle}
            onClick={handleStop}
            data-testid="agent-runtime-stop"
          >
            {t('agent.stop')}
          </button>
        ) : (
          <button
            type="button"
            style={primaryBtnStyle}
            onClick={handleSend}
            disabled={!input.trim()}
            data-testid="agent-runtime-send"
          >
            {t('agent.execute')}
          </button>
        )}
      </div>
    </div>
  )
}

export default AgentRuntimePanel
