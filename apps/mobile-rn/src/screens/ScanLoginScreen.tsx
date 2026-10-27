// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 expo-camera 相机与条码扫描 API,不进共享层。
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SafeAreaView } from 'react-native-safe-area-context'
import { parseQrLoginTicket } from '@ihui/shared'
import { confirmQrLogin } from '@ihui/api-client'
import { rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { tokens } from '../theme/active-tokens'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * PC 端「App 扫码登录」的移动端一半。
 *
 * PC 展示 ticket 二维码 → 这里扫到后 POST /auth/qr/confirm 把该 ticket 置为
 * confirmed(PC 轮询 /auth/qr/status 取 token)。ticket 判据与小程序共用
 * `@ihui/shared` 的 parseQrLoginTicket,端内不另写正则。
 *
 * 2026-10-27 修根因:此前未授权分支把标题/提示/「允许」按钮一律用 `brand.foreground`
 * (白) 画在 `surface.light` (白) 背景上 → 白底白字全不可见,只剩用 `text.secondary`
 * 灰色的「取消」可见,于是用户看到的就是"空白页只有取消两个字";且该屏不会主动申请
 * 权限,用户连「允许」按钮都看不见。现改为:
 *  - 进入即自动申请相机权限(undetermined 态),无需在不可见按钮上点;
 *  - 未授权/被拒分支改用主题感知的 surface 文字色(text.primary/secondary)+ 正确 CTA 配对,
 *    保证任意主题下都清晰可读;被拒态给出"去设置"入口(Linking.openSettings);
 *  - 授权后的相机层文字恒为白色 + 阴影(相机画面是暗的,不能依赖主题色),并加居中扫码框,
 *    让"正在扫码"的语义一眼可辨,而不是一片黑。
 */
export function ScanLoginScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [permission, requestPermission] = useCameraPermissions()
  const [submitting, setSubmitting] = useState(false)
  // 扫到非本站码时允许用户继续扫:锁只拦重复回调,不拦重试
  const busyRef = useRef(false)
  // 自动申请只发一次(避免 effect 重跑反复弹系统授权框)
  const autoRequestedRef = useRef(false)

  // 进入即申请相机权限(undetermined 且仍可询问时)
  useEffect(() => {
    if (!permission) return
    if (permission.status === 'undetermined' && permission.canAskAgain !== false) {
      if (autoRequestedRef.current) return
      autoRequestedRef.current = true
      void requestPermission()
    }
  }, [permission, requestPermission])

  const handleScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (busyRef.current) return
      const ticket = parseQrLoginTicket(data)
      if (!ticket) {
        busyRef.current = true
        appAlert(t('scanLogin.invalidCode'), undefined, [
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
        const res = await confirmQrLogin(ticket)
        if (!res.success) throw new Error(res.error)
        appAlert(t('scanLogin.success'))
        navigation.goBack()
      } catch {
        busyRef.current = false
        appAlert(t('scanLogin.failed'))
      } finally {
        setSubmitting(false)
      }
    },
    [navigation, t],
  )

  const openSettings = useCallback(() => {
    void Linking.openSettings()
  }, [])

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.text.secondary} />
      </View>
    )
  }

  // 未授权(undetermined / denied):主题感知的可视界面,不再白底白字
  if (!permission.granted) {
    const denied = permission.status === 'denied'
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.safeTitle}>{t('scanLogin.title')}</Text>
        <Text style={styles.safeHint}>
          {denied ? t('scanLogin.deniedHint') : t('scanLogin.permissionHint')}
        </Text>
        {denied ? (
          <Pressable
            style={[styles.ctaButton, { backgroundColor: tokens.brand.cta }]}
            onPress={openSettings}
            accessibilityRole="button"
          >
            <Text style={[styles.ctaButtonText, { color: tokens.brand.ctaForeground }]}>
              {t('scanLogin.openSettings')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.ctaButton, { backgroundColor: tokens.brand.cta }]}
            onPress={() => void requestPermission()}
            accessibilityRole="button"
          >
            <Text style={[styles.ctaButtonText, { color: tokens.brand.ctaForeground }]}>
              {t('scanLogin.grant')}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  // 已授权:相机全屏 + 居中扫码框 + 恒白文字(相机画面是暗的,不能依赖主题色)
  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={submitting ? undefined : handleScanned}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        {/* 顶部标题条 */}
        <View style={styles.topBar}>
          <Text style={styles.titleWhite}>{t('scanLogin.title')}</Text>
        </View>

        {/* 居中扫码框(四角括号,提示"把二维码放进来") */}
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* 底部提示 + 取消 */}
        <View style={styles.bottomBar}>
          <Text style={styles.hintWhite}>
            {submitting ? t('scanLogin.submitting') : t('scanLogin.hint')}
          </Text>
          <Pressable
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

// 相机层文字恒白(相机画面是暗底),用文本阴影保证任何光照下可读;
// 不取 themes tokens,否则暗主题下颜色会翻成黑,叠在暗相机上又变成"看不见"。
const CAMERA_TEXT = '#FFFFFF'

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ── 未授权/被拒:主题感知的可视界面 ──
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: rnSpacing.md,
    paddingHorizontal: rnSpacing.xl,
    backgroundColor: tokens.surface.card,
  },
  safeTitle: {
    color: tokens.text.primary,
    fontSize: rnType.title.size,
    fontWeight: '600',
    textAlign: 'center',
  },
  safeHint: {
    color: tokens.text.secondary,
    fontSize: rnType.body.size,
    textAlign: 'center',
    opacity: 0.9,
  },
  ctaButton: {
    marginTop: rnSpacing.sm,
    paddingHorizontal: rnSpacing.xl,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadiusFor.control,
  },
  ctaButtonText: {
    fontSize: rnType.body.size,
    fontWeight: '600',
  },
  cancelText: {
    color: tokens.text.secondary,
    fontSize: rnType.body.size,
    marginTop: rnSpacing.xs,
  },
  // ── 已授权:相机层(恒白文字 + 阴影) ──
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rnSpacing.xl,
    paddingTop: rnSpacing.lg,
    paddingBottom: rnSpacing['2xl'],
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topBar: {
    width: '100%',
    alignItems: 'center',
  },
  titleWhite: {
    color: CAMERA_TEXT,
    fontSize: rnType.title.size,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  scanFrame: {
    width: 220,
    height: 220,
    position: 'relative',
  },
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
  bottomBar: {
    width: '100%',
    alignItems: 'center',
    gap: rnSpacing.md,
  },
  hintWhite: {
    color: CAMERA_TEXT,
    fontSize: rnType.body.size,
    textAlign: 'center',
    opacity: 0.92,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cancelButton: {
    paddingHorizontal: rnSpacing.xl,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadiusFor.control,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cancelButtonText: {
    color: CAMERA_TEXT,
    fontSize: rnType.body.size,
    fontWeight: '500',
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
