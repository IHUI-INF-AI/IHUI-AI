import { View, Text, Pressable, ScrollView } from 'react-native'
import { useAgentRuntime } from '@ihui/shared'
import { useI18n } from '../i18n'

import { Input, Loading } from '@ihui/ui-native'
import type { AgentRuntimePanelProps } from '@ihui/ui-native'

export function AgentRuntimePanel({ sessionId: initialSessionId }: AgentRuntimePanelProps) {
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
    <View className="flex-1 bg-white">
      <View className="flex-row items-center border-b border-gray-100 px-3 py-2">
        <Text className="text-sm font-semibold text-gray-800">{t('agent.runtimeTitle')}</Text>
        {sessionId ? (
          <Text className="ml-2 text-xs text-gray-400" numberOfLines={1}>
            #{sessionId.slice(0, 8)}
          </Text>
        ) : null}
        {status === 'running' ? <Loading size="sm" className="ml-2" /> : null}
        {status === 'completed' ? <Text className="ml-2 text-xs text-emerald-600">✓</Text> : null}
        {status === 'failed' ? <Text className="ml-2 text-xs text-red-500">✗</Text> : null}
        <View className="flex-1" />
        <Pressable
          onPress={handleClear}
          disabled={status === 'running'}
          className="rounded-md bg-gray-50 px-2 py-1"
        >
          <Text className="text-xs text-gray-500">{t('agent.runtimeClear')}</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-3 py-3">
        {plan ? (
          <View className="mb-3 rounded-md border border-gray-100 bg-gray-50 p-3">
            <Text className="mb-1.5 text-xs font-medium text-gray-500">
              {t('agent.runtimePlan')}
            </Text>
            <Text className="text-xs leading-relaxed text-gray-700">{plan}</Text>
          </View>
        ) : null}

        {permission ? (
          <View className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <Text className="mb-1.5 text-xs font-medium text-amber-700">
              {t('agent.runtimePermission')}: {permission.decision}
            </Text>
            <Text className="text-xs text-gray-600">
              {t('agent.runtimePermissionTool')}: {permission.toolName ?? 'unknown'} ·{' '}
              {t('agent.runtimePermissionLevel')}: {permission.dangerLevel ?? 'read'} ·{' '}
              {t('agent.runtimePermissionMode')}: {permission.mode}
            </Text>
          </View>
        ) : null}

        {output ? (
          <View className="mb-3">
            <Text className="mb-1.5 text-xs font-medium text-gray-500">
              {t('agent.runtimeOutput')}
            </Text>
            <Text className="text-sm leading-relaxed text-gray-800">{output}</Text>
          </View>
        ) : null}

        {error ? (
          <View className="mb-3 rounded-md border border-red-200 bg-red-50 p-3">
            <Text className="mb-1 text-xs font-medium text-red-700">{t('agent.runtimeError')}</Text>
            <Text className="text-xs text-red-600">{error}</Text>
          </View>
        ) : null}

        {!plan && !output && !error && !permission ? (
          <View className="items-center py-8">
            <Text className="text-sm text-gray-400">{t('agent.runtimeEmpty')}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View className="border-t border-gray-100 p-3">
        <View className="flex-row items-end">
          <Input
            value={input}
            onChangeText={setInput}
            placeholder={t('agent.runtimeInputPlaceholder')}
            editable={status !== 'running'}
            multiline
            className="h-auto min-h-[120px] min-h-[60px] flex-1 rounded-md border border-gray-200 bg-white p-2 text-sm text-gray-900"
          />
          {status === 'running' ? (
            <Pressable
              onPress={handleStop}
              className="ml-2 h-9 items-center justify-center rounded-md bg-red-500 px-3"
            >
              <Text className="text-xs text-white">{t('agent.runtimeStop')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSend}
              disabled={!input.trim()}
              className="ml-2 h-9 items-center justify-center rounded-md bg-blue-500 px-3 disabled:opacity-40"
            >
              <Text className="text-xs text-white">{t('agent.runtimeSend')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  )
}

export default AgentRuntimePanel
