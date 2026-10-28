// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { BookOpen, Check, Eye, EyeOff } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 知识库条目新建/编辑 —— 对齐 web `/knowledge-base/edit` 与 `/knowledge-base/edit/[id]`。
 *
 * 契约按 apps/api/src/routes/other/knowledge-base-routes.ts 现读:
 *  - `GET  /api/knowledge-base/categories` → `{ list: [{ id, name, count }] }`
 *  - `POST /api/knowledge-base`            body `{ title, summary?, content?, categoryId?, isPublished? }`
 *  - `GET  /api/knowledge-base/:id`        → `{ item }`(**不是** web 读的 `{ article }`)
 *  - `PUT  /api/knowledge-base/:id`        body 同上,仅作者可改
 *  - 表里没有 tags 列、POST/PUT 的 zod 也不收 tags ⇒ web 的标签输入是被静默丢弃的假字段,
 *    本屏不提供。
 *  - `categoryId` 的 zod 是 `z.uuid().optional()`,没有 null 通道 ⇒ 编辑态无法"清空分类",
 *    故编辑态不提供"未分类"选项(避免出现"选了却没生效"的假操作)。
 *  - `isPublished` 即可见性(默认 false = 草稿);列表接口当前不按它过滤,本屏只如实保存,
 *    不对"草稿仅自己可见"作任何承诺。
 */
interface KbCategory {
  id: string
  name: string
}

interface KbItem {
  id: string
  title: string
  summary?: string | null
  content?: string | null
  categoryId?: string | null
  isPublished?: boolean
}

interface KbForm {
  title: string
  summary: string
  content: string
  categoryId: string
  isPublished: boolean
}

const EMPTY_FORM: KbForm = {
  title: '',
  summary: '',
  content: '',
  categoryId: '',
  isPublished: false,
}

export default function KnowledgeBaseEditScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute()
  const params = (route.params ?? {}) as { id?: string }
  const editingId = typeof params.id === 'string' && params.id.length > 0 ? params.id : null

  const [categories, setCategories] = useState<KbCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')
  const [form, setForm] = useState<KbForm>(EMPTY_FORM)
  const [detailLoading, setDetailLoading] = useState(editingId !== null)
  const [detailError, setDetailError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true)
    setCategoriesError('')
    try {
      const res = await fetchApi<{ list: KbCategory[] }>('/api/knowledge-base/categories')
      if (!res.success) throw new Error(res.error)
      setCategories(res.data?.list ?? [])
    } catch {
      setCategoriesError(t('knowledgeBaseEdit.categoryLoadFailed'))
    } finally {
      setCategoriesLoading(false)
    }
  }, [t])

  const loadDetail = useCallback(async () => {
    if (!editingId) return
    setDetailLoading(true)
    setDetailError('')
    try {
      const res = await fetchApi<{ item: KbItem }>(
        `/api/knowledge-base/${encodeURIComponent(editingId)}`,
      )
      if (!res.success) throw new Error(res.error)
      const item = res.data?.item
      if (!item) throw new Error('missing item')
      setForm({
        title: item.title,
        summary: item.summary ?? '',
        content: item.content ?? '',
        categoryId: item.categoryId ?? '',
        isPublished: item.isPublished ?? false,
      })
    } catch {
      setDetailError(t('knowledgeBaseEdit.detailLoadFailed'))
    } finally {
      setDetailLoading(false)
    }
  }, [editingId, t])

  useEffect(() => {
    void loadCategories()
    void loadDetail()
  }, [loadCategories, loadDetail])

  const patch = <K extends keyof KbForm>(key: K, value: KbForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  const submit = async () => {
    if (saving) return
    if (!form.title.trim()) {
      setError(t('knowledgeBaseEdit.titleRequired'))
      return
    }
    if (!form.content.trim()) {
      setError(t('knowledgeBaseEdit.contentRequired'))
      return
    }
    setSaving(true)
    setError('')
    const body = {
      title: form.title.trim(),
      // 新建时空摘要不传;编辑时传空串才能清掉旧摘要(undefined 会被 PUT 忽略)
      summary: editingId ? form.summary.trim() : form.summary.trim() || undefined,
      content: form.content,
      categoryId: form.categoryId || undefined,
      isPublished: form.isPublished,
    }
    try {
      const res = editingId
        ? await fetchApi(`/api/knowledge-base/${encodeURIComponent(editingId)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : await fetchApi('/api/knowledge-base', { method: 'POST', body: JSON.stringify(body) })
      if (!res.success) throw new Error(res.error)
      navigation.goBack()
    } catch {
      setError(t('knowledgeBaseEdit.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const pickCategory = (id: string) => patch('categoryId', id)

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar
          title={editingId ? t('knowledgeBaseEdit.titleEdit') : t('knowledgeBaseEdit.titleCreate')}
          onBack={() => navigation.goBack()}
        />
      </NavChrome>

      {detailLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={tokens.text.tertiary} />
          <Text style={styles.muted}>{t('knowledgeBaseEdit.loading')}</Text>
        </View>
      ) : detailError ? (
        <View style={styles.body}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{detailError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void loadDetail()}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>{t('knowledgeBaseEdit.retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{t('knowledgeBaseEdit.subtitle')}</Text>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <BookOpen size={18} color={tokens.brandAccent.deep} />
              <Text style={styles.cardTitle}>{t('knowledgeBaseEdit.articleInfo')}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{t('knowledgeBaseEdit.titleLabel')}</Text>
              <TextField
                colorScheme={resolvedTheme}
                value={form.title}
                onChangeText={(value) => patch('title', value)}
                placeholder={t('knowledgeBaseEdit.titlePlaceholder')}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('knowledgeBaseEdit.summaryLabel')}</Text>
              <TextField
                colorScheme={resolvedTheme}
                value={form.summary}
                onChangeText={(value) => patch('summary', value)}
                placeholder={t('knowledgeBaseEdit.summaryPlaceholder')}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('knowledgeBaseEdit.categoryLabel')}</Text>
              {categoriesLoading ? (
                <ActivityIndicator
                  style={styles.categoriesLoading}
                  size="small"
                  color={tokens.text.tertiary}
                />
              ) : categoriesError ? (
                <View style={styles.inlineError}>
                  <Text style={styles.errorText}>{categoriesError}</Text>
                  <TouchableOpacity
                    onPress={() => void loadCategories()}
                    activeOpacity={0.7}
                    hitSlop={6}
                  >
                    <Text style={styles.retryText}>{t('knowledgeBaseEdit.retry')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.chipRow}>
                  {editingId ? null : (
                    <Chip
                      label={t('knowledgeBaseEdit.categoryUnset')}
                      selected={form.categoryId === ''}
                      onPress={() => pickCategory('')}
                    />
                  )}
                  {categories.map((category) => (
                    <Chip
                      key={category.id}
                      label={category.name}
                      selected={form.categoryId === category.id}
                      onPress={() => pickCategory(category.id)}
                    />
                  ))}
                  {categories.length === 0 ? (
                    <Text style={styles.muted}>{t('knowledgeBaseEdit.categoryEmpty')}</Text>
                  ) : null}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('knowledgeBaseEdit.visibilityLabel')}</Text>
              <View style={styles.chipRow}>
                <Chip
                  icon={
                    <EyeOff
                      size={13}
                      color={!form.isPublished ? tokens.brand.ctaForeground : tokens.text.secondary}
                    />
                  }
                  label={t('knowledgeBaseEdit.visibilityDraft')}
                  selected={!form.isPublished}
                  onPress={() => patch('isPublished', false)}
                />
                <Chip
                  icon={
                    <Eye
                      size={13}
                      color={form.isPublished ? tokens.brand.ctaForeground : tokens.text.secondary}
                    />
                  }
                  label={t('knowledgeBaseEdit.visibilityPublished')}
                  selected={form.isPublished}
                  onPress={() => patch('isPublished', true)}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('knowledgeBaseEdit.contentLabel')}</Text>
              <TextField
                colorScheme={resolvedTheme}
                value={form.content}
                onChangeText={(value) => patch('content', value)}
                placeholder={t('knowledgeBaseEdit.contentPlaceholder')}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.textarea]}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.disabled]}
              onPress={() => void submit()}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color={tokens.brand.ctaForeground} />
              ) : (
                <Check size={16} color={tokens.brand.ctaForeground} />
              )}
              <Text style={styles.primaryBtnText}>
                {saving
                  ? t('knowledgeBaseEdit.submitting')
                  : editingId
                    ? t('knowledgeBaseEdit.submitSave')
                    : t('knowledgeBaseEdit.submitCreate')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string
  selected: boolean
  onPress: () => void
  icon?: ReactNode
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon}
      <Text style={[styles.chipText, selected && styles.chipSelectedText]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: 10 },
  subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: rnSpacing.sm },
  muted: { fontSize: 13, color: tokens.text.secondary },
  errorBox: {
    padding: rnSpacing.md,
    gap: rnSpacing.sm,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.DEFAULT,
    backgroundColor: tokens.surface.card,
  },
  errorText: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  retryText: { fontSize: rnType.label.size, fontWeight: '600', color: tokens.text.primary },
  card: {
    gap: rnSpacing.md,
    padding: 14,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.text.primary },
  field: { gap: 5 },
  label: { fontSize: rnType.label.size, color: tokens.text.secondary },
  input: {
    minHeight: 42,
    paddingHorizontal: rnSpacing.md,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    color: tokens.text.primary,
    fontSize: rnType.body.size,
    backgroundColor: tokens.surface.bg,
  },
  textarea: { minHeight: 160, lineHeight: 21 },
  categoriesLoading: { alignSelf: 'flex-start', paddingVertical: rnSpacing.xs },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: rnRadius.md,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.bg,
  },
  chipSelected: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
  chipText: { fontSize: rnType.label.size, color: tokens.text.secondary },
  chipSelectedText: { color: tokens.brand.ctaForeground, fontWeight: '600' },
  primaryBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  primaryBtnText: {
    fontSize: rnType.strong.size,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  },
  disabled: { opacity: 0.5 },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
