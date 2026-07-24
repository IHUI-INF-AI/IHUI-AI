import { useCallback, useRef, useState } from 'react'
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

  const statusDotClass =
    status === 'running'
      ? 'bg-primary'
      : status === 'completed'
        ? 'bg-success'
        : status === 'failed'
          ? 'bg-destructive'
          : 'bg-muted-foreground'

  return (
    <div className="flex flex-col gap-2" data-testid="agent-runtime-panel">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border border-border rounded-md bg-card text-xs">
        <span className="font-semibold text-xs">{t('nav.tabRuntime')}</span>
        {sessionId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="text-muted-foreground text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap max-w-[80px]"
                  data-testid="session-id"
                >
                  #{sessionId.slice(0, 8)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{sessionId}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusDotClass}`}
            aria-hidden
          />
          <span>{getStatusText(status)}</span>
        </span>
        <span className="flex-1" />
        <button
          type="button"
          className="bg-transparent border border-border rounded-md px-2 py-1 text-xs cursor-pointer text-muted-foreground shrink-0"
          onClick={handleClear}
          disabled={status === 'running'}
        >
          {t('agent.clear')}
        </button>
      </div>

      <div className="flex flex-col gap-2 min-h-[100px]">
        {plan && (
          <section className="px-2.5 py-2 border border-border rounded-md text-xs bg-muted">
            <div className="text-xs text-muted-foreground mb-1 font-medium">
              {t('agent.executePlan')}
            </div>
            <pre className="m-0 whitespace-pre-wrap text-xs leading-normal">{plan}</pre>
          </section>
        )}

        {permission && (
          <section className="px-2.5 py-2 border border-warning rounded-md text-xs bg-warning/10">
            <div className="text-xs text-muted-foreground mb-1 font-medium">
              {t('agent.permissionDecision') + ': '}
              {permission.decision}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('agent.tool') + ': '}
              {permission.toolName ?? 'unknown'} · {t('agent.level') + ':'}
              {permission.dangerLevel ?? 'read'} · {t('agent.mode') + ': '}
              {permission.mode}
            </div>
          </section>
        )}

        {output && (
          <section>
            <div className="text-xs text-muted-foreground mb-1 font-medium">
              {t('agent.output')}
            </div>
            <div className="px-2.5 py-2 text-sm leading-normal whitespace-pre-wrap break-words">
              {output}
            </div>
          </section>
        )}

        {error && (
          <section className="px-2.5 py-2 border border-destructive rounded-md text-xs bg-destructive/10 text-destructive">
            <div className="text-xs font-medium">{t('agent.error')}</div>
            <div className="mt-1 text-xs">{error}</div>
          </section>
        )}

        {!plan && !output && !error && !permission && (
          <div className="text-center text-muted-foreground text-xs px-2 py-5">
            {t('agent.inputTaskHint')}
          </div>
        )}
      </div>

      <div className="flex gap-1.5 items-stretch">
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
          className="flex-1 resize-none min-h-12 text-sm"
          data-testid="agent-runtime-input"
        />
        {status === 'running' ? (
          <button
            type="button"
            className="bg-destructive text-white border-none rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer shrink-0 self-stretch"
            onClick={handleStop}
            data-testid="agent-runtime-stop"
          >
            {t('agent.stop')}
          </button>
        ) : (
          <button
            type="button"
            className="bg-primary text-primary-foreground border-none rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer shrink-0 self-stretch"
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
