// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState, type ReactNode } from 'react'
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
import { Brain } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import type { MemoryCreateInput, MemoryEntry, MemoryEntryType, MemoryScope } from '@ihui/types'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 新建记忆 —— 对齐 web `/memory/new`。
 *
 * 契约按 apps/api/src/routes/memory.ts 现读:
 *  - `POST /api/memory` body 即 `MemoryCreateInput`(scope/type/category/text 必填,
 *    source/sessionId/projectKey 可选);响应是新建的 `MemoryEntry`。
 *  - `scope` 只决定 Redis key 分组;`sessionId/projectKey` 后端不强制,本屏也不假装强制。
 *  - 提交成功后 web 跳回 `/memory`,本屏 goBack(入口即记忆列表)。
 */
const SCOPE_OPTIONS: ReadonlyArray<{ value: MemoryScope; labelKey: string; hintKey: string }> = [
  { value: 'global', labelKey: 'memoryNew.scopeGlobal', hintKey: 'memoryNew.scopeGlobalHint' },
  { value: 'project', labelKey: 'memoryNew.scopeProject', hintKey: 'memoryNew.scopeProjectHint' },
  { value: 'session', labelKey: 'memoryNew.scopeSession', hintKey: 'memoryNew.scopeSessionHint' },
  { value: 'user', labelKey: 'memoryNew.scopeUser', hintKey: 'memoryNew.scopeUserHint' },
]

const TYPE_OPTIONS: ReadonlyArray<{ value: MemoryEntryType; labelKey: string }> = [
  { value: 'preference', labelKey: 'memoryNew.typePreference' },
  { value: 'convention', labelKey: 'memoryNew.typeConvention' },
  { value: 'decision', labelKey: 'memoryNew.typeDecision' },
  { value: 'fact', labelKey: 'memoryNew.typeFact' },
  { value: 'feedback', labelKey: 'memoryNew.typeFeedback' },
  { value: 'skill_ref', labelKey: 'memoryNew.typeSkillRef' },
]

export default function MemoryNewScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [scope, setScope] = useState<MemoryScope>('session')
  const [type, setType] = useState<MemoryEntryType>('fact')
  const [category, setCategory] = useState('')
  const [text, setText] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [projectKey, setProjectKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const scopeHintKey =
    SCOPE_OPTIONS.find((option) => option.value === scope)?.hintKey ?? 'memoryNew.scopeSessionHint'

  const submit = async () => {
    if (saving) return
    if (!text.trim()) {
      setError(t('memoryNew.textRequired'))
      return
    }
    setSaving(true)
    setError('')
    const body: MemoryCreateInput = {
      scope,
      type,
      category: category.trim() || t('memoryNew.uncategorized'),
      text: text.trim(),
      source: 'mobile-rn',
      sessionId: sessionId.trim() || undefined,
      projectKey: projectKey.trim() || undefined,
    }
    try {
      const res = await fetchApi<MemoryEntry>('/api/memory', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) throw new Error(res.error)
      navigation.goBack()
    } catch {
      setError(t('memoryNew.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('memoryNew.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('memoryNew.subtitle')}</Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Brain size={18} color={tokens.brandAccent.deep} />
            <Text style={styles.cardTitle}>{t('memoryNew.formTitle')}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('memoryNew.scopeLabel')}</Text>
            <View style={styles.chipRow}>
              {SCOPE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={t(option.labelKey)}
                  selected={scope === option.value}
                  onPress={() => {
                    setScope(option.value)
                    setError('')
                  }}
                />
              ))}
            </View>
            <Text style={styles.hint}>{t(scopeHintKey)}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('memoryNew.typeLabel')}</Text>
            <View style={styles.chipRow}>
              {TYPE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={t(option.labelKey)}
                  selected={type === option.value}
                  onPress={() => {
                    setType(option.value)
                    setError('')
                  }}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('memoryNew.categoryLabel')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={category}
              onChangeText={(value) => {
                setCategory(value)
                setError('')
              }}
              placeholder={t('memoryNew.categoryPlaceholder')}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('memoryNew.textLabel')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={text}
              onChangeText={(value) => {
                setText(value)
                setError('')
              }}
              placeholder={t('memoryNew.textPlaceholder')}
              multiline
              textAlignVertical="top"
              maxLength={2000}
              style={[styles.input, styles.textarea]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('memoryNew.sessionLabel')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={sessionId}
              onChangeText={setSessionId}
              placeholder={t('memoryNew.sessionPlaceholder')}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('memoryNew.projectLabel')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={projectKey}
              onChangeText={setProjectKey}
              placeholder={t('memoryNew.projectPlaceholder')}
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
            {saving ? <ActivityIndicator size="small" color={tokens.brand.ctaForeground} /> : null}
            <Text style={styles.primaryBtnText}>
              {saving ? t('memoryNew.submitting') : t('memoryNew.submit')}
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
  label: ReactNode
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
  body: { padding: 12, paddingBottom: 32, gap: 10 },
  subtitle: { fontSize: 12, color: tokens.text.tertiary },
  card: {
    gap: 12,
    padding: 14,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  field: { gap: 5 },
  label: { fontSize: 12, color: tokens.text.secondary },
  hint: { fontSize: 11, color: tokens.text.tertiary },
  input: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    color: tokens.text.primary,
    fontSize: 14,
    backgroundColor: tokens.surface.bg,
  },
  textarea: { minHeight: 120, lineHeight: 21 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: rnRadius.md,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.bg,
  },
  chipSelected: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
  chipText: { fontSize: 12, color: tokens.text.secondary },
  chipSelectedText: { color: tokens.brand.ctaForeground, fontWeight: '600' },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT },
  primaryBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: tokens.brand.ctaForeground },
  disabled: { opacity: 0.5 },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
