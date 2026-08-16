import { View, Text, Textarea, Button, ScrollView } from '@tarojs/components'
import { useAgentRuntime } from '@ihui/shared'
import { useI18n } from '@/i18n'
import type { AgentRuntimePanelProps } from '@ihui/types'

export default function AgentRuntimePanel({ sessionId: initialSessionId }: AgentRuntimePanelProps) {
  const { t } = useI18n()
  const {
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
  } = useAgentRuntime(initialSessionId)

  return (
    <View className="flex flex-col bg-card rounded-lg">
      <View className="flex items-center px-3 py-2 mb-2">
        <Text className="text-sm font-semibold text-foreground">
          {t('ai.agentDetail.runtimeTitle')}
        </Text>
        {sessionId && (
          <Text className="ml-2 text-xs text-muted-foreground">#{sessionId.slice(0, 8)}</Text>
        )}
        {status === 'running' && (
          <Text className="ml-2 text-xs text-primary">{t('ai.common.loading')}</Text>
        )}
        {status === 'completed' && <Text className="ml-2 text-xs text-emerald-600">✓</Text>}
        {status === 'failed' && <Text className="ml-2 text-xs text-destructive">✗</Text>}
        <View className="flex-1" />
        <Button
          size="mini"
          onClick={handleClear}
          disabled={status === 'running'}
          className="text-xs text-muted-foreground bg-muted rounded-md"
        >
          {t('ai.agentDetail.runtimeClear')}
        </Button>
      </View>

      <ScrollView scrollY className="" style={{ maxHeight: '40vh', minHeight: '120px' }}>
        <View className="p-3">
          {plan && (
            <View className="mb-3 p-3 rounded-md bg-muted border border-border">
              <Text className="block mb-1.5 text-xs font-medium text-muted-foreground">
                {t('ai.agentDetail.runtimePlan')}
              </Text>
              <Text className="block text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {plan}
              </Text>
            </View>
          )}

          {permission && (
            <View className="mb-3 p-3 rounded-md bg-amber-50 border border-amber-200">
              <Text className="block mb-1.5 text-xs font-medium text-amber-700">
                {t('ai.agentDetail.runtimePermission')}: {permission.decision}
              </Text>
              <Text className="block text-xs text-foreground">
                {t('ai.agentDetail.runtimePermissionTool')}: {permission.toolName ?? 'unknown'} ·{' '}
                {t('ai.agentDetail.runtimePermissionLevel')}:{permission.dangerLevel ?? 'read'} ·{' '}
                {t('ai.agentDetail.runtimePermissionMode')}:{permission.mode}
              </Text>
            </View>
          )}

          {output && (
            <View className="mb-3">
              <Text className="block mb-1.5 text-xs font-medium text-muted-foreground">
                {t('ai.agentDetail.runtimeOutput')}
              </Text>
              <Text className="block text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {output}
              </Text>
            </View>
          )}

          {error && (
            <View className="mb-3 p-3 rounded-md bg-destructive/10 border border-red-200">
              <Text className="block mb-1 text-xs font-medium text-red-700">
                {t('ai.agentDetail.runtimeError')}
              </Text>
              <Text className="block text-xs text-destructive">{error}</Text>
            </View>
          )}

          {!plan && !output && !error && !permission && (
            <View className="py-8 text-center">
              <Text className="text-sm text-muted-foreground">
                {t('ai.agentDetail.runtimeEmpty')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View className="p-3 mt-2">
        <View className="flex items-end">
          <Textarea
            value={input}
            onInput={(e) => setInput(e.detail.value)}
            placeholder={t('ai.agentDetail.runtimeInputPlaceholder')}
            disabled={status === 'running'}
            maxlength={-1}
            className="flex-1 min-h-[120rpx] p-2 text-sm rounded-md border border-border bg-card"
          />
          {status === 'running' ? (
            <Button
              onClick={handleStop}
              className="ml-2 h-9 px-3 text-xs text-white bg-destructive rounded-md"
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
