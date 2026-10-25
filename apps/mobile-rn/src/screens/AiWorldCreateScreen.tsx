// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Globe2, Send } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * AI 世界条目创建 —— 对齐 web `/ai-world/create`。
 *
 * 端点按 apps/api/src/routes/other/ai-world-routes.ts 与 `ai-world.ts` 现读:
 *  - `GET  /api/ai-world/categories` → data **是数组**(`success(categories)`),
 *    web 读 `catData?.list` 拿到的是 undefined ⇒ 它的分类下拉实际永远为空,本屏按真实形状读。
 *  - `POST /api/ai-world/create` body `{ title(1..200), content?, coverImage?(≤500),
 *    categoryId?(uuid), status? }`;`kind` 固定 `news`、`authorId` 取登录用户。
 *  - web 表单里的 `config` 字段**后端 zod 不存在**(会被 strip 静默丢弃),本屏不提供。
 *  - 成功后 web 跳 `/ai-world`,本屏回退到来源页。
 */
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface AiWorldCategory {
  id: string
  name: string
}

const NAME_MAX = 200
const COVER_MAX = 500

export default function AiWorldCreateScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [categories, setCategories] = useState<AiWorldCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true)
    setCategoriesError('')
    try {
      const res = await fetchApi<AiWorldCategory[]>('/api/ai-world/categories')
      if (!res.success) {
        throw new Error(apiFailureToText(res, t('aiWorldCreate.categoryLoadFailed')))
      }
      setCategories(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setCategoriesError(e instanceof Error ? e.message : t('aiWorldCreate.categoryLoadFailed'))
    } finally {
      setCategoriesLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const submit = async () => {
    if (saving) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError(t('aiWorldCreate.nameRequired'))
      return
    }
    if (trimmedTitle.length > NAME_MAX) {
      setError(t('aiWorldCreate.nameTooLong', { max: NAME_MAX }))
      return
    }
    if (coverImage.trim().length > COVER_MAX) {
      setError(t('aiWorldCreate.coverTooLong', { max: COVER_MAX }))
      return
    }
    setSaving(true)
    setError('')
    const body = {
      title: trimmedTitle,
      content: description.trim() || undefined,
      categoryId: categoryId || undefined,
      coverImage: coverImage.trim() || undefined,
    }
    try {
      const res = await fetchApi('/api/ai-world/create', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) throw new Error(apiFailureToText(res, t('aiWorldCreate.saveFailed')))
      navigation.goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('aiWorldCreate.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('aiWorldCreate.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('aiWorldCreate.subtitle')}</Text>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Globe2 size={18} color={tokens.brandAccent.deep} />
            <Text style={styles.cardTitle}>{t('aiWorldCreate.formTitle')}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('aiWorldCreate.nameLabel')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={title}
              onChangeText={(v) => {
                setTitle(v)
                setError('')
              }}
              placeholder={t('aiWorldCreate.namePlaceholder')}
              maxLength={NAME_MAX}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('aiWorldCreate.descLabel')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={description}
              onChangeText={(v) => {
                setDescription(v)
                setError('')
              }}
              placeholder={t('aiWorldCreate.descPlaceholder')}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textarea]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('aiWorldCreate.categoryLabel')}</Text>
            {categoriesLoading ? (
              <ActivityIndicator
                style={styles.categoriesLoading}
                size="small"
                color={tokens.text.tertiary}
              />
            ) : categoriesError ? (
              <View style={styles.inlineError}>
                <Text style={styles.errorText}>{categoriesError}</Text>
                <TouchableOpacity onPress={() => void loadCategories()} activeOpacity={0.7}>
                  <Text style={styles.retryText}>{t('aiWorldCreate.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.chipRow}>
                <Chip
                  label={t('aiWorldCreate.noCategory')}
                  selected={categoryId === ''}
                  onPress={() => setCategoryId('')}
                />
                {categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    selected={categoryId === category.id}
                    onPress={() => setCategoryId(category.id)}
                  />
                ))}
                {categories.length === 0 ? (
                  <Text style={styles.muted}>{t('aiWorldCreate.categoryEmpty')}</Text>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('aiWorldCreate.coverLabel')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={coverImage}
              onChangeText={(v) => {
                setCoverImage(v)
                setError('')
              }}
              placeholder={t('aiWorldCreate.coverPlaceholder')}
              autoCapitalize="none"
              maxLength={COVER_MAX}
              style={styles.input}
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
              <Send size={16} color={tokens.brand.ctaForeground} />
            )}
            <Text style={styles.primaryBtnText}>
              {saving ? t('aiWorldCreate.submitting') : t('aiWorldCreate.submit')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipSelectedText]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: 10 },
  subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
  muted: { fontSize: rnType.label.size, color: tokens.text.secondary },
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
  textarea: { minHeight: 120, lineHeight: 21 },
  categoriesLoading: { alignSelf: 'flex-start', paddingVertical: rnSpacing.xs },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorText: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
  retryText: { fontSize: rnType.label.size, fontWeight: '600', color: tokens.text.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: {
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
