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
import {
  ChevronRight,
  History,
  KeyRound,
  Monitor,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react-native'
import QRCode from 'react-native-qrcode-svg'
import {
  disableTwoFactor,
  fetchApi,
  getAuthorizations,
  getSecurityScore,
  getTwoFactorStatus,
  revokeUserSession,
  setupTwoFactor,
  verifyTwoFactor,
  type AuthorizationSession,
  type SecurityScore,
  type TwoFactorSetup,
  type TwoFactorStatus,
} from '@ihui/api-client'
import { rnLightTokens, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { IpWhitelistPanel } from '../components/IpWhitelistPanel'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

/**
 * GET /api/user/login-history 的行 = audit_logs 投影(user.ts:117-127)。
 * 刻意不取 /settings/security-logs:`createSecurityLog` 全仓零调用方 ⇒ security_logs 是恒空表,
 * 读它的面板永远只能说"暂无",那不是数据,是没接上。
 */
interface LoginRow {
  id: string
  action: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

/** 已知的 audit_logs.action → 词条;表外取值一律显原文,不替它编一个中文名 */
const ACTION_LABEL_KEY: Record<string, string> = {
  'auth.login': 'securityCenter.logs.login',
}

/**
 * 安全中心 —— 对齐 web `/settings` 的「安全中心」页签。
 *
 * 与 web 侧的三处**契约更正**(照 web 旧组件抄会把假字段带到移动端):
 *  1. `/settings/authorizations` 只投影 `id/createdAt/expiresAt/familyId`,没有 ip/device/browser;
 *  2. `/settings/security-logs` 的实列是 `action/ip/userAgent/createdAt`,没有 time/device/status;
 *  3. `GET /api/user/ip-whitelist` 此前从未注册 ⇒ 本屏当时不接;2026-10-21 后端把读写面补真
 *     (apps/api/src/routes/user/security-config-routes.ts)后,本屏经 `IpWhitelistPanel` 接上。
 * 评分/2FA/会话均为真实现端点,逐项在调用处标注路径。
 */
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

export default function SecurityCenterScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [score, setScore] = useState<SecurityScore | null>(null)
  const [scoreLoading, setScoreLoading] = useState(true)

  const [twoFactor, setTwoFactor] = useState<TwoFactorStatus | null>(null)
  const [twoFactorLoading, setTwoFactorLoading] = useState(true)
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const [sessions, setSessions] = useState<AuthorizationSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  const [logs, setLogs] = useState<LoginRow[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  const loadScore = useCallback(async () => {
    setScoreLoading(true)
    try {
      const res = await getSecurityScore()
      setScore(res.success ? res.data : null)
    } catch {
      setScore(null)
    } finally {
      setScoreLoading(false)
    }
  }, [])

  const loadTwoFactor = useCallback(async () => {
    setTwoFactorLoading(true)
    try {
      const res = await getTwoFactorStatus()
      if (res.success && res.data) setTwoFactor(res.data)
      else setTwoFactor(null)
    } catch {
      setTwoFactor(null)
    } finally {
      setTwoFactorLoading(false)
    }
  }, [])

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await getAuthorizations({ page: 1, pageSize: PAGE_SIZE })
      setSessions(res.success && res.data ? res.data.list : [])
    } catch {
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetchApi<{ list: LoginRow[] }>(
        `/api/user/login-history?page=1&pageSize=${PAGE_SIZE}`,
      )
      setLogs(res.success && res.data ? res.data.list : [])
    } catch {
      setLogs([])
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadScore()
    void loadTwoFactor()
    void loadSessions()
    void loadLogs()
  }, [loadScore, loadTwoFactor, loadSessions, loadLogs])

  const onEnable2fa = async () => {
    setBusy(true)
    try {
      const res = await setupTwoFactor()
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('securityCenter.actionFailed'))
        return
      }
      setSetup(res.data)
      setBackupCodes(null)
      setCode('')
    } catch {
      appAlert(t('common.error'), t('securityCenter.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  const onVerify2fa = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      appAlert(t('common.error'), t('securityCenter.twoFactor.codeInvalid'))
      return
    }
    setBusy(true)
    try {
      const res = await verifyTwoFactor(code.trim())
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('securityCenter.twoFactor.verifyFailed'))
        return
      }
      setBackupCodes(res.data.backupCodes)
      setSetup(null)
      setCode('')
      void loadTwoFactor()
      void loadScore()
    } catch {
      appAlert(t('common.error'), t('securityCenter.twoFactor.verifyFailed'))
    } finally {
      setBusy(false)
    }
  }

  const onDisable2fa = () => {
    setBusy(true)
    void (async () => {
      try {
        const res = await disableTwoFactor(password)
        if (!res.success) {
          appAlert(t('common.error'), res.error || t('securityCenter.twoFactor.disableFailed'))
          return
        }
        setPassword('')
        setBackupCodes(null)
        void loadTwoFactor()
        void loadScore()
      } catch {
        appAlert(t('common.error'), t('securityCenter.twoFactor.disableFailed'))
      } finally {
        setBusy(false)
      }
    })()
  }

  /** 重新生成恢复码(明文只返回一次):后端 POST /api/mfa/recovery-codes ⇒ { recoveryCodes: string[] } */
  const onRegenRecoveryCodes = () => {
    appAlert(
      t('securityCenter.twoFactor.recoveryTitle'),
      t('securityCenter.twoFactor.recoveryConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setRecoveryBusy(true)
              try {
                const res = await fetchApi<{ recoveryCodes: string[] }>('/api/mfa/recovery-codes', {
                  method: 'POST',
                })
                if (!res.success) {
                  appAlert(
                    t('common.error'),
                    res.error || t('securityCenter.twoFactor.disableFailed'),
                  )
                  return
                }
                appAlert(
                  t('securityCenter.twoFactor.recoveryTitle'),
                  (res.data?.recoveryCodes ?? []).join(String.fromCharCode(10)),
                )
              } catch {
                appAlert(t('common.error'), t('securityCenter.twoFactor.disableFailed'))
              } finally {
                setRecoveryBusy(false)
              }
            })()
          },
        },
      ],
    )
  }

  const onRevoke = (session: AuthorizationSession) => {
    appAlert(t('securityCenter.sessions.revokeTitle'), t('securityCenter.sessions.revokeConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const res = await revokeUserSession(session.id)
              if (!res.success) {
                appAlert(t('common.error'), res.error || t('securityCenter.actionFailed'))
                return
              }
              void loadSessions()
            } catch {
              appAlert(t('common.error'), t('securityCenter.actionFailed'))
            }
          })()
        },
      },
    ])
  }

  /** 等级标签走静态映射表(动态拼键 `level_${level}` 会让键集对账看不见这一维) */
  const LEVEL_LABEL_KEY: Record<SecurityScore['level'], string> = {
    high: 'securityCenter.score.level_high',
    medium: 'securityCenter.score.level_medium',
    low: 'securityCenter.score.level_low',
  }

  const toneOfScore = score
    ? score.level === 'high'
      ? tokens.success.DEFAULT
      : score.level === 'medium'
        ? (tokens.warning?.DEFAULT ?? tokens.brand.DEFAULT)
        : tokens.danger.DEFAULT
    : tokens.text.tertiary

  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('securityCenter.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        {/* 安全评分 — GET /api/user/security-score */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('securityCenter.score.title')}</Text>
          {scoreLoading ? (
            <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
          ) : score ? (
            <>
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreValue, { color: toneOfScore }]}>{score.score}</Text>
                <Text style={styles.scoreMax}>/100</Text>
                <Text style={[styles.scoreLevel, { color: toneOfScore }]}>
                  {t(LEVEL_LABEL_KEY[score.level])}
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.trackFill,
                    {
                      width: `${Math.max(0, Math.min(100, score.score))}%`,
                      backgroundColor: toneOfScore,
                    },
                  ]}
                />
              </View>
            </>
          ) : (
            <Text style={styles.muted}>{t('securityCenter.loadFailed')}</Text>
          )}
        </View>

        {/* 两步验证 — GET/POST /api/auth/2fa/* */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <KeyRound size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('securityCenter.twoFactor.title')}</Text>
          </View>

          {twoFactorLoading ? (
            <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
          ) : twoFactor?.enabled ? (
            <>
              <Text style={styles.statusOn}>{t('securityCenter.twoFactor.enabled')}</Text>
              {twoFactor.enabledAt ? (
                <Text style={styles.muted}>
                  {t('securityCenter.twoFactor.enabledAt')} {fmt(twoFactor.enabledAt, locale)}
                </Text>
              ) : null}
              <Text style={styles.muted}>{t('securityCenter.twoFactor.disableHint')}</Text>

              <TouchableOpacity
                style={[styles.button, recoveryBusy && styles.buttonDisabled]}
                disabled={recoveryBusy}
                onPress={onRegenRecoveryCodes}
              >
                <Text style={styles.buttonText}>{t('securityCenter.twoFactor.regenRecovery')}</Text>
              </TouchableOpacity>
              <TextField
                colorScheme={resolvedTheme}
                value={password}
                onChangeText={setPassword}
                placeholder={t('securityCenter.twoFactor.passwordPlaceholder')}
                secureTextEntry
                style={styles.input}
                editable={!busy}
              />
              <TouchableOpacity
                style={[styles.button, styles.dangerButton, busy && styles.buttonDisabled]}
                onPress={onDisable2fa}
                disabled={busy || password.length === 0}
                activeOpacity={0.7}
              >
                <Text style={styles.dangerButtonText}>{t('securityCenter.twoFactor.disable')}</Text>
              </TouchableOpacity>
            </>
          ) : setup ? (
            <>
              <Text style={styles.muted}>{t('securityCenter.twoFactor.scanHint')}</Text>
              <View style={styles.qrWrap}>
                <QRCode value={setup.uri} size={168} />
              </View>
              <Text style={styles.muted}>{t('securityCenter.twoFactor.manualKey')}</Text>
              <Text selectable style={styles.secret}>
                {setup.secret}
              </Text>
              <TextField
                colorScheme={resolvedTheme}
                value={code}
                onChangeText={setCode}
                placeholder={t('securityCenter.twoFactor.codePlaceholder')}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
                editable={!busy}
              />
              <TouchableOpacity
                style={[styles.button, busy && styles.buttonDisabled]}
                onPress={onVerify2fa}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>{t('securityCenter.twoFactor.verify')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.muted}>{t('securityCenter.twoFactor.disabled')}</Text>
              <TouchableOpacity
                style={[styles.button, busy && styles.buttonDisabled]}
                onPress={onEnable2fa}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>{t('securityCenter.twoFactor.enable')}</Text>
              </TouchableOpacity>
            </>
          )}

          {backupCodes ? (
            <View style={styles.backupBox}>
              <Text style={styles.backupTitle}>{t('securityCenter.twoFactor.backupTitle')}</Text>
              <Text style={styles.muted}>{t('securityCenter.twoFactor.backupHint')}</Text>
              <View style={styles.backupGrid}>
                {backupCodes.map((c) => (
                  <Text key={c} selectable style={styles.backupCode}>
                    {c}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* 会话管理 — GET/DELETE /api/settings/authorizations */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Monitor size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('securityCenter.sessions.title')}</Text>
          </View>
          {sessionsLoading ? (
            <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
          ) : sessions.length === 0 ? (
            <Text style={styles.muted}>{t('securityCenter.sessions.empty')}</Text>
          ) : (
            sessions.map((s, i) => (
              <View key={s.id} style={[styles.row, i === sessions.length - 1 && styles.rowLast]}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowPrimary}>
                    {t('securityCenter.sessions.createdAt')} {fmt(s.createdAt, locale)}
                  </Text>
                  <Text style={styles.rowSecondary}>
                    {t('securityCenter.sessions.expiresAt')} {fmt(s.expiresAt, locale)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => onRevoke(s)} activeOpacity={0.7}>
                  <Text style={styles.revoke}>{t('securityCenter.sessions.revoke')}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* IP 白名单 — GET/POST/DELETE /api/user/ip-whitelist(面板自带取数与错误态) */}
        <IpWhitelistPanel />

        {/* 登录与安全事件 — GET /api/settings/security-logs */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <History size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('securityCenter.logs.title')}</Text>
          </View>
          {logsLoading ? (
            <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
          ) : logs.length === 0 ? (
            <Text style={styles.muted}>{t('securityCenter.logs.empty')}</Text>
          ) : (
            logs.map((l, i) => (
              <View key={l.id} style={[styles.row, i === logs.length - 1 && styles.rowLast]}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowPrimary}>{t(ACTION_LABEL_KEY[l.action] ?? l.action)}</Text>
                  <Text style={styles.rowSecondary}>
                    {fmt(l.createdAt, locale)}
                    {l.ip ? ` · ${l.ip}` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('SecuritySettings')}
          activeOpacity={0.7}
        >
          <ShieldCheck size={16} color={tokens.text.secondary} />
          <Text style={styles.linkText}>{t('securityCenter.openSwitches')}</Text>
          <ChevronRight size={16} color={tokens.text.tertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('SecurityAudit')}
          activeOpacity={0.7}
        >
          <ShieldCheck size={16} color={tokens.text.secondary} />
          <Text style={styles.linkText}>{t('securityAudit.title')}</Text>
          <ChevronRight size={16} color={tokens.text.tertiary} />
        </TouchableOpacity>

        {!twoFactor?.enabled && !setup ? (
          <View style={styles.footerNote}>
            <ShieldOff size={14} color={tokens.text.tertiary} />
            <Text style={styles.footerText}>{t('securityCenter.twoFactor.footerHint')}</Text>
          </View>
        ) : null}
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
    loading: { paddingVertical: rnSpacing.lg },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: rnSpacing.xs,
      marginTop: rnSpacing.xs,
    },
    scoreValue: { fontSize: 32, fontWeight: '700' },
    scoreMax: { fontSize: rnType.body.size, color: tokens.text.tertiary },
    scoreLevel: { marginLeft: rnSpacing.sm, fontSize: rnType.body.size, fontWeight: '600' },
    track: {
      height: 6,
      borderRadius: rnRadius.xs,
      backgroundColor: tokens.surface.muted,
      overflow: 'hidden',
      marginTop: 6,
    },
    trackFill: { height: '100%', borderRadius: rnRadius.xs },
    statusOn: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.success.DEFAULT },
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
    button: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: rnSpacing.xs,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    dangerButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: tokens.danger.DEFAULT,
    },
    dangerButtonText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.danger.DEFAULT,
    },
    // QR 码必须恒定亮底(跟随暗色主题会让多数扫码器识别失败),故取亮色板的书面白,不走当前主题。
    qrWrap: {
      alignItems: 'center',
      paddingVertical: rnSpacing.sm,
      backgroundColor: rnLightTokens.surface.light,
    },
    secret: {
      fontFamily: 'monospace',
      fontSize: 13,
      color: tokens.text.primary,
      paddingVertical: rnSpacing.xs,
    },
    backupBox: {
      marginTop: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.bg,
      gap: 6,
    },
    backupTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
    backupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    backupCode: {
      fontFamily: 'monospace',
      fontSize: 13,
      color: tokens.text.primary,
      width: '45%',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingVertical: 10,
    },
    rowLast: { borderBottomWidth: 0 },
    rowMain: { flex: 1, gap: 2 },
    rowPrimary: { fontSize: rnType.body.size, color: tokens.text.primary },
    rowSecondary: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    revoke: { fontSize: 13, fontWeight: '600', color: tokens.danger.DEFAULT },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.md,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
    },
    linkText: { flex: 1, fontSize: rnType.strong.size, color: tokens.text.primary },
    footerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: rnSpacing.xs,
    },
    footerText: { flex: 1, fontSize: rnType.label.size, color: tokens.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
