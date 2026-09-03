// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type ItemKind = 'news' | 'paper' | 'project' | 'tool' | 'app'
type TabKey = 'tools' | 'apps' | 'news'

/**
 * AI 世界条目 — 对齐后端 GET /api/ai-world 的 DTO 字段
 * (packages/api-client 旧 AiWorldItem 字段为 name/description/cover,与后端不一致,故端内声明)
 */
interface AiWorldEntry {
  id: string
  kind: ItemKind
  categoryId: string | null
  title: string
  summary: string | null
  url: string | null
  coverImage: string | null
  source: string
  sourceUrl: string | null
  publishedAt: string | null
  fetchedAt: string | null
  metadata: Record<string, unknown> | null
  viewCount: number
  likeCount: number
  trendingScore: number | null
  trendingMetrics: Record<string, unknown> | null
  trendingUpdatedAt: string | null
}

interface AiWorldCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort: number
}

interface AiWorldFeed {
  categories: AiWorldCategory[]
  tools: AiWorldEntry[]
  apps: AiWorldEntry[]
  news: AiWorldEntry[]
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'tools', label: '工具' },
  { key: 'apps', label: '应用' },
  { key: 'news', label: '资讯' },
]

export function AiWorldScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [feed, setFeed] = useState<AiWorldFeed | null>(null)
  const [tab, setTab] = useState<TabKey>('tools')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const dark = resolvedTheme === 'dark'

  // 按当前 Tab 从一次拉取的 feed 中取对应 kind 条目,切换 Tab 不发请求
  const items = useMemo<AiWorldEntry[]>(() => {
    if (!feed) return []
    if (tab === 'apps') return feed.apps
    if (tab === 'news') return feed.news
    return feed.tools
  }, [feed, tab])

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<AiWorldFeed>('/api/ai-world')
      if (res.success) setFeed(res.data)
      else setError(res.error || t('aiWorld.loadFailed'))
    } catch {
      setError(t('aiWorld.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  if (loading && !feed) {
    return (
      <View
        className={`flex-1 items-center justify-center ${dark ? 'bg-neutral-900' : 'bg-white'}`}
      >
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      {/* 顶栏:返回 + 标题 + 收藏/浏览历史入口(占位按钮,路由后续接入) */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-base font-medium">{t('aiWorld.title')}</Text>
        <View className="flex-row gap-3">
          <Text className="text-sm text-blue-600">{t('aiWorld.favorites')}</Text>
          <Text className="text-sm text-blue-600">{t('aiWorld.history')}</Text>
        </View>
      </View>

      {/* Tab:工具 / 应用 / 资讯 */}
      <View className="flex-row gap-2 px-4 pb-2">
        {TABS.map((item) => {
          const active = item.key === tab
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setTab(item.key)}
              className={`rounded-md px-3 py-1.5 ${active ? 'bg-blue-600' : ''}`}
            >
              <Text className={`text-sm ${active ? 'text-white' : 'text-gray-500'}`}>
                {t(`aiWorld.${item.key}`)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-center text-sm text-gray-500">{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setLoading(true)
              void load()
            }}
            className="rounded-md bg-gray-200 px-4 py-2"
          >
            <Text className="text-sm">{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={dark ? tokens.text.tertiary : tokens.text.secondary}
            />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-sm text-gray-500">{t('aiWorld.empty')}</Text>
              <Text className="mt-1 text-xs text-gray-400">{t('aiWorld.emptyHint')}</Text>
            </View>
          }
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View className="mb-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
              <View className="flex-row">
                {item.coverImage ? (
                  <Image
                    source={{ uri: item.coverImage }}
                    style={{ width: 64, height: 64, borderRadius: 8 }}
                  />
                ) : (
                  <View className="h-16 w-16 items-center justify-center rounded-md bg-gray-100 dark:bg-neutral-700">
                    <Text className="text-xs text-gray-400">{t('aiWorld.kindLabel')}</Text>
                  </View>
                )}
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium" numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.summary ? (
                    <Text className="mt-1 text-xs text-gray-500" numberOfLines={2}>
                      {item.summary}
                    </Text>
                  ) : null}
                  <View className="mt-2 flex-row items-center gap-3">
                    <Text className="text-xs text-gray-400">
                      {item.viewCount} {t('aiWorld.viewCount')}
                    </Text>
                    {item.source ? (
                      <Text className="text-xs text-gray-400">@{item.source}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
