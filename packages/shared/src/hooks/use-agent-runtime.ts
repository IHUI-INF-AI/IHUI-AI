import * as React from 'react'
import { executeAgentRuntimeStream } from '@ihui/api-client'
import type { AgentRuntimeStatus, AgentRuntimePermissionEvent } from '@ihui/types'

export interface UseAgentRuntimeReturn {
  status: AgentRuntimeStatus
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  sessionId: string | null
  plan: string | null
  output: string
  error: string | null
  permission: AgentRuntimePermissionEvent | null
  handleSend: () => Promise<void>
  handleStop: () => void
  handleClear: () => void
}

/**
 * Agent 运行时业务逻辑 Hook(跨端共享)。
 *
 * 两端(mobile-rn + miniapp-taro)AgentRuntimePanel 组件原本各自实现
 * 完全相同的 handleSend/handleStop/handleClear + 状态管理逻辑,提取为共享 hook 消除重复。
 *
 * 各端组件只需 import 此 hook + 渲染 UI,无需重复业务逻辑。
 *
 * @param initialSessionId 初始会话 ID(可选)
 */
export function useAgentRuntime(initialSessionId?: string): UseAgentRuntimeReturn {
  const [status, setStatus] = React.useState<AgentRuntimeStatus>('idle')
  const [input, setInput] = React.useState('')
  const [sessionId, setSessionId] = React.useState<string | null>(initialSessionId ?? null)
  const [plan, setPlan] = React.useState<string | null>(null)
  const [output, setOutput] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)
  const [permission, setPermission] = React.useState<AgentRuntimePermissionEvent | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  const handleSend = React.useCallback(async () => {
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
        setError(err instanceof Error ? err.message : String(err))
        setStatus('failed')
      }
    } finally {
      abortRef.current = null
    }
  }, [input, status, sessionId])

  const handleStop = React.useCallback(() => {
    abortRef.current?.abort()
    setStatus('idle')
  }, [])

  const handleClear = React.useCallback(() => {
    setStatus('idle')
    setInput('')
    setSessionId(null)
    setPlan(null)
    setOutput('')
    setError(null)
    setPermission(null)
  }, [])

  return {
    status,
    input,
    setInput,
    sessionId,
    plan,
    output,
    error,
    permission,
    handleSend,
    handleStop,
    handleClear,
  }
}
