// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 平台账号 —— 对齐 web `/publish/accounts`(apps/web/app/(main)/publish/accounts/page.tsx)。
 *
 * 端点按 apps/api/src/routes/publish-routes.ts + apps/ai-service/app/routers/publish.py 现读:
 *  - GET    /api/publish/accounts/me                 ⇒ { items, count }(身份由 JWT 取,忽略路径段)
 *  - DELETE /api/publish/accounts/:accountId         ⇒ 软删除(status=disabled)
 *  - POST   /api/publish/accounts/:accountId/verify  ⇒ { ok, message }(仅 active 可验证)
 *  - GET    /api/publish/platforms                   ⇒ { items: [{ platformId, platformName }] }
 *  - GET    /api/publish/scan-login/platforms         ⇒ { platforms: [{ platform }] }
 *  - POST   /api/publish/scan-login/start            ⇒ { task_id, status, snapshot }
 *  - GET    /api/publish/scan-login/:taskId/status   ⇒ { task_id, status, stage, has_qr, ... }
 *  - POST   /api/publish/scan-login/:taskId/cancel
 *
 * 「重新授权」走真实扫码链路:start → 轮询 status → 展示服务端截图二维码 → 成功自动刷新。
 * 不搬 web 的批量导入 / 批量验证 / 分组管理(移动端低频)。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AlertCircle, QrCode, Trash2, X } from 'lucide-react-native'
import { fetchApi, getToken } from '@ihui/api-client'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface PublishAccount {
  id: number
  platform: string
  displayName: string
  status: string
  hasCredentials?: boolean
  lastVerifiedAt?: string | null
  lastVerifyMsg?: string | null
  createdAt?: string | null
}

interface ScanTask {
  task_id: string
  status: string
  message?: string
  stage?: string
  has_qr?: boolean
  qr_updated_at?: number
}

const TERMINAL = new Set(['success', 'failed', 'timeout', 'cancelled'])

function fmt(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export default function PublishAccountsScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [accounts, setAccounts] = useState<PublishAccount[]>([])
  const [platformNames, setPlatformNames] = useState<Record<string, string>>({})
  const [scanPlatforms, setScanPlatforms] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [panel, setPanel] = useState<PublishAccount | null>(null)
  const [scan, setScan] = useState<ScanTask | null>(null)
  const [scanError, setScanError] = useState('')
  const [starting, setStarting] = useState(false)
  const scanRef = useRef<ScanTask | null>(null)
  scanRef.current = scan

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetchApi<{ items?: PublishAccount[] }>('/api/publish/accounts/me')
      if (!res.success) throw new Error(res.error)
      setAccounts(res.data?.items ?? [])
    } catch {
      setAccounts([])
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    void (async () => {
      try {
        const res = await fetchApi<{ items?: Array<{ platformId: string; platformName: string }> }>(
          '/api/publish/platforms',
        )
        if (!res.success) return
        const map: Record<string, string> = {}
        for (const item of res.data?.items ?? []) map[item.platformId] = item.platformName
        setPlatformNames(map)
      } catch {
        // 平台名只是展示增强,取不到时回落到平台 id
      }
    })()
    void (async () => {
      try {
        const res = await fetchApi<{ platforms?: Array<{ platform: string }> }>(
          '/api/publish/scan-login/platforms',
        )
        if (!res.success) return
        setScanPlatforms(new Set((res.data?.platforms ?? []).map((p) => p.platform)))
      } catch {
        // 取不到支持清单时保持 null:按"未知"处理,点重新授权后再由后端裁决
      }
    })()
  }, [load])

  // 扫码任务轮询:成功 ⇒ 关闭弹层 + 刷新账号;终态失败 ⇒ 展示原因
  useEffect(() => {
    const task = scan
    if (!task || TERMINAL.has(task.status)) return
    const timer = setInterval(() => {
      void (async () => {
        try {
          const res = await fetchApi<ScanTask>(
            `/api/publish/scan-login/${encodeURIComponent(task.task_id)}/status`,
          )
          if (!res.success) return
          const next = res.data
          if (!next) return
          setScan(next)
          if (next.status === 'success') {
            setScan(null)
            setPanel(null)
            appAlert(t('publishAccounts.scanSuccess'))
            await load()
          } else if (TERMINAL.has(next.status)) {
            setScanError(next.message || t('publishAccounts.scanFailed'))
          }
        } catch {
          // 单次轮询失败静默,下一轮继续
        }
      })()
    }, 2500)
    return () => clearInterval(timer)
  }, [scan, t, load])

  const canScan = (platform: string) => scanPlatforms === null || scanPlatforms.has(platform)

  const closePanel = () => {
    const task = scanRef.current
    if (task && !TERMINAL.has(task.status)) {
      void fetchApi(`/api/publish/scan-login/${encodeURIComponent(task.task_id)}/cancel`, {
        method: 'POST',
      }).catch(() => undefined)
    }
    setScan(null)
    setScanError('')
    setPanel(null)
  }

  const onUnbind = (account: PublishAccount) => {
    appAlert(
      t('publishAccounts.unbindTitle'),
      t('publishAccounts.unbindConfirm', { name: account.displayName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const res = await fetchApi(`/api/publish/accounts/${account.id}`, {
                  method: 'DELETE',
                })
                if (!res.success) throw new Error(res.error)
                setPanel(null)
                appAlert(t('publishAccounts.unbindSuccess'))
                await load()
              } catch {
                appAlert(t('common.error'), t('publishAccounts.unbindFailed'))
              }
            })()
          },
        },
      ],
    )
  }

  const onStartScan = async (account: PublishAccount) => {
    if (!canScan(account.platform)) {
      appAlert(t('publishAccounts.reauthUnsupported'))
      return
    }
    setStarting(true)
    setScanError('')
    try {
      const res = await fetchApi<ScanTask>('/api/publish/scan-login/start', {
        method: 'POST',
        body: JSON.stringify({ platform: account.platform, reuse_session: false }),
      })
      if (!res.success || !res.data?.task_id) {
        throw new Error(res.success ? 'missing task_id' : res.error)
      }
      setScan(res.data)
    } catch {
      setScanError(t('publishAccounts.scanFailed'))
    } finally {
      setStarting(false)
    }
  }

  const statusLabel = (a: PublishAccount): string => {
    if (a.status === 'disabled' && a.hasCredentials === false)
      return t('publishAccounts.statusCleared')
    if (a.status === 'active') return t('publishAccounts.statusActive')
    if (a.status === 'disabled') return t('publishAccounts.statusDisabled')
    if (a.status === 'expired') return t('publishAccounts.statusExpired')
    return t('publishAccounts.statusUnknown')
  }

  const qrUrl = scan?.task_id
    ? `${API_BASE_URL}/api/publish/scan-login/${encodeURIComponent(scan.task_id)}/qr?v=${
        scan.qr_updated_at ?? 0
      }`
    : ''
  const token = getToken()
  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('publishAccounts.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>{t('publishAccounts.subtitle')}</Text>

        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('publishAccounts.loadFailed')}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : accounts.length === 0 ? (
          <View style={styles.stateBox}>
            <AlertCircle size={28} color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('publishAccounts.empty')}</Text>
            <Text style={styles.hint}>{t('publishAccounts.emptyHint')}</Text>
          </View>
        ) : (
          accounts.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.card}
              onPress={() => {
                setScan(null)
                setScanError('')
                setPanel(a)
              }}
              activeOpacity={0.7}
            >
              <View style={styles.itemHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(platformNames[a.platform] ?? a.platform).slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {a.displayName || a.platform}
                  </Text>
                  <Text style={styles.itemDesc} numberOfLines={1}>
                    {platformNames[a.platform] ?? a.platform}
                  </Text>
                </View>
                <View style={[styles.pill, a.status === 'active' ? styles.pillOn : null]}>
                  <Text style={[styles.pillText, a.status === 'active' ? styles.pillTextOn : null]}>
                    {statusLabel(a)}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {t('publishAccounts.boundAt')}: {fmt(a.createdAt, locale)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={panel !== null} transparent animationType="slide" onRequestClose={closePanel}>
        <View style={styles.overlay}>
          <Pressable style={styles.mask} onPress={closePanel} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {scan ? t('publishAccounts.scanTitle') : panel?.displayName}
              </Text>
              <Pressable onPress={closePanel} hitSlop={8}>
                <X size={18} color={tokens.text.secondary} />
              </Pressable>
            </View>

            {scan ? (
              <View style={styles.scanBox}>
                <Text style={styles.muted}>{scan.message || t('publishAccounts.scanWaiting')}</Text>
                {scan.has_qr && qrUrl ? (
                  <Image
                    source={{
                      uri: qrUrl,
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    }}
                    style={styles.qr}
                    resizeMode="contain"
                  />
                ) : (
                  <ActivityIndicator color={tokens.text.tertiary} />
                )}
                <Text style={styles.hint}>{t('publishAccounts.scanHint')}</Text>
                {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}
                <TouchableOpacity
                  style={styles.outlineBtn}
                  onPress={closePanel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.outlineBtnText}>{t('publishAccounts.scanCancel')}</Text>
                </TouchableOpacity>
              </View>
            ) : panel ? (
              <View style={styles.panelBody}>
                <Text style={styles.muted}>
                  {t('publishAccounts.platform')}: {platformNames[panel.platform] ?? panel.platform}
                </Text>
                <Text style={styles.muted}>
                  {t('publishAccounts.status')}: {statusLabel(panel)}
                </Text>
                <Text style={styles.muted}>
                  {t('publishAccounts.boundAt')}: {fmt(panel.createdAt, locale)}
                </Text>
                {panel.lastVerifyMsg ? (
                  <Text style={styles.hint} numberOfLines={3}>
                    {panel.lastVerifyMsg}
                  </Text>
                ) : null}
                {panel.status !== 'active' ? (
                  <Text style={styles.hint}>{t('publishAccounts.clearedHint')}</Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.primaryBtn, starting && styles.disabled]}
                  onPress={() => void onStartScan(panel)}
                  disabled={starting}
                  activeOpacity={0.7}
                >
                  <QrCode size={14} color={tokens.brand.ctaForeground} />
                  <Text style={styles.primaryBtnText}>
                    {starting ? t('publishAccounts.scanStarting') : t('publishAccounts.reauth')}
                  </Text>
                </TouchableOpacity>
                {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}
                <TouchableOpacity
                  style={styles.dangerBtn}
                  onPress={() => onUnbind(panel)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={14} color={tokens.danger.DEFAULT} />
                  <Text style={styles.dangerText}>{t('publishAccounts.unbind')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: 10, paddingBottom: rnSpacing['3xl'] },
    subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: 6,
    },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.lg,
      backgroundColor: tokens.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: rnType.title.size, fontWeight: '700', color: tokens.text.secondary },
    itemMain: { flex: 1, gap: 2 },
    itemName: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.text.primary },
    itemDesc: { fontSize: rnType.label.size, color: tokens.text.secondary },
    meta: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
    pill: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tokens.surface.muted,
    },
    pillOn: { backgroundColor: tokens.success.light },
    pillText: { fontSize: 10, color: tokens.text.secondary },
    pillTextOn: { color: tokens.success.deepText, fontWeight: '600' },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['5xl'],
    },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    hint: { fontSize: rnType.caption.size, color: tokens.text.tertiary, lineHeight: 16 },
    errorText: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    overlay: { flex: 1, justifyContent: 'flex-end' },
    mask: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: tokens.overlay.modal,
    },
    sheet: {
      maxHeight: '85%',
      padding: rnSpacing.lg,
      gap: 10,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tokens.surface.card,
    },
    sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sheetTitle: {
      flex: 1,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    panelBody: { gap: rnSpacing.sm },
    scanBox: { alignItems: 'center', gap: 10, paddingVertical: rnSpacing.sm },
    qr: { width: 200, height: 200, borderRadius: rnRadius.md },
    outlineBtn: {
      height: 40,
      paddingHorizontal: 14,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    outlineBtnText: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    primaryBtn: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    primaryBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    dangerBtn: {
      height: 40,
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerText: { fontSize: 13, fontWeight: '600', color: tokens.danger.DEFAULT },
    disabled: { opacity: 0.5 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
