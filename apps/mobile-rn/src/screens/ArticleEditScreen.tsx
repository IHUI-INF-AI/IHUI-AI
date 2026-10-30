// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * 文章新建/编辑 —— 对齐 web /articles/edit。
 * 契约实读自 apps/api/src/routes/user/articles-routes.ts:
 *   GET /article/categories、GET /article/detail/:id(编辑态)、
 *   POST /article/publish { title, content, categoryId?, summary?, coverImage?, isPublished? }、
 *   PUT /article/:id(同字段)。标题与内容为服务端硬要求,缺任一直接 400。
 */
interface ArticleCategory {
  id: string
  name: string
}

interface ArticleDetail {
  title: string
  content: string
  summary: string | null
  categoryId: string | null
  coverImage: string | null
  isPublished: boolean
}

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function ArticleEditScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<Nav>()
  const route = useRoute<RouteProp<RootStackParamList, 'ArticleEdit'>>()
  const id = route.params?.id

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [summary, setSummary] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [publish, setPublish] = useState(true)
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetchApi<ArticleCategory[]>('/api/article/categories')
      if (res.success && Array.isArray(res.data)) setCategories(res.data)
    })()
  }, [])

  useEffect(() => {
    if (!id) return
    void (async () => {
      setLoading(true)
      setLoadFailed(false)
      try {
        const res = await fetchApi<ArticleDetail>(`/api/article/detail/${id}`)
        if (!res.success || !res.data) {
          setLoadFailed(true)
          return
        }
        setTitle(res.data.title ?? '')
        setContent(res.data.content ?? '')
        setSummary(res.data.summary ?? '')
        setCoverImage(res.data.coverImage ?? '')
        setCategoryId(res.data.categoryId ?? null)
        setPublish(!!res.data.isPublished)
      } catch {
        setLoadFailed(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const onSubmit = useCallback(async () => {
    if (title.trim().length === 0 || content.trim().length === 0) {
      appAlert(t('common.error'), t('articleEdit.requiredHint'))
      return
    }
    setSaving(true)
    const body = JSON.stringify({
      title: title.trim(),
      content: content.trim(),
      summary: summary.trim() || undefined,
      coverImage: coverImage.trim() || undefined,
      categoryId: categoryId ?? undefined,
      isPublished: publish,
    })
    try {
      const res = id
        ? await fetchApi(`/api/article/${id}`, { method: 'PUT', body })
        : await fetchApi('/api/article/publish', { method: 'POST', body })
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('articleEdit.saveFailed'))
        return
      }
      appAlert(t('articleEdit.saved'))
      navigation.goBack()
    } catch {
      appAlert(t('common.error'), t('articleEdit.saveFailed'))
    } finally {
      setSaving(false)
    }
  }, [categoryId, content, coverImage, id, navigation, publish, summary, t, title])

  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('articleEdit.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {loading ? (
          <Text style={styles.muted}>{t('common.loading')}</Text>
        ) : loadFailed ? (
          <Text style={styles.errorText}>{t('articleEdit.loadFailed')}</Text>
        ) : (
          <>
            <Text style={styles.label}>{t('articleEdit.articleTitle')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={title}
              onChangeText={setTitle}
              placeholder={t('articleEdit.titlePlaceholder')}
              style={styles.input}
              editable={!saving}
            />
            <Text style={styles.label}>{t('articleEdit.content')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={content}
              onChangeText={setContent}
              placeholder={t('articleEdit.contentPlaceholder')}
              multiline
              numberOfLines={10}
              style={[styles.input, styles.contentInput]}
              editable={!saving}
            />
            <Text style={styles.label}>{t('articleEdit.summary')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={summary}
              onChangeText={setSummary}
              placeholder={t('articleEdit.summaryPlaceholder')}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.summaryInput]}
              editable={!saving}
            />
            {categories.length > 0 ? (
              <>
                <Text style={styles.label}>{t('articleEdit.category')}</Text>
                <View style={styles.chips}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, categoryId === c.id && styles.chipActive]}
                      onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
                      disabled={saving}
                    >
                      <Text style={[styles.chipText, categoryId === c.id && styles.chipActiveText]}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={styles.label}>{t('articleEdit.coverImage')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={coverImage}
              onChangeText={setCoverImage}
              placeholder={t('articleEdit.coverPlaceholder')}
              autoCapitalize="none"
              style={styles.input}
              editable={!saving}
            />
            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => setPublish((v) => !v)}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.label}>{t('articleEdit.publishNow')}</Text>
              <View style={[styles.radio, publish && styles.radioOn]} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submit, saving && styles.submitDisabled]}
              onPress={() => void onSubmit()}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.submitText}>
                {saving ? t('articleEdit.saving') : t('articleEdit.save')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.lg, gap: 6, paddingBottom: rnSpacing['4xl'] },
    label: { fontSize: rnType.body.size, color: tokens.text.secondary, marginTop: 10 },
    input: {
      height: 44,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: rnType.strong.size,
      backgroundColor: tokens.surface.card,
    },
    contentInput: {
      height: 220,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.md,
      textAlignVertical: 'top',
    },
    summaryInput: { height: 78, paddingTop: 10, paddingBottom: 10, textAlignVertical: 'top' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm, marginTop: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 7,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
    },
    chipActive: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
    chipText: { fontSize: 13, color: tokens.text.primary },
    chipActiveText: { color: tokens.brand.ctaForeground },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: rnRadius.sm,
      borderWidth: 2,
      borderColor: tokens.border.medium,
    },
    radioOn: {
      backgroundColor: tokens.brand.cta,
      borderColor: tokens.brand.cta,
      color: tokens.brand.ctaForeground,
    },
    submit: {
      height: 46,
      marginTop: rnSpacing.xl,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitText: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    muted: { fontSize: rnType.body.size, color: tokens.text.secondary },
    errorText: { fontSize: rnType.body.size, color: tokens.danger.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
