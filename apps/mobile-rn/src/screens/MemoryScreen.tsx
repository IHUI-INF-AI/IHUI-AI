// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MemoryScreen 我的记忆(mobile-rn 端 wrapper)
 *
 * 2026-09-15 迁移:UI 与展示逻辑已下沉共享层 @ihui/rn-app MemoryScreen,
 * 本 wrapper 仅保留平台特定职责:
 * - 数据:fetchApi GET/POST/DELETE /api/memory(scope 服务端参数,type/关键词前端过滤)
 * - 新建:内容必填校验 + Alert;删除:Alert 确认
 * - 导航:goBack;登录态 / 主题色 / i18n 注入
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import type { MemoryEntry, MemoryEntryType, MemoryScope } from '@ihui/types'
import { MemoryScreen as SharedMemoryScreen } from '@ihui/rn-app'
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
        category: newCategory.trim() || t('memory.uncategorized'),
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

  return (
    <SharedMemoryScreen
      t={t}
      loggedIn={Boolean(user)}
      entries={visibleEntries}
      loading={loading}
      refreshing={refreshing}
      error={error}
      deleting={deleting}
      saving={saving}
      search={search}
      onSearchChange={setSearch}
      scopeFilter={scopeFilter}
      onScopeFilterChange={setScopeFilter}
      typeFilter={typeFilter}
      onTypeFilterChange={setTypeFilter}
      expandedId={expandedId}
      onToggleExpand={(id: string) => setExpandedId((cur) => (cur === id ? null : id))}
      createVisible={createVisible}
      onOpenCreate={() => setCreateVisible(true)}
      onCloseCreate={() => setCreateVisible(false)}
      newText={newText}
      onNewTextChange={setNewText}
      newCategory={newCategory}
      onNewCategoryChange={setNewCategory}
      newType={newType}
      onNewTypeChange={setNewType}
      newScope={newScope}
      onNewScopeChange={setNewScope}
      onCreateSubmit={() => void onCreate()}
      onDelete={onDelete}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onRetry={() => {
        setLoading(true)
        void load()
      }}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
