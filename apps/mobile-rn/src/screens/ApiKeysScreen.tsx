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
import { KeyRound, Plus, Trash2 } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import {
  API_KEY_PERMISSIONS,
  DEFAULT_API_KEY_PERMISSIONS,
  type ApiKeyPermission,
} from '@ihui/types'
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
 * 对齐 web `/settings/api-keys`（apps/web/app/(main)/settings/api-keys/）。
 *
 * 端点与字段按 apps/api/src/routes/developer.ts（prefix `/api/developer`）现读：
 *  - GET    /api/developer/api-keys            → { list: SafeApiKey[] }
 *  - POST   /api/developer/api-keys            → 201 { apiKey, secret }（secret 仅此一次）
 *  - DELETE /api/developer/api-keys/:id        → { ok: true }
 *  - GET    /api/developer/api-keys/:id/usage  → { callCount, lastUsedAt, topEndpoints }
 * usage 的响应**不含** quota（service 算出的 quota 未进 reply），故本屏不展示配额。
 */
interface ApiKeyInfo {
  id: string
  name: string
  key: string
  permissions: string[]
  status: 'active' | 'revoked'
  lastUsedAt: string | null
  createdAt: string
}
interface KeyUsage {
  callCount: number
  lastUsedAt: string | null
  topEndpoints: Array<{ path: string; method: string; count: number }>
}
function fmt(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
function maskKey(key: string): string {
  return key.length <= 14 ? key : `${key.slice(0, 10)}...${key.slice(-4)}`
}
export default function ApiKeysScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [list, setList] = useState<ApiKeyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<ApiKeyPermission[]>([
    ...DEFAULT_API_KEY_PERMISSIONS,
  ])
  const [permsOpen, setPermsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [usageOf, setUsageOf] = useState<string | null>(null)
  const [usage, setUsage] = useState<Record<string, KeyUsage>>({})
  const [usageLoading, setUsageLoading] = useState<string | null>(null)
  const [usageError, setUsageError] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<string | null>(null)
  const styles = makeStyles()
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetchApi<{ list: ApiKeyInfo[] }>('/api/developer/api-keys')
      if (!res.success) setLoadError(res.error || t('apiKeys.loadFailed'))
      else setList(res.data.list)
    } catch {
      setLoadError(t('apiKeys.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])
  useEffect(() => {
    void load()
  }, [load])
  const togglePerm = (perm: ApiKeyPermission) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    )
  }
  const onCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setCreateError(t('apiKeys.nameRequired'))
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetchApi<{ apiKey: ApiKeyInfo; secret: string }>(
        '/api/developer/api-keys',
        { method: 'POST', body: JSON.stringify({ name: trimmed, permissions }) },
      )
      if (!res.success) {
        setCreateError(res.error || t('apiKeys.createFailed'))
        return
      }
      setSecret(res.data.secret)
      setName('')
      setPermissions([...DEFAULT_API_KEY_PERMISSIONS])
      setPermsOpen(false)
      void load()
    } catch {
      setCreateError(t('apiKeys.createFailed'))
    } finally {
      setCreating(false)
    }
  }
  const onUsage = async (key: ApiKeyInfo) => {
    if (usageOf === key.id) {
      setUsageOf(null)
      return
    }
    setUsageOf(key.id)
    if (usage[key.id] || usageLoading === key.id) return
    setUsageLoading(key.id)
    setUsageError((prev) => ({ ...prev, [key.id]: '' }))
    try {
      const res = await fetchApi<KeyUsage>(`/api/developer/api-keys/${key.id}/usage`)
      if (!res.success) {
        setUsageError((prev) => ({ ...prev, [key.id]: res.error || t('apiKeys.usageFailed') }))
        return
      }
      setUsage((prev) => ({ ...prev, [key.id]: res.data }))
    } catch {
      setUsageError((prev) => ({ ...prev, [key.id]: t('apiKeys.usageFailed') }))
    } finally {
      setUsageLoading(null)
    }
  }
  const onDelete = (key: ApiKeyInfo) => {
    appAlert(t('apiKeys.deleteTitle'), t('apiKeys.deleteConfirm', { name: key.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('apiKeys.delete'),
        style: 'destructive',
        onPress: () => {
          setDeleting(key.id)
          void (async () => {
            try {
              const res = await fetchApi<{ ok: boolean }>(`/api/developer/api-keys/${key.id}`, {
                method: 'DELETE',
              })
              if (!res.success) appAlert(t('common.error'), res.error || t('apiKeys.deleteFailed'))
              else void load()
            } catch {
              appAlert(t('common.error'), t('apiKeys.deleteFailed'))
            } finally {
              setDeleting(null)
            }
          })()
        },
      },
    ])
  }
  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('apiKeys.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView contentContainerStyle={styles.body}>
        {secret ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('apiKeys.secretTitle')}</Text>
            <Text style={styles.muted}>{t('apiKeys.secretHint')}</Text>
            <Text selectable style={styles.secret}>
              {secret}
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setSecret(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>{t('apiKeys.secretDone')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Plus size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('apiKeys.createTitle')}</Text>
          </View>
          <Text style={styles.label}>{t('apiKeys.nameLabel')}</Text>
          <TextField
            colorScheme={resolvedTheme}
            value={name}
            onChangeText={setName}
            placeholder={t('apiKeys.namePlaceholder')}
            style={styles.input}
            editable={!creating}
            maxLength={100}
          />
          <TouchableOpacity
            style={styles.permsHead}
            onPress={() => setPermsOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.label}>{t('apiKeys.permissionsLabel')}</Text>
            <Text style={styles.link}>
              {permsOpen ? t('apiKeys.hidePermissions') : t('apiKeys.choosePermissions')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.muted}>
            {t('apiKeys.permissionsSelected', { count: permissions.length })}
          </Text>
          {permsOpen ? (
            <>
              <Text style={styles.muted}>{t('apiKeys.permissionsHint')}</Text>
              <View style={styles.permGrid}>
                {API_KEY_PERMISSIONS.map((perm) => {
                  const checked = permissions.includes(perm)
                  return (
                    <TouchableOpacity
                      key={perm}
                      onPress={() => togglePerm(perm)}
                      activeOpacity={0.7}
                      style={[styles.permChip, checked && styles.permChipOn]}
                    >
                      <Text style={[styles.permText, checked && styles.permTextOn]}>{perm}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </>
          ) : null}
          {createError ? <Text style={styles.error}>{createError}</Text> : null}
          <TouchableOpacity
            style={[styles.button, creating && styles.disabled]}
            onPress={() => void onCreate()}
            disabled={creating}
            activeOpacity={0.7}
          >
            {creating ? (
              <ActivityIndicator color={tokens.brand.ctaForeground} />
            ) : (
              <Text style={styles.buttonText}>{t('apiKeys.createButton')}</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <KeyRound size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('apiKeys.listTitle')}</Text>
          </View>
          {loading ? (
            <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
          ) : loadError ? (
            <View style={styles.centerBox}>
              <Text style={styles.error}>{loadError}</Text>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => void load()}
                activeOpacity={0.7}
              >
                <Text style={styles.outlineText}>{t('apiKeys.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : list.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyTitle}>{t('apiKeys.emptyTitle')}</Text>
              <Text style={styles.muted}>{t('apiKeys.emptyHint')}</Text>
            </View>
          ) : (
            list.map((key) => {
              const active = key.status === 'active'
              const u = usage[key.id]
              const uError = usageError[key.id]
              return (
                <View key={key.id} style={styles.keyRow}>
                  <View style={styles.rowHead}>
                    <Text style={styles.keyName}>{key.name}</Text>
                    <View style={[styles.badge, active ? styles.badgeOn : styles.badgeOff]}>
                      <Text
                        style={[
                          styles.badgeText,
                          { color: active ? tokens.success.DEFAULT : tokens.text.tertiary },
                        ]}
                      >
                        {active ? t('apiKeys.statusActive') : t('apiKeys.statusRevoked')}
                      </Text>
                    </View>
                  </View>
                  <Text selectable style={styles.mono}>
                    {maskKey(key.key)}
                  </Text>
                  <View style={styles.chips}>
                    {key.permissions.slice(0, 3).map((p) => (
                      <Text key={p} style={styles.chip}>
                        {p}
                      </Text>
                    ))}
                    {key.permissions.length > 3 ? (
                      <Text style={styles.chipMore}>+{key.permissions.length - 3}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.meta}>
                    {t('apiKeys.createdAt')}: {fmt(key.createdAt, locale)} ·{' '}
                    {t('apiKeys.lastUsedAt')}:{' '}
                    {key.lastUsedAt ? fmt(key.lastUsedAt, locale) : t('apiKeys.lastUsedNever')}
                  </Text>
                  <View style={styles.actions}>
                    <TouchableOpacity onPress={() => void onUsage(key)} activeOpacity={0.7}>
                      <Text style={styles.link}>{t('apiKeys.usage')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(key)}
                      disabled={deleting === key.id}
                      activeOpacity={0.7}
                    >
                      <View style={styles.trashRow}>
                        <Trash2 size={13} color={tokens.danger.DEFAULT} />
                        <Text style={styles.dangerLink}>{t('apiKeys.delete')}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {usageOf === key.id ? (
                    <View style={styles.usageBox}>
                      {usageLoading === key.id ? (
                        <Text style={styles.muted}>{t('apiKeys.usageLoading')}</Text>
                      ) : uError ? (
                        <Text style={styles.error}>{uError}</Text>
                      ) : u ? (
                        <>
                          <Text style={styles.meta}>
                            {t('apiKeys.callCount')}: {u.callCount} · {t('apiKeys.lastUsedAt')}:{' '}
                            {u.lastUsedAt ? fmt(u.lastUsedAt, locale) : t('apiKeys.lastUsedNever')}
                          </Text>
                          <Text style={styles.usageTitle}>{t('apiKeys.topEndpoints')}</Text>
                          {u.topEndpoints.length === 0 ? (
                            <Text style={styles.muted}>{t('apiKeys.noTopEndpoints')}</Text>
                          ) : (
                            u.topEndpoints.map((e) => (
                              <View key={`${e.method}-${e.path}`} style={styles.endpointRow}>
                                <Text style={styles.monoSmall}>
                                  {e.method} {e.path}
                                </Text>
                                <Text style={styles.meta}>{e.count}</Text>
                              </View>
                            ))
                          )}
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )
            })
          )}
        </View>
      </ScrollView>
    </View>
  )
}
function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tokens.text.primary },
    label: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    error: { fontSize: 13, color: tokens.danger.DEFAULT },
    loading: { paddingVertical: rnSpacing.lg },
    centerBox: { alignItems: 'center', gap: rnSpacing.sm, paddingVertical: rnSpacing.lg },
    emptyTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
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
    permsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    permGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: rnSpacing.xs },
    permChip: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.bg,
    },
    permChipOn: { borderColor: tokens.brandAccent.deep, backgroundColor: tokens.brandAccent.light },
    permText: { fontSize: rnType.caption.size, color: tokens.text.secondary },
    permTextOn: { color: tokens.brandAccent.foreground, fontWeight: '600' },
    button: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: rnSpacing.xs,
    },
    disabled: { opacity: 0.5 },
    buttonText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    outlineButton: {
      height: 36,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineText: { fontSize: rnType.body.size, color: tokens.text.primary },
    keyRow: {
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.bg,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    keyName: {
      flex: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      borderWidth: 1,
    },
    badgeOn: { borderColor: tokens.success.DEFAULT },
    badgeOff: { borderColor: tokens.border.medium },
    badgeText: { fontSize: 10, fontWeight: '600' },
    mono: { fontFamily: 'monospace', fontSize: rnType.label.size, color: tokens.text.secondary },
    monoSmall: {
      fontFamily: 'monospace',
      fontSize: rnType.caption.size,
      color: tokens.text.secondary,
      flex: 1,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    chip: {
      fontSize: 10,
      color: tokens.text.secondary,
      backgroundColor: tokens.surface.muted,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      overflow: 'hidden',
    },
    chipMore: { fontSize: 10, color: tokens.text.tertiary, paddingHorizontal: rnSpacing.xs },
    meta: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    actions: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.lg, marginTop: 2 },
    link: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    trashRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    dangerLink: { fontSize: 13, fontWeight: '600', color: tokens.danger.DEFAULT },
    usageBox: {
      marginTop: rnSpacing.xs,
      padding: 10,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.card,
      borderWidth: 1,
      borderColor: tokens.border.light,
      gap: rnSpacing.xs,
    },
    usageTitle: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tokens.text.primary,
      marginTop: 2,
    },
    secret: {
      fontFamily: 'monospace',
      fontSize: 13,
      color: tokens.text.primary,
      paddingVertical: 6,
      paddingHorizontal: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.bg,
    },
    endpointRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
