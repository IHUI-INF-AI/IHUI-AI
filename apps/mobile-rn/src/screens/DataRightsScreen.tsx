// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
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
import { Download, Share2, Trash2 } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { logoutAuth } from '../stores/auth-store'
import type { RootStackParamList } from '../navigation/RootNavigator'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
/**
 * 对齐 web `/settings/data-rights`（apps/web/app/(main)/settings/data-rights/page.tsx）。
 *
 * 端点按 apps/api/src/routes/gdpr.ts 现读（prefix `/api/gdpr`）：
 *  - POST /api/gdpr/export       → { user, searchHistory[], auditLogs[], … }
 *  - POST /api/gdpr/portability  → { schema, exportedAt, subject, data }（注意是 POST，不是 GET）
 *  - POST /api/gdpr/erase        → { erased: true, userId }（服务端软删 + PII 匿名化）
 * 后端不保存"申请单"记录，故本屏的「最近操作回执」只反映本机最近一次调用结果与时间，
 * 不谎称为服务端申请状态。
 */
interface ExportUser {
  id: string
  phone: string | null
  email: string | null
  username: string | null
  nickname: string | null
  createdAt: string
}
interface ExportData {
  user: ExportUser
  searchHistory: unknown[]
  auditLogs: unknown[]
}
interface PortabilityData {
  schema: string
  exportedAt: string
  subject: { id: string; identifier: string | null }
  data: {
    profile?: { nickname?: string | null; email?: string | null }
    searchHistory?: unknown[]
    auditTrail?: unknown[]
    addresses?: unknown[]
    notes?: unknown[]
    memories?: unknown[]
    chat?: { conversations?: unknown[]; messageCount?: number }
    orders?: unknown[]
  }
}
interface EraseData {
  erased: boolean
  userId: string
}
type ReceiptKind = 'export' | 'portability' | 'erase'
interface Receipt {
  kind: ReceiptKind
  ok: boolean
  at: string
}
const ERASE_WORD = 'DELETE'
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
function countOf(value: unknown[] | undefined): number {
  return Array.isArray(value) ? value.length : 0
}
export default function DataRightsScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [exportData, setExportData] = useState<ExportData | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [portability, setPortability] = useState<PortabilityData | null>(null)
  const [portLoading, setPortLoading] = useState(false)
  const [portError, setPortError] = useState<string | null>(null)
  const [eraseOpen, setEraseOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [erasing, setErasing] = useState(false)
  const [eraseError, setEraseError] = useState<string | null>(null)
  const [erased, setErased] = useState(false)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const styles = makeStyles()
  const canErase = confirmText.trim() === ERASE_WORD && !erasing
  const pushReceipt = (kind: ReceiptKind, ok: boolean) => {
    setReceipts((prev) => [{ kind, ok, at: new Date().toISOString() }, ...prev].slice(0, 5))
  }
  const receiptLabel = (kind: ReceiptKind): string => {
    if (kind === 'export') return t('dataRights.recentExport')
    if (kind === 'portability') return t('dataRights.recentPortability')
    return t('dataRights.recentErase')
  }
  const onExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const res = await fetchApi<ExportData>('/api/gdpr/export', { method: 'POST' })
      if (!res.success) {
        setExportError(res.error || t('dataRights.exportFailed'))
        pushReceipt('export', false)
        return
      }
      setExportData(res.data)
      pushReceipt('export', true)
    } catch {
      setExportError(t('dataRights.exportFailed'))
      pushReceipt('export', false)
    } finally {
      setExporting(false)
    }
  }
  const onPortability = async () => {
    setPortLoading(true)
    setPortError(null)
    try {
      const res = await fetchApi<PortabilityData>('/api/gdpr/portability', { method: 'POST' })
      if (!res.success) {
        setPortError(res.error || t('dataRights.portabilityFailed'))
        pushReceipt('portability', false)
        return
      }
      setPortability(res.data)
      pushReceipt('portability', true)
    } catch {
      setPortError(t('dataRights.portabilityFailed'))
      pushReceipt('portability', false)
    } finally {
      setPortLoading(false)
    }
  }
  const onErase = async () => {
    if (!canErase) return
    setErasing(true)
    setEraseError(null)
    try {
      const res = await fetchApi<EraseData>('/api/gdpr/erase', { method: 'POST' })
      if (!res.success) {
        setEraseError(res.error || t('dataRights.eraseFailed'))
        pushReceipt('erase', false)
        return
      }
      if (!res.data.erased) {
        setEraseError(t('dataRights.eraseFailed'))
        pushReceipt('erase', false)
        return
      }
      setEraseOpen(false)
      setConfirmText('')
      setErased(true)
      pushReceipt('erase', true)
      // 服务端已匿名化账号并吊销 refresh token：本地会话必须同步清掉（对齐 web 的 logout()）。
      void logoutAuth().catch(() => {})
    } catch {
      setEraseError(t('dataRights.eraseFailed'))
      pushReceipt('erase', false)
    } finally {
      setErasing(false)
    }
  }
  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('dataRights.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView contentContainerStyle={styles.body}>
        {erased ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('dataRights.eraseSuccess')}</Text>
            <Text style={styles.muted}>{t('dataRights.eraseDone')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Download size={16} color={tokens.text.secondary} />
                <Text style={styles.cardTitle}>{t('dataRights.exportCard')}</Text>
              </View>
              <Text style={styles.muted}>{t('dataRights.exportDesc')}</Text>
              <TouchableOpacity
                style={[styles.button, exporting && styles.disabled]}
                onPress={() => {
                  void onExport()
                }}
                disabled={exporting}
                activeOpacity={0.7}
              >
                {exporting ? (
                  <ActivityIndicator color={tokens.brand.ctaForeground} />
                ) : (
                  <Text style={styles.buttonText}>{t('dataRights.exportButton')}</Text>
                )}
              </TouchableOpacity>
              {exportError ? <Text style={styles.error}>{exportError}</Text> : null}
              {exportData ? (
                <View style={styles.resultBox}>
                  <Text style={styles.subTitle}>{t('dataRights.exportResult')}</Text>
                  <Text style={styles.meta}>{t('dataRights.userInfo')}</Text>
                  <Text style={styles.value}>
                    {exportData.user.nickname || exportData.user.username || '—'}
                  </Text>
                  <Text style={styles.meta}>
                    {exportData.user.email || exportData.user.phone || '—'} ·{' '}
                    {t('dataRights.searchHistory')}: {exportData.searchHistory.length} ·{' '}
                    {t('dataRights.auditLogs')}: {exportData.auditLogs.length}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Share2 size={16} color={tokens.text.secondary} />
                <Text style={styles.cardTitle}>{t('dataRights.portabilityCard')}</Text>
              </View>
              <Text style={styles.muted}>{t('dataRights.portabilityDesc')}</Text>
              <TouchableOpacity
                style={[styles.button, portLoading && styles.disabled]}
                onPress={() => {
                  void onPortability()
                }}
                disabled={portLoading}
                activeOpacity={0.7}
              >
                {portLoading ? (
                  <ActivityIndicator color={tokens.brand.ctaForeground} />
                ) : (
                  <Text style={styles.buttonText}>{t('dataRights.portabilityButton')}</Text>
                )}
              </TouchableOpacity>
              {portError ? <Text style={styles.error}>{portError}</Text> : null}
              {portability ? (
                <View style={styles.resultBox}>
                  <Text style={styles.subTitle}>{t('dataRights.portabilityResult')}</Text>
                  <Text style={styles.meta}>
                    {t('dataRights.schema')}: {portability.schema} · {t('dataRights.exportedAt')}:{' '}
                    {fmt(portability.exportedAt, locale)} · {t('dataRights.subject')}:{' '}
                    {portability.subject.identifier || '—'}
                  </Text>
                  <Text style={styles.subTitle}>{t('dataRights.summaryTitle')}</Text>
                  <Text style={styles.meta}>
                    {t('dataRights.searchHistory')}: {countOf(portability.data.searchHistory)} ·{' '}
                    {t('dataRights.auditLogs')}: {countOf(portability.data.auditTrail)}
                  </Text>
                  <Text style={styles.meta}>
                    {t('dataRights.notes')}: {countOf(portability.data.notes)} ·{' '}
                    {t('dataRights.memories')}: {countOf(portability.data.memories)} ·{' '}
                    {t('dataRights.conversations')}: {countOf(portability.data.chat?.conversations)}
                  </Text>
                  <Text style={styles.meta}>
                    {t('dataRights.addresses')}: {countOf(portability.data.addresses)} ·{' '}
                    {t('dataRights.orders')}: {countOf(portability.data.orders)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Trash2 size={16} color={tokens.danger.DEFAULT} />
                <Text style={styles.dangerTitle}>{t('dataRights.eraseCard')}</Text>
              </View>
              <Text style={styles.muted}>{t('dataRights.eraseDesc')}</Text>
              {!eraseOpen ? (
                <TouchableOpacity
                  style={styles.dangerOutline}
                  onPress={() => {
                    setEraseError(null)
                    setConfirmText('')
                    setEraseOpen(true)
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dangerText}>{t('dataRights.eraseButton')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.dangerBox}>
                  <Text style={styles.dangerTitle}>{t('dataRights.eraseConfirmTitle')}</Text>
                  <Text style={styles.muted}>{t('dataRights.eraseConfirmHint')}</Text>
                  <Text style={styles.label}>{t('dataRights.eraseConfirmWord')}</Text>
                  <TextField
                    colorScheme={resolvedTheme}
                    value={confirmText}
                    onChangeText={setConfirmText}
                    placeholder={ERASE_WORD}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={styles.input}
                    editable={!erasing}
                    maxLength={16}
                  />
                  {eraseError ? <Text style={styles.error}>{eraseError}</Text> : null}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.outlineButton, styles.flex1]}
                      onPress={() => {
                        setEraseOpen(false)
                        setConfirmText('')
                        setEraseError(null)
                      }}
                      disabled={erasing}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.outlineText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dangerButton, styles.flex1, !canErase && styles.disabled]}
                      onPress={() => void onErase()}
                      disabled={!canErase}
                      activeOpacity={0.7}
                    >
                      {erasing ? (
                        <ActivityIndicator color={tokens.brand.ctaForeground} />
                      ) : (
                        <Text style={styles.buttonText}>{t('common.confirm')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('dataRights.recentTitle')}</Text>
              {receipts.length === 0 ? (
                <Text style={styles.muted}>{t('dataRights.noRecent')}</Text>
              ) : (
                receipts.map((r, i) => (
                  <View key={`${r.at}-${i}`} style={styles.receiptRow}>
                    <Text style={styles.receiptName}>{receiptLabel(r.kind)}</Text>
                    <Text
                      style={[
                        styles.receiptStatus,
                        { color: r.ok ? tokens.success.DEFAULT : tokens.danger.DEFAULT },
                      ]}
                    >
                      {r.ok ? t('dataRights.statusSuccess') : t('dataRights.statusFailed')}
                    </Text>
                    <Text style={styles.meta}>{fmt(r.at, locale)}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
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
    dangerTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.danger.DEFAULT },
    subTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: tokens.text.primary,
      marginTop: rnSpacing.xs,
    },
    label: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    meta: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    value: { fontSize: rnType.body.size, color: tokens.text.primary },
    error: { fontSize: 13, color: tokens.danger.DEFAULT },
    button: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: rnSpacing.xs,
    },
    buttonText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    disabled: { opacity: 0.5 },
    outlineButton: {
      height: 44,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineText: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.text.primary },
    dangerButton: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.danger.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerOutline: {
      height: 44,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.danger.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: rnSpacing.xs,
    },
    dangerText: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.danger.DEFAULT },
    dangerBox: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.danger.DEFAULT,
      backgroundColor: tokens.surface.bg,
    },
    buttonRow: { flexDirection: 'row', gap: rnSpacing.sm },
    flex1: { flex: 1 },
    input: {
      height: 42,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: rnType.strong.size,
      backgroundColor: tokens.surface.card,
    },
    resultBox: {
      gap: rnSpacing.xs,
      padding: 10,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.bg,
    },
    receiptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
    },
    receiptName: { flex: 1, fontSize: 13, color: tokens.text.primary },
    receiptStatus: { fontSize: rnType.label.size, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
