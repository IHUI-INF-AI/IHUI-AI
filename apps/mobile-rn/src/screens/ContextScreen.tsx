// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getContextCompressionStats,
  searchContextMentions,
  type ContextCompressionStats,
  type ContextMention,
} from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 上下文引擎概览(M3 补齐:web /context 只读能力的移动端原生入口)。
 * 数据源:GET /api/compression-stats(压缩统计)+ GET /api/mentions(提及检索)。
 * 编辑/订阅类能力由 M4 WebView 门户 /context 承载。
 */
export function ContextScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [stats, setStats] = useState<ContextCompressionStats | null>(null)
  const [query, setQuery] = useState('')
  const [mentions, setMentions] = useState<ContextMention[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  const dark = resolvedTheme === 'dark'

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getContextCompressionStats()
      if (!res.success || !res.data) throw new Error(res.error)
      setStats(res.data)
    } catch {
      Alert.alert(t('context.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  // 提及检索:400ms 防抖(对齐 AiWorldScreen 搜索模式)
  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        setSearching(true)
        try {
          const res = await searchContextMentions({ q: query.trim() || undefined, limit: 20 })
          setMentions(res.success && res.data ? res.data.mentions : [])
        } catch {
          setMentions([])
        } finally {
          setSearching(false)
        }
      })()
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  const pct = (v: number) => `${Math.round(v * 100)}%`

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-base font-medium">{t('context.title')}</Text>
        <TouchableOpacity
          onPress={() => void loadStats()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm text-blue-600 dark:text-blue-400">{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {loading ? (
          <Text className="mt-8 text-center text-sm text-gray-400">{t('common.loading')}</Text>
        ) : stats ? (
          <>
            {/* 统计卡片 */}
            <View className="flex-row gap-2">
              {[
                { label: t('context.totalEvents'), value: String(stats.totalEvents) },
                {
                  label: t('context.avgRatio'),
                  value: pct(stats.avgCompressionRatio),
                },
                {
                  label: t('context.avgQuality'),
                  value: pct(stats.avgQualityScore),
                },
              ].map((item) => (
                <View
                  key={item.label}
                  className="flex-1 rounded-lg border border-gray-200 p-3 dark:border-neutral-700"
                >
                  <Text className="text-lg font-semibold dark:text-neutral-100">{item.value}</Text>
                  <Text className="mt-0.5 text-[10px] text-gray-500 dark:text-neutral-400">
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* 最近压缩事件 */}
            {stats.recentEvents.length > 0 ? (
              <View className="mt-4">
                <Text className="text-xs font-medium text-gray-500 dark:text-neutral-400">
                  {t('context.recentEvents')}
                </Text>
                <View className="mt-2 gap-2">
                  {stats.recentEvents.slice(0, 10).map((ev, idx) => (
                    <View
                      key={`${ev.conversation_id}-${idx}`}
                      className="rounded-md border border-gray-200 px-3 py-2 dark:border-neutral-700"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="flex-1 text-xs dark:text-neutral-200" numberOfLines={1}>
                          {ev.conversation_id}
                        </Text>
                        <Text className="ml-2 text-[10px] text-gray-400">
                          {new Date(ev.timestamp).toLocaleString()}
                        </Text>
                      </View>
                      <Text className="mt-1 text-[10px] text-gray-500 dark:text-neutral-400">
                        {t('context.tokensRange', {
                          before: ev.tokens_before.toLocaleString(),
                          after: ev.tokens_after.toLocaleString(),
                          ratio: pct(ev.compression_ratio),
                          quality: pct(ev.quality_score),
                        })}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {/* 提及检索 */}
        <View className="mt-4">
          <Text className="text-xs font-medium text-gray-500 dark:text-neutral-400">
            {t('context.mentionsSearch')}
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('context.mentionsPlaceholder')}
            placeholderTextColor="#9ca3af"
            className="mt-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-neutral-700 dark:text-neutral-100"
          />
          {searching ? (
            <Text className="mt-3 text-center text-xs text-gray-400">{t('common.loading')}</Text>
          ) : mentions.length === 0 ? (
            <Text className="mt-3 text-center text-xs text-gray-400">{t('context.empty')}</Text>
          ) : (
            <View className="mt-2 gap-2">
              {mentions.map((m) => (
                <View
                  key={m.id}
                  className="rounded-md border border-gray-200 px-3 py-2 dark:border-neutral-700"
                >
                  <View className="flex-row items-center gap-2">
                    <View className="rounded bg-blue-50 px-1.5 py-0.5 dark:bg-blue-900/30">
                      <Text className="text-[10px] text-blue-600 dark:text-blue-300">{m.type}</Text>
                    </View>
                    <Text className="flex-1 text-xs font-medium dark:text-neutral-100" numberOfLines={1}>
                      {m.label}
                    </Text>
                  </View>
                  {m.detail ? (
                    <Text className="mt-1 text-[10px] text-gray-400" numberOfLines={1}>
                      {m.detail}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
