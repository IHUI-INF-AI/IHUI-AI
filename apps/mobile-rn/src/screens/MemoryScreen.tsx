// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import type { MemoryEntry, MemoryEntryType, MemoryScope } from '@ihui/types'
import { useAuthStore } from '../stores/auth-store'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** GET /api/memory 响应(对标 web @/lib/memory-api MemoryListResponse) */
interface MemoryListResponse {
  entries: MemoryEntry[]
  total: number
}

/** DELETE /api/memory/:id 响应 */
interface MemoryDeleteResponse {
  id: string
  deleted: boolean
}

const SCOPE_KEYS: Record<MemoryScope, string> = {
  global: 'memory.scope.global',
  user: 'memory.scope.user',
  session: 'memory.scope.session',
  project: 'memory.scope.project',
}

const TYPE_KEYS: Record<MemoryEntryType, string> = {
  preference: 'memory.type.preference',
  convention: 'memory.type.convention',
  decision: 'memory.type.decision',
  fact: 'memory.type.fact',
  feedback: 'memory.type.feedback',
  skill_ref: 'memory.type.skill_ref',
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatTime(iso: string): string {
  try {
    return timeFormatter.format(new Date(iso))
  } catch {
    return iso
  }
}

/**
 * 记忆列表(M3 补齐:web /memory 在移动端的原生入口)。
 * 数据源:GET /api/memory(聚合当前用户全部 scope),删除走 DELETE /api/memory/:id。
 */
export function MemoryScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const user = useAuthStore((s) => s.user)
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<MemoryListResponse>('/api/memory')
      if (!res.success) throw new Error(res.error)
      setEntries(res.data.entries)
    } catch {
      setError(t('memory.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onDelete = (entry: MemoryEntry) => {
    Alert.alert(t('memory.deleteTitle'), t('memory.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          try {
            const res = await fetchApi<MemoryDeleteResponse>(
              `/api/memory/${encodeURIComponent(entry.id)}`,
              { method: 'DELETE' },
            )
            if (!res.success) throw new Error(res.error)
            setEntries((prev) => prev.filter((e) => e.id !== entry.id))
            setExpandedId((cur) => (cur === entry.id ? null : cur))
          } catch {
            Alert.alert(t('memory.deleteFailed'))
          } finally {
            setDeleting(false)
          }
        },
      },
    ])
  }

  const renderEntry = ({ item }: { item: MemoryEntry }) => {
    const expanded = expandedId === item.id
    return (
      <View className="mb-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
        <TouchableOpacity onPress={() => setExpandedId(expanded ? null : item.id)}>
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className="text-base font-medium" numberOfLines={1}>
              {item.category}
            </Text>
            <View className="rounded-sm bg-gray-100 px-1.5 py-0.5 dark:bg-neutral-700">
              <Text className="text-[10px] text-gray-500">{t(TYPE_KEYS[item.type])}</Text>
            </View>
            <View className="rounded-sm bg-gray-100 px-1.5 py-0.5 dark:bg-neutral-700">
              <Text className="text-[10px] text-gray-500">{t(SCOPE_KEYS[item.scope])}</Text>
            </View>
          </View>
          <Text
            className="mt-1 text-xs leading-relaxed text-gray-500"
            numberOfLines={expanded ? undefined : 3}
          >
            {item.text}
          </Text>
          <Text className="mt-2 text-[11px] text-gray-400">
            {t('memory.source')}: {item.source} · {t('memory.updatedAt')}: {formatTime(item.updatedAt)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(item)}
          disabled={deleting}
          className="mt-2 self-start rounded-md border border-red-200 px-2 py-1"
        >
          <Text className="text-xs text-red-500">{t('memory.delete')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading) {
    return (
      <View
        className={`flex-1 items-center justify-center ${resolvedTheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}
      >
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </View>
    )
  }

  if (!user) {
    return (
      <View
        className={`flex-1 items-center justify-center ${resolvedTheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}
      >
        <Text className="text-sm text-gray-500">{t('memory.loginRequired')}</Text>
      </View>
    )
  }

  return (
    <View className={`flex-1 ${resolvedTheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-base font-medium">{t('memory.title')}</Text>
        <Text className="text-sm text-gray-500">({entries.length})</Text>
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
          data={entries}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                void load()
              }}
            />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-sm text-gray-500">{t('memory.empty')}</Text>
              <Text className="mt-1 text-xs text-gray-400">{t('memory.emptyHint')}</Text>
            </View>
          }
          contentContainerStyle={{ padding: 16 }}
          renderItem={renderEntry}
        />
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
