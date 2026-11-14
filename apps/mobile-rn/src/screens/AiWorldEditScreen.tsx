// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AiWorldEditScreen AI 世界条目编辑(mobile-rn 端 wrapper)
 *
 * 承载 web `/ai-world/edit/[id]`(apps/web/app/(main)/ai-world/edit/[id]/PageClient.tsx):
 * 表单水合自 GET /api/ai-world/:id,提交走 PUT /api/ai-world/:id(端点封装
 * packages/api-client/src/endpoints/ai-world.ts)。UI 下沉共享层
 * @ihui/rn-app AiWorldEditScreen(字段布局沿用本域创建屏口径:后端 zod 无
 * config 字段,web 的 config 会被静默 strip,故不提供)。
 * 保存成功与 web 同去向:进入该条目详情。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAiWorldCategories, getAiWorldItem, updateAiWorldItem } from '@ihui/api-client'
import type { AiWorldCategoryRow } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  AiWorldEditScreen as SharedAiWorldEditScreen,
  type AiWorldEditFormState,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'AiWorldEdit'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NAME_MAX = 200
const COVER_MAX = 500

const EMPTY_FORM: AiWorldEditFormState = {
  name: '',
  description: '',
  categoryId: '',
  coverImage: '',
}

export function AiWorldEditScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<Route>()
  const { id } = route.params

  const [form, setForm] = useState<AiWorldEditFormState>(EMPTY_FORM)
  const [categories, setCategories] = useState<AiWorldCategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')
  const [saving, setSaving] = useState(false)
  const hydratedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAiWorldItem(id)
      if (!res.success) {
        setError(apiFailureToText(res, t('aiWorldEditPage.fetchFailed')))
        return
      }
      const world = res.data.world
      if (!hydratedRef.current) {
        setForm({
          name: world.title ?? '',
          description: world.content ?? '',
          categoryId: world.categoryId ?? '',
          coverImage: world.coverImage ?? '',
        })
        hydratedRef.current = true
      }
    } catch {
      setError(t('aiWorldEditPage.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true)
    setCategoriesError('')
    try {
      const res = await getAiWorldCategories()
      if (!res.success)
        throw new Error(apiFailureToText(res, t('aiWorldEditPage.categoryLoadFailed')))
      setCategories(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setCategoriesError(e instanceof Error ? e.message : t('aiWorldEditPage.categoryLoadFailed'))
    } finally {
      setCategoriesLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
    void loadCategories()
  }, [load, loadCategories])

  const onChange = useCallback((patch: Partial<AiWorldEditFormState>) => {
    setForm((f) => ({ ...f, ...patch }))
    setFormError('')
  }, [])

  const submit = useCallback(async () => {
    if (saving) return
    const trimmedName = form.name.trim()
    if (!trimmedName) {
      setFormError(t('aiWorldEditPage.errNameRequired'))
      return
    }
    if (trimmedName.length > NAME_MAX) {
      setFormError(t('aiWorldEditPage.nameTooLong', { max: NAME_MAX }))
      return
    }
    if (form.coverImage.trim().length > COVER_MAX) {
      setFormError(t('aiWorldEditPage.coverTooLong', { max: COVER_MAX }))
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const res = await updateAiWorldItem(id, {
        title: trimmedName,
        content: form.description.trim() || undefined,
        categoryId: form.categoryId || undefined,
        coverImage: form.coverImage.trim() || undefined,
      })
      if (!res.success) throw new Error(apiFailureToText(res, t('aiWorldEditPage.saveFailed')))
      navigation.navigate('AiWorldDetail', { id })
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('aiWorldEditPage.saveFailed'))
    } finally {
      setSaving(false)
    }
  }, [form, id, navigation, saving, t])

  return (
    <SharedAiWorldEditScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      form={form}
      onChange={onChange}
      formError={formError}
      categories={categories}
      categoriesLoading={categoriesLoading}
      categoriesError={categoriesError}
      onRetryCategories={() => void loadCategories()}
      saving={saving}
      onSubmit={() => void submit()}
    />
  )
}

export default AiWorldEditScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
