// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 学生本人考勤页(mobile-rn 端)。
 * 端点:
 *  - GET /api/edu-ai-management/attendance/me?date=YYYY-MM-DD ⇒ { list }
 *    (只认登录态,归属主体由后端按 request.userId 收敛;本屏不再收全班行再本地过滤)
 *  - POST /api/edu-ai-management/attendance/self-check-in { date?, remark? }
 *    (新契约:身份由后端按登录态取,班级由后端按在册学籍现取;客户端不传 studentId/classId,
 *     学籍取不到时后端回 409 带可读 reason,本屏如实上屏)
 * 签到成功后重新拉列表,以服务端回读为准,不做本地乐观更新。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ScanLine } from 'lucide-react-native'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import {
  ConsoleTableScreen,
  getTokens,
  type ConsoleBadgeTone,
  type ConsoleColumn,
  type ConsoleRowView,
} from '@ihui/rn-app'
import { Tappable } from '@ihui/ui-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { appAlert } from '../components/BottomPops'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface MyAttendanceRecord {
  id: string
  studentId: string
  classId?: string | null
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  status: string
  remark: string | null
}

// 与教师端同口径:业务日按 Asia/Shanghai 切(UTC+8 直接加偏移取 UTC 日,中国无夏令时)。
const todayIso = (): string => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)

const statusTone = (s: string): ConsoleBadgeTone =>
  s === 'present' ? 'ok' : s === 'late' ? 'warn' : s === 'absent' ? 'danger' : 'muted'

function EduMyAttendanceScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const tk = getTokens(resolvedTheme)
  const styles = useMemo(() => createScreenStyles(tk), [tk])
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const { user } = useAuth()
  const studentId = user?.id ?? ''
  const [records, setRecords] = useState<MyAttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const statusLabel = useCallback(
    (s: string) => {
      // 状态词表与教师端同源(eduAttendance.status.*),不另立一份
      const v = t(`eduAttendance.status.${s}`)
      return v === `eduAttendance.status.${s}` ? s : v
    },
    [t],
  )

  const load = useCallback(async () => {
    if (!studentId) {
      setRecords([])
      setError(t('eduMyAttendance.notLoggedIn'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<{ list: MyAttendanceRecord[] }>(
        `/api/edu-ai-management/attendance/me?date=${todayIso()}`,
      )
      if (!res.success) throw new Error(res.error || 'load failed')
      setRecords(res.data?.list ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [studentId, t])

  useEffect(() => {
    void load()
  }, [load])

  // 扫码那一屏(EduAttendanceScanScreen)签成功后 goBack ⇒ 本屏靠 focus 事件重新 GET,
  // 列表以服务端回读为准;扫码屏不写本地行、本屏也不乐观改状态。
  useEffect(() => navigation.addListener('focus', () => void load()), [navigation, load])

  const rows = useMemo<ConsoleRowView[]>(
    () =>
      records.map((r) => ({
        id: r.id,
        cells: {
          date: r.date,
          status: statusLabel(r.status),
          checkIn: r.checkInTime?.slice(11, 16) ?? '—',
          checkOut: r.checkOutTime?.slice(11, 16) ?? '—',
          remark: r.remark ?? '',
        },
        badgeTone: statusTone(r.status),
      })),
    [records, statusLabel],
  )

  // 新契约:自签不依赖 classId(班级由后端按在册学籍现取),此处仅保留读路径的本人行过滤。

  const selfCheckIn = useCallback(async () => {
    if (busy) return
    if (!studentId) {
      appAlert(t('eduMyAttendance.title'), t('eduMyAttendance.notLoggedIn'))
      return
    }
    setBusy(true)
    try {
      const res = await fetchApi<{ classId?: string; status?: string }>(
        '/api/edu-ai-management/attendance/self-check-in',
        { method: 'POST', body: JSON.stringify({ date: todayIso() }) },
      )
      if (res.success) {
        // 成功:以后端回显的生效信息展示(状态词表与教师端同源),再重新 GET 刷新,不做本地乐观改状态
        const echoed = res.data?.status ? ` (${statusLabel(res.data.status)})` : ''
        appAlert(t('eduMyAttendance.title'), `${t('eduAttendance.actionDone')}${echoed}`)
        await load()
      } else {
        // 401/403/409 均落此分支:res.error 即后端 message(含 409 的可读 reason),必须上屏、不许静默
        appAlert(
          t('eduMyAttendance.title'),
          `${t('eduAttendance.actionFailed')}:${res.error ?? '-'}`,
        )
      }
    } catch (e) {
      appAlert(
        t('eduMyAttendance.title'),
        `${t('eduAttendance.actionFailed')}:${e instanceof Error ? e.message : '-'}`,
      )
    } finally {
      setBusy(false)
    }
  }, [busy, load, statusLabel, studentId, t])

  const columns: ConsoleColumn[] = [
    { key: 'date', title: t('eduMyAttendance.date'), render: 'mono' },
    { key: 'status', title: t('eduAttendance.statusTitle'), render: 'badge' },
    { key: 'checkIn', title: t('eduAttendance.checkIn') },
    { key: 'checkOut', title: t('eduAttendance.checkOut') },
    { key: 'remark', title: t('eduAttendance.remark'), flex: 2 },
  ]

  return (
    <View style={styles.shell}>
      <Tappable
        onPress={() => void selfCheckIn()}
        pressedStyle={styles.pressed}
        accessibilityRole="button"
        style={styles.ctaBtn}
      >
        <Text style={styles.ctaBtnText}>{t('eduMyAttendance.selfCheckIn')}</Text>
      </Tappable>
      <Text style={styles.ctaHint}>{t('eduMyAttendance.classByBackendHint')}</Text>
      {/* 扫码签到:出码方是教师屏(RN/Web),本屏只负责扫载荷 → POST qrcode-check-in {token} */}
      <Tappable
        onPress={() => navigation.navigate('EduAttendanceScan')}
        pressedStyle={styles.pressed}
        accessibilityRole="button"
        style={styles.scanBtn}
      >
        <ScanLine size={15} color={tk.text.primary} />
        <Text style={styles.scanBtnText}>{t('eduMyAttendance.scanCheckIn')}</Text>
      </Tappable>
      <ConsoleTableScreen
        t={t}
        colorScheme={resolvedTheme}
        onBack={() => navigation.goBack()}
        title={t('eduMyAttendance.title')}
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        onRefresh={() => void load()}
      />
    </View>
  )
}

function createScreenStyles(tk: ReturnType<typeof getTokens>) {
  return StyleSheet.create({
    shell: { flex: 1, backgroundColor: tk.surface.bg },
    ctaBtn: {
      marginHorizontal: rnSpacing.lg,
      marginTop: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      alignItems: 'center',
    },
    ctaBtnText: {
      color: tk.brand.ctaForeground,
      fontSize: rnType.body.size,
      fontWeight: '600',
    },
    ctaHint: {
      marginHorizontal: rnSpacing.lg,
      marginTop: rnSpacing.xs,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    // 次级入口:中性描边 + 面板底(主 CTA 仍是「我要签到」,一屏只留一枚实底主按钮)
    scanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      marginHorizontal: rnSpacing.lg,
      marginTop: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
    },
    scanBtnText: {
      color: tk.text.primary,
      fontSize: rnType.body.size,
    },
    pressed: { opacity: 0.85 },
  })
}

export default EduMyAttendanceScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
