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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CreditCard, Eye, EyeOff, Save } from 'lucide-react-native'
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
 * 电子名片新建/编辑 —— 对齐 web `/business-card/edit`。
 *
 * 端点按 apps/api/src/routes/other/business-card-routes.ts 现读:
 *  - `GET  /api/business-card/:id` → data **就是 card 本体**(`success({ ...card })`,不是 `{ card }`)
 *  - `POST /api/business-card/:id` → upsert by `request.userId`,路径 id 解析后不使用,
 *    兜底段用 `me`(`parseIdParam` 只要求 `[a-zA-Z0-9_-]+`);响应 `{ card, created }`
 *  - `businessCardCreateSchema` 的真实字段只有 name/title/company/phone/email/avatar/
 *    intro/qrCode/isPublic。web 表单里的 **wechat / address / bio / template 后端不存在**
 *    (zod 默认 strip,提交会被静默丢弃),本屏不提供这些假字段。
 *  - phone 正则 `^\+?[0-9]{7,20}$`、email 必须合法;空串按未填处理。
 *
 * 路由:`{ id?: string } | undefined`(无 id = 创建)。本波只新增屏幕,不改 RootNavigator
 * (任务禁令),故路由参数用 RootStackParamList 的本地交叉扩展取类型。
 */
type BusinessCardEditParamList = RootStackParamList & {
  BusinessCardEdit: { id?: string } | undefined
}
type NavigationProp = NativeStackNavigationProp<BusinessCardEditParamList>
type BusinessCardEditRoute = RouteProp<BusinessCardEditParamList, 'BusinessCardEdit'>

interface BusinessCard {
  id: string
  name: string
  title?: string | null
  company?: string | null
  phone?: string | null
  email?: string | null
  avatar?: string | null
  intro?: string | null
  qrCode?: string | null
  isPublic?: boolean
}

interface CardForm {
  name: string
  title: string
  company: string
  phone: string
  email: string
  avatar: string
  intro: string
  qrCode: string
  isPublic: boolean
}

const EMPTY_FORM: CardForm = {
  name: '',
  title: '',
  company: '',
  phone: '',
  email: '',
  avatar: '',
  intro: '',
  qrCode: '',
  isPublic: true,
}

const NAME_MAX = 100
const TITLE_MAX = 100
const COMPANY_MAX = 200
const PHONE_MAX = 20
const EMAIL_MAX = 200
const AVATAR_MAX = 500
const INTRO_MAX = 2000
const QR_MAX = 500
const PHONE_RE = /^\+?[0-9]{7,20}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface CardFieldDef {
  key: 'name' | 'title' | 'company' | 'phone' | 'email' | 'avatar' | 'qrCode'
  labelKey: string
  placeholderKey: string
  maxLength: number
  keyboardType?: 'default' | 'phone-pad' | 'email-address'
  autoCapitalize?: 'none'
}

/** 单行文本字段与后端 `businessCardCreateSchema` 一一对应(顺序即渲染顺序) */
const CARD_FIELDS: CardFieldDef[] = [
  {
    key: 'name',
    labelKey: 'businessCardEdit.nameLabel',
    placeholderKey: 'businessCardEdit.namePlaceholder',
    maxLength: NAME_MAX,
  },
  {
    key: 'title',
    labelKey: 'businessCardEdit.fieldTitleLabel',
    placeholderKey: 'businessCardEdit.fieldTitlePlaceholder',
    maxLength: TITLE_MAX,
  },
  {
    key: 'company',
    labelKey: 'businessCardEdit.companyLabel',
    placeholderKey: 'businessCardEdit.companyPlaceholder',
    maxLength: COMPANY_MAX,
  },
  {
    key: 'phone',
    labelKey: 'businessCardEdit.phoneLabel',
    placeholderKey: 'businessCardEdit.phonePlaceholder',
    maxLength: PHONE_MAX,
    keyboardType: 'phone-pad',
  },
  {
    key: 'email',
    labelKey: 'businessCardEdit.emailLabel',
    placeholderKey: 'businessCardEdit.emailPlaceholder',
    maxLength: EMAIL_MAX,
    keyboardType: 'email-address',
    autoCapitalize: 'none',
  },
  {
    key: 'avatar',
    labelKey: 'businessCardEdit.avatarLabel',
    placeholderKey: 'businessCardEdit.avatarPlaceholder',
    maxLength: AVATAR_MAX,
    autoCapitalize: 'none',
  },
  {
    key: 'qrCode',
    labelKey: 'businessCardEdit.qrCodeLabel',
    placeholderKey: 'businessCardEdit.qrCodePlaceholder',
    maxLength: QR_MAX,
    autoCapitalize: 'none',
  },
]

export default function BusinessCardEditScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<BusinessCardEditRoute>()
  const editingId =
    typeof route.params?.id === 'string' && route.params.id.length > 0 ? route.params.id : null

  const [form, setForm] = useState<CardForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(editingId !== null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadDetail = useCallback(async () => {
    if (!editingId) return
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetchApi<BusinessCard>(
        `/api/business-card/${encodeURIComponent(editingId)}`,
      )
      if (!res.success) throw new Error(apiFailureToText(res, t('businessCardEdit.loadFailed')))
      const card = res.data
      if (!card) throw new Error(t('businessCardEdit.loadFailed'))
      setForm({
        name: card.name ?? '',
        title: card.title ?? '',
        company: card.company ?? '',
        phone: card.phone ?? '',
        email: card.email ?? '',
        avatar: card.avatar ?? '',
        intro: card.intro ?? '',
        qrCode: card.qrCode ?? '',
        isPublic: card.isPublic ?? true,
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('businessCardEdit.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [editingId, t])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const patch = <K extends keyof CardForm>(key: K, value: CardForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  const submit = async () => {
    if (saving) return
    const name = form.name.trim()
    const phone = form.phone.trim()
    const email = form.email.trim()
    if (!name) {
      setError(t('businessCardEdit.nameRequired'))
      return
    }
    if (name.length > NAME_MAX) {
      setError(t('businessCardEdit.nameTooLong', { max: NAME_MAX }))
      return
    }
    if (form.title.trim().length > TITLE_MAX) {
      setError(t('businessCardEdit.titleTooLong', { max: TITLE_MAX }))
      return
    }
    if (form.company.trim().length > COMPANY_MAX) {
      setError(t('businessCardEdit.companyTooLong', { max: COMPANY_MAX }))
      return
    }
    if (phone && (!PHONE_RE.test(phone) || phone.length > PHONE_MAX)) {
      setError(t('businessCardEdit.phoneInvalid'))
      return
    }
    if (email && (!EMAIL_RE.test(email) || email.length > EMAIL_MAX)) {
      setError(t('businessCardEdit.emailInvalid'))
      return
    }
    if (form.avatar.trim().length > AVATAR_MAX) {
      setError(t('businessCardEdit.avatarTooLong', { max: AVATAR_MAX }))
      return
    }
    if (form.intro.trim().length > INTRO_MAX) {
      setError(t('businessCardEdit.introTooLong', { max: INTRO_MAX }))
      return
    }
    if (form.qrCode.trim().length > QR_MAX) {
      setError(t('businessCardEdit.qrCodeTooLong', { max: QR_MAX }))
      return
    }
    setSaving(true)
    setError('')
    const body = {
      name,
      title: form.title.trim() || undefined,
      company: form.company.trim() || undefined,
      phone: phone || undefined,
      email: email || undefined,
      avatar: form.avatar.trim() || undefined,
      intro: form.intro.trim() || undefined,
      qrCode: form.qrCode.trim() || undefined,
      isPublic: form.isPublic,
    }
    try {
      const res = await fetchApi(`/api/business-card/${editingId ?? 'me'}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) throw new Error(apiFailureToText(res, t('businessCardEdit.saveFailed')))
      navigation.goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('businessCardEdit.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar
          title={
            editingId ? t('businessCardEdit.pageTitleEdit') : t('businessCardEdit.pageTitleCreate')
          }
          onBack={() => navigation.goBack()}
        />
      </NavChrome>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={tokens.text.tertiary} />
          <Text style={styles.muted}>{t('businessCardEdit.loading')}</Text>
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
              <Text style={styles.retryText}>{t('businessCardEdit.retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{t('businessCardEdit.subtitle')}</Text>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <CreditCard size={18} color={tokens.brandAccent.deep} />
              <Text style={styles.cardTitle}>{t('businessCardEdit.cardInfo')}</Text>
            </View>

            {CARD_FIELDS.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{t(field.labelKey)}</Text>
                <TextField
                  colorScheme={resolvedTheme}
                  value={form[field.key]}
                  onChangeText={(v) => patch(field.key, v)}
                  placeholder={t(field.placeholderKey)}
                  keyboardType={field.keyboardType}
                  autoCapitalize={field.autoCapitalize}
                  maxLength={field.maxLength}
                  style={styles.input}
                />
              </View>
            ))}

            <View style={styles.field}>
              <Text style={styles.label}>{t('businessCardEdit.introLabel')}</Text>
              <TextField
                colorScheme={resolvedTheme}
                value={form.intro}
                onChangeText={(v) => patch('intro', v)}
                placeholder={t('businessCardEdit.introPlaceholder')}
                multiline
                textAlignVertical="top"
                maxLength={INTRO_MAX}
                style={[styles.input, styles.textarea]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('businessCardEdit.visibilityLabel')}</Text>
              <View style={styles.chipRow}>
                <Chip
                  icon={
                    <Eye
                      size={13}
                      color={form.isPublic ? tokens.brand.ctaForeground : tokens.text.secondary}
                    />
                  }
                  label={t('businessCardEdit.visibilityPublic')}
                  selected={form.isPublic}
                  onPress={() => patch('isPublic', true)}
                />
                <Chip
                  icon={
                    <EyeOff
                      size={13}
                      color={!form.isPublic ? tokens.brand.ctaForeground : tokens.text.secondary}
                    />
                  }
                  label={t('businessCardEdit.visibilityPrivate')}
                  selected={!form.isPublic}
                  onPress={() => patch('isPublic', false)}
                />
              </View>
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
                <Save size={16} color={tokens.brand.ctaForeground} />
              )}
              <Text style={styles.primaryBtnText}>
                {saving ? t('businessCardEdit.submitting') : t('businessCardEdit.submitSave')}
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
  textarea: { minHeight: 100, lineHeight: 21 },
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
