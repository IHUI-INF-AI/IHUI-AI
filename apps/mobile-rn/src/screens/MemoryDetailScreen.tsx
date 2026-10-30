// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MemoryDetailScreen 记忆详情(mobile-rn 端 wrapper)
 *
 * 承载 web /memory/[id](apps/web/app/(main)/memory/[id]/PageClient.tsx)。UI 全部委托共享屏
 * @ihui/rn-app,本 wrapper 只保留平台职责:
 * - 取数:GET /api/memory(契约 apps/api/src/routes/memory.ts:158-182;后端无 GET /api/memory/:id,
 *   故与 web PageClient.tsx:47-56 同口径「拉列表按 id 命中」)
 * - 保存:DELETE 旧条目 + POST 新条目(web PageClient.tsx:68-86 原样语义,后端无 PUT/PATCH)
 * - 删除:DELETE /api/memory/:id(apps/api/src/routes/memory.ts:216-241)+ 二次确认
 * - 时间 Intl 格式化(与 web formatMemoryTime 同参:年月日时分)、类型/作用域本地化、登录门
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MemoryEntry, MemoryEntryType, MemoryScope } from '@ihui/types'
import {
  createMemoryEntry,
  deleteMemoryEntry,
  getMemoryEntries,
} from '@ihui/api-client'
import {
  MemoryDetailScreen as SharedMemoryDetailScreen,
  type MemoryDetailView,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useAuthStore } from '../stores/auth-store'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'MemoryDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const TYPE_KEYS: Record<MemoryEntryType, string> = {
  preference: 'memory.type.preference',
  convention: 'memory.type.convention',
  decision: 'memory.type.decision',
  fact: 'memory.type.fact',
  feedback: 'memory.type.feedback',
  skill_ref: 'memory.type.skill_ref',
}

const SCOPE_KEYS: Record<MemoryScope, string> = {
  global: 'memory.scope.global',
  user: 'memory.scope.user',
  session: 'memory.scope.session',
  project: 'memory.scope.project',
}

export function MemoryDetailScreen() {
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const user = useAuthStore((s) => s.user)
  const { id } = route.params

  const [entry, setEntry] = useState<MemoryEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editCategory, setEditCategory] = useState('')
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const fmtTime = useCallback(
    (iso: string): string => {
      const d = new Date(iso)
      return Number.isNaN(d.getTime()) ? iso : timeFmt.format(d)
    },
    [timeFmt],
  )

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getMemoryEntries()
      if (!res.success || !res.data) {
        setError(res.error || t('common.loadFailed'))
        return
      }
      const found = res.data.entries.find((e) => e.id === id) ?? null
      setEntry(found)
      setNotFound(!found)
      if (found) {
        setEditCategory(found.category)
        setEditText(found.text)
      }
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t, user])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async () => {
    if (!entry) return
    const text = editText.trim()
    if (!text) {
      appAlert(t('memory.textRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const del = await deleteMemoryEntry(entry.id, { scope: entry.scope })
      if (!del.success) {
        setError(del.error || t('memory.deleteFailed'))
        return
      }
      const created = await createMemoryEntry({
        scope: entry.scope,
        type: entry.type,
        category: editCategory.trim() || t('memory.uncategorized'),
        text,
        source: entry.source || 'mobile-rn',
      })
      if (!created.success) {
        setError(created.error || t('memory.saveFailed'))
        return
      }
      setEditing(false)
      navigation.goBack()
    } catch {
      setError(t('memory.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const doDelete = useCallback(async () => {
    if (!entry) return
    setDeleting(true)
    setError(null)
    try {
      const res = await deleteMemoryEntry(entry.id, { scope: entry.scope })
      if (!res.success) {
        setError(res.error || t('memory.deleteFailed'))
        return
      }
      navigation.goBack()
    } catch {
      setError(t('memory.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }, [entry, navigation, t])

  const onDelete = () => {
    if (!entry) return
    appAlert(t('memory.deleteTitle'), t('memory.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), style: 'destructive', onPress: () => void doDelete() },
    ])
  }

  const view: MemoryDetailView | null = entry
    ? {
        id: entry.id,
        typeLabel: t(TYPE_KEYS[entry.type]),
        scopeLabel: t(SCOPE_KEYS[entry.scope]),
        category: entry.category,
        text: entry.text,
        source: entry.source ?? '',
        createdAtText: fmtTime(entry.createdAt),
        updatedAtText: fmtTime(entry.updatedAt),
      }
    : null

  return (
    <SharedMemoryDetailScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t('memory.loginRequired')}
      loading={loading}
      error={error}
      notFound={notFound}
      entry={view}
      editing={editing}
      saving={saving}
      deleting={deleting}
      editCategory={editCategory}
      onEditCategoryChange={setEditCategory}
      editText={editText}
      onEditTextChange={setEditText}
      onStartEdit={() => setEditing(true)}
      onCancelEdit={() => {
        setEditing(false)
        if (entry) {
          setEditCategory(entry.category)
          setEditText(entry.text)
        }
      }}
      onSave={() => void onSave()}
      onDelete={onDelete}
      onRetry={() => void load()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
