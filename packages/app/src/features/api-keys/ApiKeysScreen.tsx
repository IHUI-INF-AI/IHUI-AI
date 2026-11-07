// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Trash2,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import {
  type ApiKeyInfo,
  type ApiKeyPermission,
  type ApiKeysScreenProps,
  type ApiKeyUsage,
} from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { TextField } from '../../components/TextField'

/** ApiKeys 共享屏:RN / 小程序 / web 三端同源渲染;平台件全部由宿主注入 */
export type { ApiKeyUsage }

/** 脱敏展示:保留首尾(与两端现有实现同形) */
function maskKey(key: string): string {
  return key.length <= 14 ? key : `${key.slice(0, 10)}...${key.slice(-4)}`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** 一次性 secret 的关闭冷却(毫秒):防误触,数据安全保护,不是体验糖 */
const SECRET_CLOSE_COOLDOWN_MS = 2000

export function ApiKeysScreen({
  t,
  colorScheme = 'light',
  list,
  loading,
  error,
  onReload,
  permissionOptions,
  defaultPermissions,
  onCreate,
  creating = false,
  createError,
  secret,
  onCloseSecret,
  onRotate,
  onDelete,
  rotatingId,
  deletingId,
  onLoadUsage,
  onCopy,
  onConfirm,
}: ApiKeysScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<ApiKeyPermission[]>(() => [...defaultPermissions])
  const [permsOpen, setPermsOpen] = useState(false)
  const [rateLimit, setRateLimit] = useState('60')
  const [localError, setLocalError] = useState<string | null>(null)
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [usageOf, setUsageOf] = useState<string | null>(null)
  const [usage, setUsage] = useState<Record<string, ApiKeyUsage>>({})
  const [usageLoading, setUsageLoading] = useState<string | null>(null)
  const [usageError, setUsageError] = useState<Record<string, string>>({})
  // 裁决 1:2 秒防误触作用于「关闭动作」,期间按钮置灰
  const [canCloseSecret, setCanCloseSecret] = useState(false)

  useEffect(() => {
    if (!secret) {
      setCanCloseSecret(false)
      return
    }
    setCanCloseSecret(false)
    const timer = setTimeout(() => setCanCloseSecret(true), SECRET_CLOSE_COOLDOWN_MS)
    return () => clearTimeout(timer)
  }, [secret])

  const togglePerm = (perm: ApiKeyPermission) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    )
  }

  const submitCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError(t('apiKeys.nameRequired'))
      return
    }
    if (permissions.length === 0) {
      setLocalError(t('apiKeys.permissionsRequired'))
      return
    }
    setLocalError(null)
    const parsed = Number(rateLimit)
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 60
    try {
      await onCreate({ name: trimmed, permissions, rateLimit: limit })
      setName('')
      setPermissions([...defaultPermissions])
      setRateLimit('60')
      setPermsOpen(false)
    } catch {
      // 失败提示由宿主的 mutation onError / createError 负责
    }
  }

  const askConfirm = async (options: {
    title: string
    message: string
    destructive: boolean
  }): Promise<boolean> => {
    if (!onConfirm) return true
    try {
      return await onConfirm(options)
    } catch {
      return false
    }
  }

  const askRotate = async (key: ApiKeyInfo) => {
    const ok = await askConfirm({
      title: t('apiKeys.rotateTitle'),
      message: t('apiKeys.rotateConfirm', { name: key.name }),
      destructive: true,
    })
    if (!ok) return
    try {
      await onRotate(key.id)
    } catch {
      // 宿主负责错误提示
    }
  }

  const askDelete = async (key: ApiKeyInfo) => {
    const ok = await askConfirm({
      title: t('apiKeys.deleteTitle'),
      message: t('apiKeys.deleteConfirm', { name: key.name }),
      destructive: true,
    })
    if (!ok) return
    try {
      await onDelete(key.id)
    } catch {
      // 宿主负责错误提示
    }
  }

  const toggleUsage = async (id: string) => {
    if (usageOf === id) {
      setUsageOf(null)
      return
    }
    setUsageOf(id)
    if (usage[id] || !onLoadUsage) return
    setUsageLoading(id)
    setUsageError((prev) => ({ ...prev, [id]: '' }))
    try {
      const data = await onLoadUsage(id)
      setUsage((prev) => ({ ...prev, [id]: data }))
    } catch {
      setUsageError((prev) => ({ ...prev, [id]: t('apiKeys.usageFailed') }))
    } finally {
      setUsageLoading(null)
    }
  }

  const shownError = createError || localError

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <KeyRound size={22} color={tk.brand.cta} />
        <Text style={styles.headerTitle}>{t('apiKeys.title')}</Text>
      </View>
      <Text style={styles.subtitle}>{t('apiKeys.subtitle')}</Text>

      {secret ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {secret.source === 'rotate' ? t('apiKeys.rotateSecretTitle') : t('apiKeys.secretTitle')}
          </Text>
          <Text style={styles.muted}>{t('apiKeys.secretHint')}</Text>
          <Text selectable style={styles.secret}>
            {secret.value}
          </Text>
          <View style={styles.secretRow}>
            <TouchableOpacity
              style={[styles.button, styles.secretBtn]}
              onPress={() => onCopy?.(secret.value, 'secret')}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>{t('apiKeys.copySecret')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secretBtn, !canCloseSecret && styles.disabled]}
              onPress={() => canCloseSecret && onCloseSecret()}
              disabled={!canCloseSecret}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>{t('apiKeys.secretDone')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Plus size={16} color={tk.text.secondary} />
          <Text style={styles.cardTitle}>{t('apiKeys.createTitle')}</Text>
        </View>
        <Text style={styles.label}>{t('apiKeys.nameLabel')}</Text>
        <TextField
          colorScheme={colorScheme}
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
          <View style={styles.permsMeta}>
            <Text style={styles.countBadge}>{permissions.length}</Text>
            {permsOpen ? (
              <ChevronUp size={14} color={tk.text.tertiary} />
            ) : (
              <ChevronDown size={14} color={tk.text.tertiary} />
            )}
          </View>
        </TouchableOpacity>
        {permsOpen ? (
          <>
            <View style={styles.permGrid}>
              {permissionOptions.map((opt) => {
                const checked = permissions.includes(opt.value)
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => togglePerm(opt.value)}
                    activeOpacity={0.7}
                    style={[styles.permChip, checked && styles.permChipOn]}
                  >
                    <Text style={[styles.permText, checked && styles.permTextOn]}>{opt.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        ) : null}
        <Text style={styles.label}>{t('apiKeys.rateLimitLabel')}</Text>
        <TextField
          colorScheme={colorScheme}
          value={rateLimit}
          onChangeText={setRateLimit}
          placeholder="60"
          style={styles.input}
          editable={!creating}
          keyboardType="numeric"
        />
        {shownError ? <Text style={styles.error}>{shownError}</Text> : null}
        <TouchableOpacity
          style={[styles.button, creating && styles.disabled]}
          onPress={() => void submitCreate()}
          disabled={creating}
          activeOpacity={0.7}
        >
          {creating ? (
            <ActivityIndicator color={tk.brand.ctaForeground} />
          ) : (
            <Text style={styles.buttonText}>{t('apiKeys.createButton')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <KeyRound size={16} color={tk.text.secondary} />
          <Text style={styles.cardTitle}>{t('apiKeys.listTitle')}</Text>
        </View>
        {loading ? (
          <ActivityIndicator style={styles.loading} color={tk.text.tertiary} />
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity style={styles.outlineButton} onPress={onReload} activeOpacity={0.7}>
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
                        { color: active ? tk.success.DEFAULT : tk.text.tertiary },
                      ]}
                    >
                      {active ? t('apiKeys.statusActive') : t('apiKeys.statusRevoked')}
                    </Text>
                  </View>
                </View>
                <View style={styles.keyLine}>
                  <Text selectable style={styles.mono}>
                    {visible[key.id] ? key.key : maskKey(key.key)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setVisible((v) => ({ ...v, [key.id]: !v[key.id] }))}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    {visible[key.id] ? (
                      <EyeOff size={13} color={tk.text.tertiary} />
                    ) : (
                      <Eye size={13} color={tk.text.tertiary} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onCopy?.(key.key, 'key')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Copy size={13} color={tk.text.tertiary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.chips}>
                  {permissionOptions
                    .filter((opt) => key.permissions.includes(opt.value))
                    .map((opt) => (
                      <Text key={opt.value} style={styles.chip}>
                        {opt.label}
                      </Text>
                    ))}
                </View>
                <Text style={styles.meta}>
                  {t('apiKeys.createdAt')}: {fmtDate(key.createdAt)} · {t('apiKeys.lastUsedAt')}:{' '}
                  {key.lastUsedAt ? fmtDate(key.lastUsedAt) : t('apiKeys.lastUsedNever')}
                  {typeof key.rateLimit === 'number'
                    ? ` · ${t('apiKeys.rateLimitPerMinute', { rateLimit: key.rateLimit })}`
                    : ''}
                </Text>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => void toggleUsage(key.id)} activeOpacity={0.7}>
                    <Text style={styles.link}>{t('apiKeys.usage')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void askRotate(key)}
                    disabled={rotatingId === key.id}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.link}>{t('apiKeys.rotate')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void askDelete(key)}
                    disabled={deletingId === key.id}
                    activeOpacity={0.7}
                  >
                    <View style={styles.trashRow}>
                      <Trash2 size={13} color={tk.danger.DEFAULT} />
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
                          {t('apiKeys.callsTotal', { times: u.callCount })} ·{' '}
                          {t('apiKeys.lastUsedAt')}:{' '}
                          {u.lastUsedAt ? fmtDate(u.lastUsedAt) : t('apiKeys.lastUsedNever')}
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
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    body: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    header: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    headerTitle: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    subtitle: { fontSize: rnType.bodySm.size, color: tk.text.secondary, marginTop: -rnSpacing.sm },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['xs-loose'] },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    label: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tk.text.primary },
    muted: { fontSize: rnType.bodySm.size, color: tk.text.secondary, lineHeight: 19 },
    error: { fontSize: rnType.bodySm.size, color: tk.danger.DEFAULT },
    loading: { paddingVertical: rnSpacing.lg },
    centerBox: { alignItems: 'center', gap: rnSpacing.sm, paddingVertical: rnSpacing.lg },
    emptyTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    input: {
      height: 42,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      color: tk.text.primary,
      fontSize: rnType.strong.size,
      backgroundColor: tk.surface.bg,
    },
    permsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    permsMeta: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['xs-loose'] },
    countBadge: {
      fontSize: rnType.badge.size,
      fontWeight: '600',
      color: tk.text.secondary,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      overflow: 'hidden',
    },
    permGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing['xs-loose'],
      marginTop: rnSpacing.xs,
    },
    permChip: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    permChipOn: { borderColor: tk.brandAccent.deep, backgroundColor: tk.brandAccent.light },
    permText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    permTextOn: { color: tk.brandAccent.foreground, fontWeight: '600' },
    button: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: rnSpacing.xs,
    },
    disabled: { opacity: 0.5 },
    buttonText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    outlineButton: {
      height: 36,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineText: { fontSize: rnType.body.size, color: tk.text.primary },
    keyRow: {
      gap: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing['sm-loose'],
      paddingHorizontal: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.bg,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    keyName: {
      flex: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    keyLine: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    badge: {
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      borderWidth: 1,
    },
    badgeOn: { borderColor: tk.success.DEFAULT },
    badgeOff: { borderColor: tk.border.medium },
    badgeText: { fontSize: rnType.badge.size, fontWeight: '600' },
    mono: { fontFamily: 'monospace', fontSize: rnType.label.size, color: tk.text.secondary },
    monoSmall: {
      fontFamily: 'monospace',
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
      flex: 1,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    chip: {
      fontSize: rnType.badge.size,
      color: tk.text.secondary,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      overflow: 'hidden',
    },
    meta: { fontSize: rnType.label.size, color: tk.text.tertiary },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.lg,
      marginTop: rnSpacing['2xs'],
    },
    link: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tk.text.primary },
    trashRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    dangerLink: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tk.danger.DEFAULT },
    usageBox: {
      marginTop: rnSpacing.xs,
      padding: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
      borderWidth: 1,
      borderColor: tk.border.light,
      gap: rnSpacing.xs,
    },
    usageTitle: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginTop: rnSpacing['2xs'],
    },
    secret: {
      fontFamily: 'monospace',
      fontSize: rnType.bodySm.size,
      color: tk.text.primary,
      paddingVertical: rnSpacing['xs-loose'],
      paddingHorizontal: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.bg,
    },
    secretRow: { flexDirection: 'row', gap: rnSpacing.sm },
    secretBtn: { flex: 1 },
    endpointRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
