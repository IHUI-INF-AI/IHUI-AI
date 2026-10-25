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
import { Check, MapPin, Plus } from 'lucide-react-native'
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 收货地址 —— 对齐 web `/member/addresses`。
 *
 * 契约按 apps/api/src/routes/other/address-routes.ts 现读,三处与 web 旧组件不同:
 *  1. GET /api/addresses 的行字段是 `name`(列 recipient_name 的投影),但 POST/PUT 的 body
 *     字段名是 `recipientName`(zod addressBodySchema)—— web 侧提交 `name` 会被 400 拒掉,
 *     本屏按真契约提交 recipientName。
 *  2. 设默认是 POST /api/addresses/:id/default,不是 PUT。
 *  3. GET 列表投影不含 postalCode(表有列、投影没带)⇒ 编辑时邮编无法回填,
 *     只在用户显式填写时提交,避免"看起来能改其实被旧值覆盖"。
 */
interface Address {
  id: string
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault?: boolean
}

interface AddressFormState {
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  postalCode: string
  isDefault: boolean
}

const EMPTY_FORM: AddressFormState = {
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  postalCode: '',
  isDefault: false,
}

type TextKey = 'name' | 'phone' | 'province' | 'city' | 'district' | 'detail' | 'postalCode'

const FIELDS: { key: TextKey; label: string; keyboardType?: 'phone-pad' | 'number-pad' }[] = [
  { key: 'name', label: 'addresses.recipient' },
  { key: 'phone', label: 'addresses.phone', keyboardType: 'phone-pad' },
  { key: 'province', label: 'addresses.province' },
  { key: 'city', label: 'addresses.city' },
  { key: 'district', label: 'addresses.district' },
  { key: 'detail', label: 'addresses.detail' },
  { key: 'postalCode', label: 'addresses.postalCode', keyboardType: 'number-pad' },
]

export default function AddressesScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [list, setList] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [form, setForm] = useState<AddressFormState | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetchApi<{ list: Address[] }>('/api/addresses')
      if (!res.success) throw new Error(res.error)
      setList(res.data?.list ?? [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const set = <K extends keyof AddressFormState>(key: K, value: AddressFormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const startCreate = () => {
    setEditId(null)
    setForm({ ...EMPTY_FORM })
  }

  const startEdit = (a: Address) => {
    setEditId(a.id)
    setForm({
      name: a.name,
      phone: a.phone,
      province: a.province,
      city: a.city,
      district: a.district,
      detail: a.detail,
      postalCode: '',
      isDefault: !!a.isDefault,
    })
  }

  const onSave = async () => {
    if (!form) return
    const body = {
      recipientName: form.name.trim(),
      phone: form.phone.trim(),
      province: form.province.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      detail: form.detail.trim(),
      postalCode: form.postalCode.trim() || undefined,
      isDefault: form.isDefault,
    }
    if (
      !body.recipientName ||
      !body.phone ||
      !body.province ||
      !body.city ||
      !body.district ||
      !body.detail
    ) {
      appAlert(t('common.hint'), t('addresses.requiredHint'))
      return
    }
    setSaving(true)
    try {
      const payload = JSON.stringify(body)
      const res = editId
        ? await fetchApi(`/api/addresses/${editId}`, { method: 'PUT', body: payload })
        : await fetchApi('/api/addresses', { method: 'POST', body: payload })
      if (!res.success) throw new Error(res.error)
      setForm(null)
      setEditId(null)
      await load()
    } catch {
      appAlert(t('common.error'), t('addresses.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = (a: Address) => {
    appAlert(t('addresses.deleteTitle'), t('addresses.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyId(a.id)
            try {
              const res = await fetchApi(`/api/addresses/${a.id}`, { method: 'DELETE' })
              if (!res.success) throw new Error(res.error)
              await load()
            } catch {
              appAlert(t('common.error'), t('addresses.deleteFailed'))
            } finally {
              setBusyId(null)
            }
          })()
        },
      },
    ])
  }

  const onSetDefault = async (a: Address) => {
    setBusyId(a.id)
    try {
      const res = await fetchApi(`/api/addresses/${a.id}/default`, { method: 'POST' })
      if (!res.success) throw new Error(res.error)
      await load()
    } catch {
      appAlert(t('common.error'), t('addresses.defaultFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('addresses.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('addresses.subtitle')}</Text>

        {form ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {editId ? t('addresses.edit') : t('addresses.add')}
            </Text>
            {FIELDS.map((f) => (
              <View key={f.key} style={styles.field}>
                <Text style={styles.label}>{t(f.label)}</Text>
                <TextField
                  colorScheme={resolvedTheme}
                  value={form[f.key]}
                  onChangeText={(v) => set(f.key, v)}
                  keyboardType={f.keyboardType}
                  style={styles.input}
                />
              </View>
            ))}
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => set('isDefault', !form.isDefault)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, form.isDefault && styles.checkboxOn]}>
                {form.isDefault ? (
                  <Check size={12} color={styles.checkboxOnText.color} strokeWidth={3} />
                ) : null}
              </View>
              <Text style={styles.checkLabel}>{t('addresses.defaultLabel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={onSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>
                {saving ? t('addresses.saving') : t('common.save')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={() => {
                setForm(null)
                setEditId(null)
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.button} onPress={startCreate} activeOpacity={0.7}>
              <View style={styles.buttonInner}>
                <Plus size={16} color={tokens.brand.ctaForeground} />
                <Text style={styles.buttonText}>{t('addresses.add')}</Text>
              </View>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
            ) : failed ? (
              <View style={styles.stateBox}>
                <Text style={styles.errorText}>{t('addresses.loadFailed')}</Text>
                <TouchableOpacity onPress={() => void load()} activeOpacity={0.7}>
                  <Text style={styles.retry}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : list.length === 0 ? (
              <View style={styles.stateBox}>
                <MapPin size={28} color={tokens.text.tertiary} />
                <Text style={styles.muted}>{t('addresses.empty')}</Text>
              </View>
            ) : (
              list.map((a) => (
                <View key={a.id} style={styles.card}>
                  <View style={styles.itemHead}>
                    <Text style={styles.itemName}>{a.name}</Text>
                    <Text style={styles.itemPhone}>{a.phone}</Text>
                    {a.isDefault ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{t('addresses.defaultBadge')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.itemAddress}>
                    {[a.province, a.city, a.district].filter(Boolean).join(' ')} {a.detail}
                  </Text>
                  <View style={styles.actions}>
                    {!a.isDefault ? (
                      <TouchableOpacity
                        onPress={() => void onSetDefault(a)}
                        disabled={busyId === a.id}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actionText}>{t('addresses.setDefault')}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity onPress={() => startEdit(a)} activeOpacity={0.7}>
                      <Text style={styles.actionText}>{t('addresses.edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(a)}
                      disabled={busyId === a.id}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dangerText}>{t('common.delete')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: 10, paddingBottom: rnSpacing['3xl'] },
    subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tokens.text.primary },
    field: { gap: rnSpacing.xs },
    label: { fontSize: rnType.label.size, color: tokens.text.secondary },
    input: {
      height: 42,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: rnType.strong.size,
      backgroundColor: tokens.surface.bg,
    },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm, paddingVertical: 2 },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
    checkboxOnText: { color: tokens.brand.ctaForeground },
    checkLabel: { fontSize: rnType.body.size, color: tokens.text.primary },
    button: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    buttonDisabled: { opacity: 0.5 },
    buttonText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    ghostButton: { height: 40, alignItems: 'center', justifyContent: 'center' },
    ghostButtonText: { fontSize: rnType.body.size, color: tokens.text.secondary },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['4xl'],
    },
    muted: { fontSize: 13, color: tokens.text.secondary },
    errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    itemName: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.text.primary },
    itemPhone: { fontSize: 13, color: tokens.text.secondary },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    badgeText: { fontSize: rnType.caption.size, color: tokens.text.secondary },
    itemAddress: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: rnSpacing.lg, paddingTop: 2 },
    actionText: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    dangerText: { fontSize: 13, fontWeight: '600', color: tokens.danger.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
