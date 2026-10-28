// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import type { AgentEditForm } from '@ihui/types'
import { AgentEditScreen as SharedAgentEditScreen, type AgentEditCategory } from '@ihui/rn-app'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'AgentEdit'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端 PUT /api/agents/:agentId 实际接收的字段集(apps/api/src/routes/agents.ts:569-582) */
interface AgentApiDetail {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  cover: string | null
  categoryId: string | null
  status: string
  price: number
  isFree: boolean
  sort: number
  remark: string | null
}

interface CategoriesData {
  list: Array<{ categoryId: string; name: string }>
}

/** 与基准端 web agentToForm 同形(PageClient.tsx:33-47):null → 空串，数字转文本态 */
function detailToForm(a: AgentApiDetail): AgentEditForm {
  return {
    name: a.name ?? '',
    description: a.description ?? '',
    avatar: a.avatar ?? '',
    cover: a.cover ?? '',
    categoryId: a.categoryId ?? '',
    status: a.status ?? 'pending',
    price: String(a.price ?? 0),
    isFree: a.isFree ?? false,
    sort: String(a.sort ?? 0),
    remark: a.remark ?? '',
  }
}

/** 状态枚举对齐 web STATUS_OPTIONS(apps/web/app/(main)/agents/create/helpers.ts:22) */
const STATUS_OPTIONS = ['pending', 'published', 'rejected', 'offline']
const STATUS_KEY: Record<string, string> = {
  pending: 'agentEdit.statusPending',
  published: 'agentEdit.statusPublished',
  rejected: 'agentEdit.statusRejected',
  offline: 'agentEdit.statusOffline',
}

/** 形未就位时的占位值：表存值、宿主在渲染前提供，共享屏在 loading 态不消费这些值 */
const EMPTY_FORM: AgentEditForm = {
  name: '',
  description: '',
  avatar: '',
  cover: '',
  categoryId: '',
  status: 'pending',
  price: '0',
  isFree: true,
  sort: '0',
  remark: '',
}

export function AgentEditScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<Route>()
  const { id } = route.params

  const [form, setForm] = useState<AgentEditForm | null>(null)
  const [categories, setCategories] = useState<AgentEditCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<AgentApiDetail>(`/api/agents/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success && res.data) setForm(detailToForm(res.data))
      else setError(apiFailureToText(res, t('agentEdit.loadFailed')))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetchApi<CategoriesData>('/api/categories/list?page=1&pageSize=100')
      if (cancelled || !res.success || !res.data) return
      setCategories(
        (res.data.list ?? []).map((c) => ({ id: String(c.categoryId), name: String(c.name) })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onChange = <K extends keyof AgentEditForm>(key: K, value: AgentEditForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  const statusKeyOf = (status: string) => STATUS_KEY[status] ?? 'agentEdit.statusPending'

  const categoryTextOf = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name ?? t('agentEdit.categoryPlaceholder')

  const onSubmit = async () => {
    if (!form) return
    if (!form.name.trim()) {
      setError(t('agentEdit.nameRequired'))
      return
    }
    setSaving(true)
    setError('')
    // body 键集与空值归一逐条对齐 web updateMut(PageClient.tsx:76-95):空串→undefined，数字→Number
    const res = await fetchApi<unknown>(`/api/agents/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        avatar: form.avatar.trim() || undefined,
        cover: form.cover.trim() || undefined,
        categoryId: form.categoryId || undefined,
        status: form.status,
        price: Number(form.price) || 0,
        isFree: form.isFree,
        sort: Number(form.sort) || 0,
        remark: form.remark.trim() || undefined,
      }),
    })
    setSaving(false)
    if (res.success) {
      navigation.replace('AgentDetail', { id })
      return
    }
    setError(apiFailureToText(res, t('agentEdit.saveFailed')))
  }

  /** loading 态由共享屏呈现；form 未就位时也必须让共享屏走 loading，否则首帧空表单 */
  const view = useMemo(() => form ?? EMPTY_FORM, [form])

  return (
    <SharedAgentEditScreen
      t={t}
      form={view}
      loading={loading || !form}
      saving={saving}
      error={error}
      categories={categories}
      statusOptions={STATUS_OPTIONS}
      statusKeyOf={statusKeyOf}
      categoryTextOf={categoryTextOf}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
