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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Check, HelpCircle } from 'lucide-react-native'
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
 * 问答新建/编辑 —— 对齐 web `/asks/edit` 与 `/asks/edit/[id]`。
 *
 * 端点按 apps/api/src/routes/community/asks.ts 与 `_shared.ts` 现读:
 *  - `POST  /api/asks`      body `{ title(1..200), content(1..50000), tags?(≤20 个,每个 ≤64) }`
 *  - `GET   /api/asks/:id`  → `{ ask }`(含 title/content/tags;编辑态只允许本人 PATCH)
 *  - `PATCH /api/asks/:id`  body 同上,仅本人可改
 *  - 响应统一 `{ ask }` 信封;web 编辑页用 `setTitle(...)` 把 markdown 写回受控态,本屏同形。
 *  - web 编辑页没有 tags 上限校验,本屏按后端 zod 上限前置拦截。
 *
 * 路由:`{ id?: string } | undefined`。本波只新增屏幕,不改 RootNavigator(任务禁令),
 * 故路由参数用 RootStackParamList 的本地交叉扩展取类型;接线时把路由名加入
 * RootStackParamList 即可同形。
 */
type AskEditParamList = RootStackParamList & {
  AskEdit: { id?: string } | undefined
}
type NavigationProp = NativeStackNavigationProp<AskEditParamList>
type AskEditRoute = RouteProp<AskEditParamList, 'AskEdit'>

interface AskDetail {
  id: string
  title: string
  content: string
  tags?: string[] | null
}

interface AskForm {
  title: string
  content: string
  tagsText: string
}

const TITLE_MAX = 200
const CONTENT_MAX = 50000
const TAGS_MAX = 20
const TAG_LENGTH_MAX = 64

function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export default function AskEditScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<AskEditRoute>()
  const editingId =
    typeof route.params?.id === 'string' && route.params.id.length > 0 ? route.params.id : null

  const [form, setForm] = useState<AskForm>({ title: '', content: '', tagsText: '' })
  const [loading, setLoading] = useState(editingId !== null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadDetail = useCallback(async () => {
    if (!editingId) return
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetchApi<{ ask: AskDetail }>(`/api/asks/${encodeURIComponent(editingId)}`)
      if (!res.success) throw new Error(apiFailureToText(res, t('askEdit.loadFailed')))
      const ask = res.data?.ask
      if (!ask) throw new Error(t('askEdit.loadFailed'))
      setForm({
        title: ask.title ?? '',
        content: ask.content ?? '',
        tagsText: (ask.tags ?? []).join(', '),
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('askEdit.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [editingId, t])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const patch = <K extends keyof AskForm>(key: K, value: AskForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  const submit = async () => {
    if (saving) return
    const title = form.title.trim()
    const content = form.content.trim()
    const tags = parseTags(form.tagsText)
    if (!title) {
      setError(t('askEdit.titleRequired'))
      return
    }
    if (title.length > TITLE_MAX) {
      setError(t('askEdit.titleTooLong', { max: TITLE_MAX }))
      return
    }
    if (!content) {
      setError(t('askEdit.contentRequired'))
      return
    }
    if (content.length > CONTENT_MAX) {
      setError(t('askEdit.contentTooLong', { max: CONTENT_MAX }))
      return
    }
    if (tags.length > TAGS_MAX) {
      setError(t('askEdit.tagsTooMany', { max: TAGS_MAX }))
      return
    }
    if (tags.some((tag) => tag.length > TAG_LENGTH_MAX)) {
      setError(t('askEdit.tagTooLong', { max: TAG_LENGTH_MAX }))
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = JSON.stringify({ title, content, tags })
      const res = editingId
        ? await fetchApi<{ ask: AskDetail }>(`/api/asks/${encodeURIComponent(editingId)}`, {
            method: 'PATCH',
            body,
          })
        : await fetchApi<{ ask: AskDetail }>('/api/asks', { method: 'POST', body })
      if (!res.success) throw new Error(apiFailureToText(res, t('askEdit.saveFailed')))
      if (editingId) navigation.navigate('AskDetail', { id: editingId })
      else navigation.navigate('AskList')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('askEdit.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar
          title={editingId ? t('askEdit.titleEdit') : t('askEdit.titleCreate')}
          onBack={() => navigation.goBack()}
        />
      </NavChrome>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={tokens.text.tertiary} />
          <Text style={styles.muted}>{t('askEdit.loading')}</Text>
        </View>
      ) : loadError ? (
        <View style={styles.body}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void loadDetail()}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>{t('askEdit.retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{t('askEdit.subtitle')}</Text>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <HelpCircle size={18} color={tokens.brandAccent.deep} />
              <Text style={styles.cardTitle}>
                {editingId ? t('askEdit.titleEdit') : t('askEdit.titleCreate')}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('askEdit.titleLabel')}</Text>
              <TextField
                colorScheme={resolvedTheme}
                value={form.title}
                onChangeText={(v) => patch('title', v)}
                placeholder={t('askEdit.titlePlaceholder')}
                maxLength={TITLE_MAX}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('askEdit.contentLabel')}</Text>
              <TextField
                colorScheme={resolvedTheme}
                value={form.content}
                onChangeText={(v) => patch('content', v)}
                placeholder={t('askEdit.contentPlaceholder')}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.textarea]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('askEdit.tagsLabel')}</Text>
              <TextField
                colorScheme={resolvedTheme}
                value={form.tagsText}
                onChangeText={(v) => patch('tagsText', v)}
                placeholder={t('askEdit.tagsPlaceholder')}
                autoCapitalize="none"
                style={styles.input}
              />
              <Text style={styles.hint}>{t('askEdit.tagsHint')}</Text>
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
                  ? t('askEdit.submitting')
                  : editingId
                    ? t('askEdit.submitSave')
                    : t('askEdit.submitCreate')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
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
  hint: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
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
  textarea: { minHeight: 180, lineHeight: 21 },
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
