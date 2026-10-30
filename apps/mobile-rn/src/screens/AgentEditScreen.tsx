// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  getAgentCategoriesList,
  updateAgentProfile,
  type AgentUpdateInput,
} from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  AgentEditScreen as SharedAgentEditScreen,
  type AgentEditCategoryOption,
  type AgentEditFormState,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'agentEditPage'

/** 与 web 同参(apps/web/app/(main)/agents/edit/[id]/PageClient.tsx:67 categories 取 100 条) */
const CATEGORY_PAGE_SIZE = 100

/**
 * 详情行 = GET /api/agents/:agentId 的 success(detail.agent)
 * (apps/api/src/routes/agents.ts:461-478,行形状=drizzle db.select().from(agents) 全列)。
 * 不复用 endpoints/agent.ts:66 getAgentDetail:其 Agent 类型未声明 remark,
 * 而编辑表单必须回填 remark(web PageClient.tsx:30/44 同字段)。
 */
interface AgentEditDetailRow {
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

/**
 * RN 端「编辑智能体」薄壳 —— 承载 web /agents/edit/[id]。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/agents/:agentId(复用 @ihui/api-client endpoints/agent.ts:66 getAgentDetail,
 * 契约 apps/api/src/routes/agents.ts:461-478)、分类 GET /api/categories/list(agents-edit.ts,
 * 契约 agents.ts:662)、保存 PUT /api/agents/:agentId(agents-edit.ts,契约 agents.ts:565-592)。
 * 提交 body 字段集逐字对齐 web PageClient.tsx:79-90(后端 Zod 只认这 11 个字段)。
 * 与 web 的一处差异:web 成功后 toast + router.push(`/agents/${id}`),RN 无 toast 依赖,
 * 改为共享屏内联成功横幅(saved)并留在本页,避免"提示完就跳走"在 RN 上无对应栈上下文。
 */
export function AgentEditScreen() {
  const navigation = useNavigation<NavigationProp>()
  // 参数形状内联声明:RootStackParamList 由集成方统一接线(本席位不改 RootNavigator.tsx),
  // 在接线前引用 route 名会直接 TS 报错,故与 ActivityDetailScreen 同法用内联 route 类型。
  const route = useRoute<{ key: string; name: 'AgentEdit'; params: { id: string } }>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const id = route.params?.id ?? ''

  const [form, setForm] = useState<AgentEditFormState | null>(null)
  const [categories, setCategories] = useState<AgentEditCategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      setNotFound(true)
      return
    }
    setLoading(true)
    setError(null)
    setNotFound(false)
    const [detail, cats] = await Promise.all([
      fetchApi<AgentEditDetailRow>(`/api/agents/${encodeURIComponent(id)}`),
      getAgentCategoriesList({ page: 1, pageSize: CATEGORY_PAGE_SIZE }),
    ])
    if (cats.success) {
      setCategories(
        (cats.data.list ?? []).map((c) => ({ categoryId: c.categoryId, name: c.name })),
      )
    }
    if (!detail.success) {
      if (detail.status === 404) setNotFound(true)
      else setError(apiFailureToText(detail, t(`${NS}.loadFailed`)))
      setLoading(false)
      return
    }
    // agentToForm 同 web PageClient.tsx:33-47(price/sort 转字符串输入,空值落默认)
    const a = detail.data
    setForm({
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
    })
    setLoading(false)
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  const onChange = useCallback(
    <K extends keyof AgentEditFormState>(key: K, value: AgentEditFormState[K]) => {
      setSaved(false)
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    },
    [],
  )

  const onSubmit = useCallback(async () => {
    if (!form || !id) return
    setFormError(null)
    setSaved(false)
    if (!form.name.trim()) {
      setFormError(t(`${NS}.nameRequired`))
      return
    }
    const body: AgentUpdateInput = {
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
    }
    setPending(true)
    const res = await updateAgentProfile(id, body)
    setPending(false)
    if (res.success) {
      setSaved(true)
      return
    }
    setFormError(apiFailureToText(res, t(`${NS}.loadFailed`)))
  }, [form, id, t])

  return (
    <SharedAgentEditScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      notFound={notFound}
      form={form}
      categories={categories}
      formError={formError}
      saved={saved}
      pending={pending}
      onChange={onChange}
      onSubmit={() => void onSubmit()}
      onRetry={() => void load()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
