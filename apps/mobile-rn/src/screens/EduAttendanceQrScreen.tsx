// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 expo-camera 相机与 react-native-qrcode-svg,不进共享层。
/**
 * 扫码签到两屏(2026-11-03 首行落地,补齐「后端有端点、端上无入口」那一格)。
 *
 * 端点(只读参考 apps/api/src/routes/edu-ai-management.ts,本文件不改后端):
 *  - GET  /api/edu-ai-management/attendance/qrcode?classId=<uuid>   教师(edu:manage)
 *      ⇒ { payload, classId, expiresAt, ttlMs }  —— payload 是含 HMAC token 的 JSON 字符串
 *      未配启用中的考勤规则或未设 qrSecret ⇒ 400 点名,本屏把该 message 原样上屏并给下一步。
 *  - POST /api/edu-ai-management/attendance/qrcode-check-in  { token }
 *      ⇒ 201 { classId, status, checkInTime, record, judgedBy }
 *      入参只有 token:班级与签名都在 token 里,客户端不传 classId/studentId(§5 归属由承载层取)。
 *
 * 屏一 `EduAttendanceQrScreen`(教师出码):取班级清单 → 选班 → 渲染 payload 二维码
 *   → 按后端 ttlMs 显示「Ns 后过期」读数,归零自动重取(不本地续期)。
 * 屏二 `EduAttendanceScanScreen`(学生扫码):复用 ScanLoginScreen 的相机形态与权限流程
 *   (useCameraPermissions + 进入即申请 + 被拒给「去设置」),扫到后 POST check-in,
 *   成功以服务端回读为准 —— 列表刷新交给调用侧(EduMyAttendanceScreen 的 focus 腿)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { ChevronLeft, QrCode, RefreshCw, ScanLine } from 'lucide-react-native'
import QRCodeSvg from 'react-native-qrcode-svg'
import { fetchApi } from '@ihui/api-client'
import { getTokens } from '@ihui/rn-app'
import { Tappable } from '@ihui/ui-native'
import { rnRadius, rnRadiusFor, rnSpacing, rnType, rnCssLight } from '@ihui/design-tokens'
import { appAlert } from '../components/BottomPops'
import { useAuthStore, selectIsAuthenticated } from '../stores/auth-store'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/** 班级行(只取本屏用得上的三列;后端 /class 返回整行,多字段无害)。 */
interface ClassRow {
  id: string
  name: string
  grade?: string | null
}

/** 出码响应(字段与 handler 的 success({...}) 逐字对齐,现读于 2026-11-03)。 */
interface QrPayloadResult {
  payload: string
  classId: string
  expiresAt: string
  ttlMs: number
}

/** 扫码签到响应(与 self-check-in 同形 + record/judgedBy;本屏只用回显三键)。 */
interface QrCheckInResult {
  classId?: string
  status?: string
  checkInTime?: string | null
}

/**
 * 签到二维码 payload 的登录态判据与 QR 载荷解析:结构由后端 JSON.stringify 定,
 * 这里只做「是不是本系统签到码」的形态闸,不在此复算签名/有效期(§0.6 判据单源在 server)。
 */
const parseAttendancePayload = (raw: string): string | null => {
  try {
    const obj = JSON.parse(raw) as { type?: unknown; token?: unknown }
    if (obj?.type !== 'edu-attendance-checkin') return null
    return typeof obj.token === 'string' && obj.token.length > 0 ? obj.token : null
  } catch {
    return null
  }
}

/** 二维码边长:与 DistributionScreen 的分享码同档(176),不另立尺寸。 */
const QR_SIZE = 176

/** 被拒后跳系统设置(与 ScanLoginScreen 同一出口,端内不另写一套)。 */
const openAppSettings = async (): Promise<void> => {
  await Linking.openSettings()
}

// =============================================================================
// 屏一:教师出码
// =============================================================================

export function EduAttendanceQrScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const tk = getTokens(resolvedTheme)
  const styles = useMemo(() => createQrStyles(tk), [tk])
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [classId, setClassId] = useState<string | null>(null)
  const [qr, setQr] = useState<QrPayloadResult | null>(null)
  /** 后端 400 的 message 原文 + 下一步提示;不为消红而吞掉它(§0.3)。 */
  const [qrError, setQrError] = useState<string | null>(null)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [remaining, setRemaining] = useState(0)

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true)
    try {
      const res = await fetchApi<{ list: ClassRow[] }>('/api/edu-ai-management/class')
      if (res.success) {
        setClasses(res.data?.list ?? [])
        return
      }
      // 权限/参数失败:清单取不到就如实点名,不静默显示空列表冒充「没有班级」
      appAlert(
        t('eduAttendanceQr.title'),
        `${t('eduAttendanceQr.classLoadFailed')}:${res.error ?? '-'}`,
      )
    } catch (e) {
      appAlert(
        t('eduAttendanceQr.title'),
        `${t('eduAttendanceQr.classLoadFailed')}:${e instanceof Error ? e.message : '-'}`,
      )
    } finally {
      setLoadingClasses(false)
    }
  }, [t])

  useEffect(() => {
    void loadClasses()
  }, [loadClasses])

  const fetchQr = useCallback(async (id: string) => {
    setGenerating(true)
    setQrError(null)
    try {
      const res = await fetchApi<QrPayloadResult>(
        `/api/edu-ai-management/attendance/qrcode?classId=${encodeURIComponent(id)}`,
      )
      if (res.success && res.data?.payload) {
        setQr(res.data)
        return
      }
      setQr(null)
      // 400「该班未配置启用中的考勤规则或未设置扫码密钥(qrSecret)」原样上屏
      setQrError(res.error || 'load failed')
    } catch (e) {
      setQr(null)
      setQrError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setGenerating(false)
    }
  }, [])

  // 选班即出码;换班重置读数,避免把上一班的码当成新一班的在倒计时
  useEffect(() => {
    if (!classId) {
      setQr(null)
      setRemaining(0)
      return
    }
    void fetchQr(classId)
  }, [classId, fetchQr])

  const expiryMs = useMemo(() => (qr ? Date.parse(qr.expiresAt) : 0), [qr])

  // 1s 节拍读「还剩几秒」;归零后由 effect 触发重取(服务端 60s TTL,本屏不自造续期)
  useEffect(() => {
    if (!expiryMs) {
      setRemaining(0)
      return
    }
    const tick = () => setRemaining(Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiryMs])

  const expired = !!expiryMs && remaining <= 0
  useEffect(() => {
    if (expired && classId && !generating) void fetchQr(classId)
  }, [expired, classId, generating, fetchQr])

  const selectedName = useMemo(() => {
    const hit = classes.find((c) => c.id === classId)
    if (!hit) return ''
    return hit.grade ? `${hit.name}(${hit.grade})` : hit.name
  }, [classes, classId])

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Tappable
          onPress={() => navigation.goBack()}
          pressedStyle={styles.pressed}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.backText}
        >
          <ChevronLeft size={20} color={tk.text.primary} />
        </Tappable>
        <Text style={styles.title}>
          <QrCode size={16} color={tk.text.primary} />
          {`  ${t('eduAttendanceQr.title')}`}
        </Text>
      </View>

      {loadingClasses ? (
        <View style={styles.center}>
          <ActivityIndicator color={tk.text.secondary} />
        </View>
      ) : classes.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t('eduAttendanceQr.noClass')}</Text>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('eduAttendanceQr.chooseClass')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classRow}>
            {classes.map((c) => {
              const on = c.id === classId
              return (
                <Tappable
                  key={c.id}
                  onPress={() => setClassId(c.id)}
                  pressedStyle={styles.pressed}
                  accessibilityRole="button"
                  style={[styles.classChip, on ? styles.classChipOn : null]}
                >
                  <Text
                    style={[styles.classChipText, on ? styles.classChipOnText : null]}
                    numberOfLines={1}
                  >
                    {c.grade ? `${c.name}·${c.grade}` : c.name}
                  </Text>
                </Tappable>
              )
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.qrArea}>
        {generating ? (
          <ActivityIndicator color={tk.brand.cta} />
        ) : qr ? (
          <>
            <View style={styles.qrBox}>
              <QRCodeSvg
                value={qr.payload}
                size={QR_SIZE}
                color={tk.gray.black}
                backgroundColor="#FFFFFF"
                ecl="M"
              />
            </View>
            <Text style={styles.readout}>{t('eduAttendanceQr.expiresIn', { s: remaining })}</Text>
            {selectedName ? <Text style={styles.subtitle}>{selectedName}</Text> : null}
            <Text style={styles.hint}>{t('eduAttendanceQr.qrTip')}</Text>
            <Tappable
              onPress={() => classId && void fetchQr(classId)}
              pressedStyle={styles.pressed}
              accessibilityRole="button"
              style={styles.refreshBtn}
            >
              <RefreshCw size={14} color={tk.brand.ctaForeground} />
              <Text style={styles.refreshBtnText}>{t('eduAttendanceQr.refresh')}</Text>
            </Tappable>
          </>
        ) : (
          <View style={styles.errorBox}>
            <ScanLine size={28} color={tk.text.secondary} />
            <Text style={styles.errorText}>{qrError ?? t('eduAttendanceQr.pickClassFirst')}</Text>
            {qrError ? (
              <Text style={styles.errorNext}>{t('eduAttendanceQr.nextStepHint')}</Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  )
}

// =============================================================================
// 屏二:学生扫码签到
// =============================================================================

export function EduAttendanceScanScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const tk = getTokens(resolvedTheme)
  const styles = useMemo(() => createQrStyles(tk), [tk])
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  // 权限流程整块照搬 ScanLoginScreen:进入即申请(undetermined)、被拒不重复弹、给「去设置」
  const [permission, requestPermission] = useCameraPermissions()
  const [submitting, setSubmitting] = useState(false)
  const busyRef = useRef(false)
  const autoRequestedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !permission) return
    if (permission.status === 'undetermined' && permission.canAskAgain !== false) {
      if (autoRequestedRef.current) return
      autoRequestedRef.current = true
      void requestPermission()
    }
  }, [permission, requestPermission, isAuthenticated])

  const onScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (busyRef.current) return
      const token = parseAttendancePayload(data)
      if (!token) {
        busyRef.current = true
        appAlert(t('eduAttendanceQr.scanTitle'), t('eduAttendanceQr.scanInvalidCode'), [
          {
            text: t('common.confirm'),
            onPress: () => {
              busyRef.current = false
            },
          },
        ])
        return
      }
      busyRef.current = true
      setSubmitting(true)
      try {
        const res = await fetchApi<QrCheckInResult>(
          '/api/edu-ai-management/attendance/qrcode-check-in',
          { method: 'POST', body: JSON.stringify({ token }) },
        )
        if (res.success) {
          // 以后端回显展示,列表刷新交给 EduMyAttendanceScreen 的 focus 腿(不本地改行)
          appAlert(t('eduAttendanceQr.scanTitle'), t('eduAttendanceQr.scanDone'))
          navigation.goBack()
          return
        }
        // 401/403/400/409 一律把后端 message 上屏(过期/换班/未在册/重复签全靠它区分)
        appAlert(
          t('eduAttendanceQr.scanTitle'),
          `${t('eduAttendanceQr.scanFailed')}:${res.error ?? '-'}`,
        )
        busyRef.current = false
      } catch (e) {
        appAlert(
          t('eduAttendanceQr.scanTitle'),
          `${t('eduAttendanceQr.scanFailed')}:${e instanceof Error ? e.message : '-'}`,
        )
        busyRef.current = false
      } finally {
        setSubmitting(false)
      }
    },
    [navigation, t],
  )

  if (!isAuthenticated) {
    return (
      <View style={styles.plainSafe}>
        <Text style={styles.plainTitle}>{t('eduAttendanceQr.scanTitle')}</Text>
        <Text style={styles.plainHint}>{t('eduAttendanceQr.needLogin')}</Text>
        <Tappable
          onPress={() => navigation.navigate('Login')}
          pressedStyle={styles.pressed}
          accessibilityRole="button"
          style={styles.ctaBtn}
        >
          <Text style={styles.ctaBtnText}>{t('common.login')}</Text>
        </Tappable>
      </View>
    )
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.text.secondary} />
      </View>
    )
  }

  if (!permission.granted) {
    const denied = permission.status === 'denied'
    return (
      <View style={styles.plainSafe}>
        <Text style={styles.plainTitle}>{t('eduAttendanceQr.scanTitle')}</Text>
        <Text style={styles.plainHint}>
          {denied ? t('scanLogin.deniedHint') : t('scanLogin.permissionHint')}
        </Text>
        <Tappable
          onPress={() => (denied ? void openAppSettings() : void requestPermission())}
          pressedStyle={styles.pressed}
          accessibilityRole="button"
          style={styles.ctaBtn}
        >
          <Text style={styles.ctaBtnText}>
            {denied ? t('scanLogin.openSettings') : t('scanLogin.grant')}
          </Text>
        </Tappable>
      </View>
    )
  }

  return (
    <View style={styles.camRoot}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={submitting ? undefined : onScanned}
      />
      <View style={styles.camOverlay} pointerEvents="box-none">
        <Text style={styles.camTitle}>{t('eduAttendanceQr.scanTitle')}</Text>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.camHint}>
          {submitting ? t('eduAttendanceQr.scanSubmitting') : t('eduAttendanceQr.scanHint')}
        </Text>
        <Tappable
          onPress={() => navigation.goBack()}
          pressedStyle={styles.pressed}
          accessibilityRole="button"
          style={styles.camCancel}
        >
          <Text style={styles.camCancelText}>{t('common.cancel')}</Text>
        </Tappable>
      </View>
    </View>
  )
}

function createQrStyles(tk: ReturnType<typeof getTokens>) {
  return StyleSheet.create({
    shell: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
    },
    backText: { padding: rnSpacing.xs },
    backTextInner: { color: tk.text.primary, fontSize: rnType.body.size },
    title: { color: tk.text.primary, fontSize: rnType.subtitle.size, fontWeight: '600' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    section: { paddingHorizontal: rnSpacing.lg, gap: rnSpacing.sm },
    sectionTitle: { color: tk.text.secondary, fontSize: rnType.caption.size },
    classRow: { flexDirection: 'row' },
    classChip: {
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      marginRight: rnSpacing.sm,
      backgroundColor: tk.surface.card,
    },
    classChipOn: { backgroundColor: tk.brand.cta, borderColor: tk.brandAccent.deep },
    classChipText: { color: tk.text.primary, fontSize: rnType.caption.size, maxWidth: 180 },
    classChipOnText: { color: tk.brand.ctaForeground, fontWeight: '600' },
    qrArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.md,
      padding: rnSpacing.lg,
    },
    qrBox: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.xl,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    readout: {
      color: tk.text.primary,
      fontSize: rnType.body.size,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    subtitle: { color: tk.text.secondary, fontSize: rnType.caption.size },
    hint: { color: tk.text.secondary, fontSize: rnType.caption.size, textAlign: 'center' },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadiusFor.control,
      backgroundColor: tk.brand.cta,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
    },
    refreshBtnText: {
      color: tk.brand.ctaForeground,
      fontSize: rnType.body.size,
      fontWeight: '600',
    },
    emptyBox: { padding: rnSpacing.xl, alignItems: 'center' },
    emptyText: { color: tk.text.secondary, fontSize: rnType.body.size },
    errorBox: { alignItems: 'center', gap: rnSpacing.sm, paddingHorizontal: rnSpacing.xl },
    errorText: { color: tk.error.text, fontSize: rnType.body.size, textAlign: 'center' },
    errorNext: {
      color: tk.text.secondary,
      fontSize: rnType.caption.size,
      textAlign: 'center',
      lineHeight: rnType.caption.lineHeight,
    },
    pressed: { opacity: 0.85 },
    plainSafe: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.md,
      paddingHorizontal: rnSpacing.xl,
      backgroundColor: tk.surface.card,
    },
    plainTitle: { color: tk.text.primary, fontSize: rnType.title.size, fontWeight: '600' },
    plainHint: { color: tk.text.secondary, fontSize: rnType.body.size, textAlign: 'center' },
    ctaBtn: {
      borderRadius: rnRadiusFor.control,
      backgroundColor: tk.brand.cta,
      paddingHorizontal: rnSpacing.xl,
      paddingVertical: rnSpacing.sm,
    },
    ctaBtnText: { color: tk.brand.ctaForeground, fontSize: rnType.body.size, fontWeight: '600' },
    camRoot: { flex: 1, backgroundColor: tk.gray.black },
    camOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.xl,
      paddingTop: rnSpacing.lg,
      paddingBottom: rnSpacing['2xl'],
      backgroundColor: rnCssLight.black35,
    },
    camTitle: {
      color: CAMERA_TEXT,
      fontSize: rnType.title.size,
      fontWeight: '600',
      ...CAMERA_SHADOW,
    },
    camHint: {
      color: CAMERA_TEXT,
      fontSize: rnType.body.size,
      textAlign: 'center',
      ...CAMERA_SHADOW,
    },
    scanFrame: { width: 220, height: 220, position: 'relative' },
    corner: {
      position: 'absolute',
      width: 26,
      height: 26,
      borderColor: CAMERA_TEXT,
      borderWidth: 3,
    },
    cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
    camCancel: {
      borderRadius: rnRadiusFor.control,
      borderWidth: 1,
      borderColor: rnCssLight.white70,
      backgroundColor: rnCssLight.black40,
      paddingHorizontal: rnSpacing.xl,
      paddingVertical: rnSpacing.sm,
    },
    camCancelText: { color: CAMERA_TEXT, fontSize: rnType.body.size, fontWeight: '500' },
  })
}

/** 相机层文字恒白(画面是暗底,不能依赖主题色);与 ScanLoginScreen 同一处理。 */
const CAMERA_TEXT = '#FFFFFF'
const CAMERA_SHADOW = {
  textShadowColor: rnCssLight.black75,
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
}

export default EduAttendanceQrScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
