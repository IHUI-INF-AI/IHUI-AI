// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text, Pressable, ScrollView } from 'react-native'
import { tokens } from '../theme/active-tokens'
import { Check, X } from 'lucide-react-native'
import { permissionDecisionWord, useAgentRuntime, toolDisplayKey } from '@ihui/shared'
// D111:审批面板的档名与首屏交代行同源取词(permissionTierWordKeys → @ihui/types 唯一真源),
// 认不出的档位落 unknown,绝不静默显示成 default。
import { permissionTierWordKeys } from '@ihui/shared/chat'
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

  // 界面禁止直显英文工具码名:内置工具映射为本地化功能名,插件/MCP 动态名回落原样
  const permToolKey = permission?.toolName ? toolDisplayKey(permission.toolName) : null
  const permToolLabel = permission?.toolName
    ? permToolKey
      ? t(`taskStatus.${permToolKey}`)
      : permission.toolName
    : 'unknown'

  return (
    <View className="flex-1 bg-white dark:bg-neutral-900">
      <View className="flex-row items-center border-b border-gray-100 dark:border-neutral-700 px-3 py-2">
        <Text className="text-sm font-semibold text-gray-800 dark:text-neutral-100">{t('agent.runtimeTitle')}</Text>
        {sessionId ? (
          <Text className="ml-2 text-xs text-gray-400 dark:text-neutral-500" numberOfLines={1}>
            #{sessionId.slice(0, 8)}
          </Text>
        ) : null}
        {status === 'running' ? <Loading size="sm" className="ml-2" /> : null}
        {status === 'completed' ? <Check size={12} color={tokens.success.deep} /> : null}
        {status === 'failed' ? <X size={12} color={tokens.danger.bright} /> : null}
        <View className="flex-1" />
        <Pressable
          onPress={handleClear}
          disabled={status === 'running'}
          className="rounded-md bg-gray-50 dark:bg-neutral-800 px-2 py-1"
        >
          <Text className="text-xs text-gray-500 dark:text-neutral-400">{t('agent.runtimeClear')}</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-3 py-3">
        {plan ? (
          <View className="mb-3 rounded-md border border-gray-100 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 p-3">
            <Text className="mb-1.5 text-xs font-medium text-gray-500 dark:text-neutral-400">
              {t('agent.runtimePlan')}
            </Text>
            <Text className="text-xs leading-relaxed text-gray-700 dark:text-neutral-300">{plan}</Text>
          </View>
        ) : null}

        {permission ? (
          <View className="mb-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900 p-3">
            <Text className="mb-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              {t('agent.runtimePermission')}:{' '}
              {permissionDecisionWord(permission.decision, (k) => t(`stepDecision.${k}`))}
            </Text>
            <Text className="text-xs text-gray-600 dark:text-neutral-300">
              {t('agent.runtimePermissionTool')}: {permToolLabel} ·{' '}
              {t('agent.runtimePermissionLevel')}: {permission.dangerLevel ?? 'read'} ·{' '}
              {t('agent.runtimePermissionMode')}: {t(permissionTierWordKeys(permission.mode).title)}
            </Text>
          </View>
        ) : null}

        {output ? (
          <View className="mb-3">
            <Text className="mb-1.5 text-xs font-medium text-gray-500 dark:text-neutral-400">
              {t('agent.runtimeOutput')}
            </Text>
            <Text className="text-sm leading-relaxed text-gray-800 dark:text-neutral-100">{output}</Text>
          </View>
        ) : null}

        {error ? (
          <View className="mb-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900 p-3">
            <Text className="mb-1 text-xs font-medium text-red-700 dark:text-red-300">{t('agent.runtimeError')}</Text>
            <Text className="text-xs text-red-600 dark:text-red-300">{error}</Text>
          </View>
        ) : null}

        {!plan && !output && !error && !permission ? (
          <View className="items-center py-8">
            <Text className="text-sm text-gray-400 dark:text-neutral-500">{t('agent.runtimeEmpty')}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View className="border-t border-gray-100 dark:border-neutral-700 p-3">
        <View className="flex-row items-end">
          <Input
            value={input}
            onChangeText={setInput}
            placeholder={t('agent.runtimeInputPlaceholder')}
            editable={status !== 'running'}
            multiline
            className="h-auto min-h-[120px] min-h-[60px] flex-1 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 text-sm text-gray-900 dark:text-neutral-100"
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
              className="ml-2 h-9 items-center justify-center rounded-md bg-orange-500 px-3 disabled:opacity-40"
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
