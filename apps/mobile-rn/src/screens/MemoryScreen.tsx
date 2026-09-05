// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
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

/** POST /api/memory 请求体(对齐 apps/api routes/memory.ts createEntrySchema) */
interface MemoryCreateInput {
  scope: MemoryScope
  type: MemoryEntryType
  category: string
  text: string
  source: string
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

const SCOPES: readonly MemoryScope[] = ['global', 'user', 'session', 'project']
const TYPES: readonly MemoryEntryType[] = [
  'preference',
  'convention',
  'decision',
  'fact',
  'feedback',
  'skill_ref',
]

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

  // —— 筛选:scope 走服务端参数,type/关键词走前端过滤(与 web 列表页一致) ——
  const [scopeFilter, setScopeFilter] = useState<MemoryScope | null>(null)
  const [typeFilter, setTypeFilter] = useState<MemoryEntryType | null>(null)
  const [search, setSearch] = useState('')

  // —— 新建记忆 ——
  const [createVisible, setCreateVisible] = useState(false)
  const [newText, setNewText] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newType, setNewType] = useState<MemoryEntryType>('fact')
  const [newScope, setNewScope] = useState<MemoryScope>('user')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const qs = scopeFilter ? `?scope=${encodeURIComponent(scopeFilter)}` : ''
      const res = await fetchApi<MemoryListResponse>(`/api/memory${qs}`)
      if (!res.success) throw new Error(res.error)
      setEntries(res.data.entries)
    } catch {
      setError(t('memory.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t, scopeFilter])

  useEffect(() => {
    void load()
  }, [load])

  const visibleEntries = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false
      if (!kw) return true
      return e.text.toLowerCase().includes(kw) || e.category.toLowerCase().includes(kw)
    })
  }, [entries, typeFilter, search])

  const onCreate = async () => {
    if (!newText.trim()) {
      Alert.alert(t('memory.textRequired'))
      return
    }
    setSaving(true)
    try {
      const body: MemoryCreateInput = {
        scope: newScope,
        type: newType,
        category: newCategory.trim() || '未分类',
        text: newText.trim(),
        source: 'mobile-rn',
      }
      const res = await fetchApi<MemoryEntry>('/api/memory', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) throw new Error(res.error)
      setEntries((prev) => [res.data, ...prev])
      setCreateVisible(false)
      setNewText('')
      setNewCategory('')
      setNewType('fact')
      setNewScope('user')
    } catch {
      Alert.alert(t('memory.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

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
        <TouchableOpacity
          onPress={() => setCreateVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm font-medium text-blue-600">{t('memory.create')}</Text>
        </TouchableOpacity>
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
          data={visibleEntries}
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
          ListHeaderComponent={
            <View className="mb-3">
              {/* 搜索 */}
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('memory.searchPlaceholder')}
                placeholderTextColor="#9ca3af"
                returnKeyType="search"
                className="h-9 rounded-md border border-gray-200 px-3 text-sm dark:border-neutral-700 dark:text-neutral-100"
              />
              {/* scope chips */}
              <View className="mt-2 flex-row flex-wrap gap-2">
                <TouchableOpacity
                  onPress={() => setScopeFilter(null)}
                  className={`rounded-md px-3 py-1.5 ${scopeFilter === null ? 'bg-blue-600' : 'bg-gray-100 dark:bg-neutral-800'}`}
                >
                  <Text
                    className={`text-xs ${scopeFilter === null ? 'text-white' : 'text-gray-600 dark:text-neutral-300'}`}
                  >
                    {t('memory.all')}
                  </Text>
                </TouchableOpacity>
                {SCOPES.map((scope) => {
                  const active = scopeFilter === scope
                  return (
                    <TouchableOpacity
                      key={scope}
                      onPress={() => setScopeFilter(active ? null : scope)}
                      className={`rounded-md px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-gray-100 dark:bg-neutral-800'}`}
                    >
                      <Text
                        className={`text-xs ${active ? 'text-white' : 'text-gray-600 dark:text-neutral-300'}`}
                      >
                        {t(SCOPE_KEYS[scope])}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {/* type chips */}
              <View className="mt-2 flex-row flex-wrap gap-2">
                <TouchableOpacity
                  onPress={() => setTypeFilter(null)}
                  className={`rounded-md px-3 py-1.5 ${typeFilter === null ? 'bg-blue-600' : 'bg-gray-100 dark:bg-neutral-800'}`}
                >
                  <Text
                    className={`text-xs ${typeFilter === null ? 'text-white' : 'text-gray-600 dark:text-neutral-300'}`}
                  >
                    {t('memory.all')}
                  </Text>
                </TouchableOpacity>
                {TYPES.map((type) => {
                  const active = typeFilter === type
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setTypeFilter(active ? null : type)}
                      className={`rounded-md px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-gray-100 dark:bg-neutral-800'}`}
                    >
                      <Text
                        className={`text-xs ${active ? 'text-white' : 'text-gray-600 dark:text-neutral-300'}`}
                      >
                        {t(TYPE_KEYS[type])}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
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

      {/* 新建记忆 Modal */}
      <Modal visible={createVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-2xl bg-white p-4 dark:bg-neutral-800">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-medium">{t('memory.createTitle')}</Text>
              <TouchableOpacity
                onPress={() => setCreateVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-sm text-gray-500">{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={newText}
              onChangeText={setNewText}
              placeholder={t('memory.textPlaceholder')}
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="min-h-[96px] rounded-md border border-gray-200 p-3 text-sm dark:border-neutral-700 dark:text-neutral-100"
            />
            <TextInput
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder={t('memory.categoryPlaceholder')}
              placeholderTextColor="#9ca3af"
              className="mt-2 h-9 rounded-md border border-gray-200 px-3 text-sm dark:border-neutral-700 dark:text-neutral-100"
            />
            <Text className="mt-3 text-xs text-gray-500">{t('memory.typeLabel')}</Text>
            <View className="mt-1.5 flex-row flex-wrap gap-2">
              {TYPES.map((type) => {
                const active = newType === type
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setNewType(type)}
                    className={`rounded-md px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-gray-100 dark:bg-neutral-700'}`}
                  >
                    <Text className={`text-xs ${active ? 'text-white' : 'text-gray-600 dark:text-neutral-300'}`}>
                      {t(TYPE_KEYS[type])}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text className="mt-3 text-xs text-gray-500">{t('memory.scopeLabel')}</Text>
            <View className="mt-1.5 flex-row flex-wrap gap-2">
              {SCOPES.map((scope) => {
                const active = newScope === scope
                return (
                  <TouchableOpacity
                    key={scope}
                    onPress={() => setNewScope(scope)}
                    className={`rounded-md px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-gray-100 dark:bg-neutral-700'}`}
                  >
                    <Text className={`text-xs ${active ? 'text-white' : 'text-gray-600 dark:text-neutral-300'}`}>
                      {t(SCOPE_KEYS[scope])}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <TouchableOpacity
              onPress={() => void onCreate()}
              disabled={saving}
              className="mt-4 items-center rounded-md bg-blue-600 py-3"
            >
              <Text className="text-sm font-medium text-white">
                {saving ? t('common.loading') : t('memory.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
