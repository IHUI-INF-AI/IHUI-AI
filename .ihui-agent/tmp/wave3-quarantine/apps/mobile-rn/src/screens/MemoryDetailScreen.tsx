// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MemoryDetailScreen 记忆详情(mobile-rn 端 wrapper)
 *
 * web /memory/[id] 的原生承载。UI 与展示逻辑全在共享层 @ihui/rn-app MemoryDetailScreen,
 * 本 wrapper 只做平台特定职责:请求 / Alert / 导航 / 登录态 / 主题 / i18n 注入。
 *
 * 后端契约取证(apps/api/src/routes/memory.ts,统一 {code,message,data} 包络):
 *  - GET    /api/memory            :158 注册 → :181 success({ entries, total })(全 scope 聚合)
 *  - POST   /api/memory            :185 注册 → :212 status(201) success(entry)
 *  - DELETE /api/memory/:id        :216 注册 → :236 success({ id, deleted }),:240 未命中 404
 *  - createEntrySchema :41-51(text 必填 1-2000、category 默认「未分类」、source 默认 'api')
 *
 * 与 web 同口径的两处刻意为之(不是 RN 的偷懒):
 *  1) 详情不是独立端点 —— web PageClient.tsx:47-48 也是「拉全量列表再按 id 命中」,后端没有
 *     GET /api/memory/:id。RN 复刻同一取数路径,不新增第三种契约。
 *  2) 「保存」= 先 DELETE 再 POST —— web PageClient.tsx:73-80 逐字同做法(后端无 PUT/PATCH)。
 *
 * 保存/删除成功后 navigation.goBack():列表页 MemoryScreen 在铁律「只新建文件」下不可改,
 * 它没有 focus 重取,故回列表后以列表自带的下拉刷新为更新出口(已在 ledger note 如实登记)。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import type {
  MemoryCreateInput,
  MemoryDeleteResponse,
  MemoryEntry,
  MemoryListResponse,
} from '@ihui/types'
import { MemoryDetailScreen as SharedMemoryDetailScreen } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useAuthStore } from '../stores/auth-store'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function MemoryDetailScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  // 路由 param 由集成方在 RootNavigator 登记(形状 { id: string },与 web /memory/[id] 同名)
  const route = useRoute()
  const id = (route.params as { id?: string } | undefined)?.id
  const user = useAuthStore((s) => s.user)

  const [entry, setEntry] = useState<MemoryEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [textDraft, setTextDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      setNotFound(true)
      return
    }
    setError('')
    setNotFound(false)
    try {
      const res = await fetchApi<MemoryListResponse>('/api/memory')
      if (!res.success) throw new Error(res.error)
      const found = res.data.entries.find((e) => e.id === id) ?? null
      setEntry(found)
      setNotFound(found === null)
      if (found) {
        setCategoryDraft(found.category)
        setTextDraft(found.text)
      }
    } catch {
      setError(t('memory.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  const startEdit = () => {
    if (!entry) return
    setCategoryDraft(entry.category)
    setTextDraft(entry.text)
    setEditing(true)
    setError('')
  }

  const cancelEdit = () => {
    if (!entry) return
    setCategoryDraft(entry.category)
    setTextDraft(entry.text)
    setEditing(false)
  }

  /** web 同款两步:DELETE 旧条目 → POST 新条目(scope/type/source 原样带回,只换分类与正文) */
  const save = async () => {
    if (!entry) return
    const text = textDraft.trim()
    if (!text) {
      appAlert(t('memory.textRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const del = await fetchApi<MemoryDeleteResponse>(
        `/api/memory/${encodeURIComponent(entry.id)}`,
        { method: 'DELETE' },
      )
      if (!del.success) throw new Error(del.error)
      const body: MemoryCreateInput = {
        scope: entry.scope,
        type: entry.type,
        category: categoryDraft.trim() || t('memory.uncategorized'),
        text,
        source: entry.source,
      }
      const created = await fetchApi<MemoryEntry>('/api/memory', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!created.success) throw new Error(created.error)
      navigation.goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('memory.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = () => {
    if (!entry) return
    appAlert(t('memory.deleteTitle'), t('memory.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          if (!entry) return
          setDeleting(true)
          setError('')
          try {
            const res = await fetchApi<MemoryDeleteResponse>(
              `/api/memory/${encodeURIComponent(entry.id)}`,
              { method: 'DELETE' },
            )
            if (!res.success) throw new Error(res.error)
            navigation.goBack()
          } catch (e) {
            setError(e instanceof Error ? e.message : t('memory.deleteFailed'))
            setDeleting(false)
          }
        },
      },
    ])
  }

  return (
    <SharedMemoryDetailScreen
      t={t}
      loggedIn={Boolean(user)}
      entry={entry}
      loading={loading}
      error={error}
      notFound={notFound}
      editing={editing}
      categoryDraft={categoryDraft}
      textDraft={textDraft}
      saving={saving}
      deleting={deleting}
      onCategoryDraftChange={setCategoryDraft}
      onTextDraftChange={setTextDraft}
      onStartEdit={startEdit}
      onCancelEdit={cancelEdit}
      onSave={() => void save()}
      onDelete={confirmDelete}
      onRetry={() => void load()}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}

export default MemoryDetailScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
