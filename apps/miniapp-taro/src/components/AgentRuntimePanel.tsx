import { useState, useCallback, useRef } from 'react'
import { View, Text, Textarea, Button, ScrollView } from '@tarojs/components'
import { executeAgentRuntimeStream } from '@ihui/api-client'
import { useI18n } from '@/i18n'

type AgentStatus = 'idle' | 'running' | 'completed' | 'failed'

interface PermissionEvent {
  mode: string
  toolName?: string
  dangerLevel?: string
  decision: string
}

export interface AgentRuntimePanelProps {
  sessionId?: string
}

export default function AgentRuntimePanel({ sessionId: initialSessionId }: AgentRuntimePanelProps) {
  const { t } = useI18n()
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)
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
        setError(err instanceof Error ? err.message : String(err))
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
    <View className="flex flex-col bg-white rounded-lg">
      <View className="flex items-center px-3 py-2 border-b border-gray-100">
        <Text className="text-sm font-semibold text-gray-800">
          {t('ai.agentDetail.runtimeTitle')}
        </Text>
        {sessionId && <Text className="ml-2 text-xs text-gray-400">#{sessionId.slice(0, 8)}</Text>}
        {status === 'running' && (
          <Text className="ml-2 text-xs text-blue-500">{t('ai.common.loading')}</Text>
        )}
        {status === 'completed' && <Text className="ml-2 text-xs text-emerald-600">✓</Text>}
        {status === 'failed' && <Text className="ml-2 text-xs text-red-500">✗</Text>}
        <View className="flex-1" />
        <Button
          size="mini"
          onClick={handleClear}
          disabled={status === 'running'}
          className="text-xs text-gray-500 bg-gray-50 rounded-md"
        >
          {t('ai.agentDetail.runtimeClear')}
        </Button>
      </View>

      <ScrollView scrollY className="p-3" style={{ maxHeight: '40vh', minHeight: '120px' }}>
        {plan && (
          <View className="mb-3 p-3 rounded-md bg-gray-50 border border-gray-100">
            <Text className="block mb-1.5 text-xs font-medium text-gray-500">
              {t('ai.agentDetail.runtimePlan')}
            </Text>
            <Text className="block text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">
              {plan}
            </Text>
          </View>
        )}

        {permission && (
          <View className="mb-3 p-3 rounded-md bg-amber-50 border border-amber-200">
            <Text className="block mb-1.5 text-xs font-medium text-amber-700">
              {t('ai.agentDetail.runtimePermission')}: {permission.decision}
            </Text>
            <Text className="block text-xs text-gray-600">
              {t('ai.agentDetail.runtimePermissionTool')}: {permission.toolName ?? 'unknown'} ·{' '}
              {t('ai.agentDetail.runtimePermissionLevel')}:{permission.dangerLevel ?? 'read'} ·{' '}
              {t('ai.agentDetail.runtimePermissionMode')}:{permission.mode}
            </Text>
          </View>
        )}

        {output && (
          <View className="mb-3">
            <Text className="block mb-1.5 text-xs font-medium text-gray-500">
              {t('ai.agentDetail.runtimeOutput')}
            </Text>
            <Text className="block text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
              {output}
            </Text>
          </View>
        )}

        {error && (
          <View className="mb-3 p-3 rounded-md bg-red-50 border border-red-200">
            <Text className="block mb-1 text-xs font-medium text-red-700">
              {t('ai.agentDetail.runtimeError')}
            </Text>
            <Text className="block text-xs text-red-600">{error}</Text>
          </View>
        )}

        {!plan && !output && !error && !permission && (
          <View className="py-8 text-center">
            <Text className="text-sm text-gray-400">{t('ai.agentDetail.runtimeEmpty')}</Text>
          </View>
        )}
      </ScrollView>

      <View className="p-3 border-t border-gray-100">
        <View className="flex items-end">
          <Textarea
            value={input}
            onInput={(e) => setInput(e.detail.value)}
            placeholder={t('ai.agentDetail.runtimeInputPlaceholder')}
            disabled={status === 'running'}
            maxlength={-1}
            className="flex-1 min-h-[60px] p-2 text-sm rounded-md border border-gray-200 bg-white"
          />
          {status === 'running' ? (
            <Button
              onClick={handleStop}
              className="ml-2 h-9 px-3 text-xs text-white bg-red-500 rounded-md"
            >
              {t('ai.agentDetail.runtimeStop')}
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              className="ml-2 h-9 px-3 text-xs text-white bg-[var(--color-primary)] rounded-md"
            >
              {t('ai.agentDetail.runtimeSend')}
            </Button>
          )}
        </View>
      </View>
    </View>
  )
}
