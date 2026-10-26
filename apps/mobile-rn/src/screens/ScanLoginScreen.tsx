// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 expo-camera 相机与条码扫描 API,不进共享层。
import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SafeAreaView } from 'react-native-safe-area-context'
import { parseQrLoginTicket } from '@ihui/shared'
import { confirmQrLogin } from '@ihui/api-client'
import { rnRadiusFor, rnSpacing, rnTokens, rnType } from '@ihui/design-tokens'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * PC 端「App 扫码登录」的移动端一半。
 *
 * PC 展示 ticket 二维码 → 这里扫到后 POST /auth/qr/confirm 把该 ticket 置为
 * confirmed(PC 轮询 /auth/qr/status 取 token)。ticket 判据与小程序共用
 * `@ihui/shared` 的 parseQrLoginTicket,端内不另写正则。
 */
export function ScanLoginScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [permission, requestPermission] = useCameraPermissions()
  const [submitting, setSubmitting] = useState(false)
  // 扫到非本站码时允许用户继续扫:锁只拦重复回调,不拦重试
  const busyRef = useRef(false)

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

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={rnTokens.text.secondary} />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>{t('scanLogin.title')}</Text>
        <Text style={styles.hint}>{t('scanLogin.permissionHint')}</Text>
        <Pressable style={styles.button} onPress={requestPermission} accessibilityRole="button">
          <Text style={styles.buttonText}>{t('scanLogin.grant')}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={submitting ? undefined : handleScanned}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.title}>{t('scanLogin.title')}</Text>
        <Text style={styles.hint}>
          {submitting ? t('scanLogin.submitting') : t('scanLogin.hint')}
        </Text>
        <Pressable style={styles.button} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.buttonText}>{t('common.cancel')}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: rnTokens.text.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: rnSpacing.md,
    paddingHorizontal: rnSpacing.xl,
    backgroundColor: rnTokens.surface.light,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: rnSpacing.md,
    paddingHorizontal: rnSpacing.xl,
    paddingBottom: rnSpacing['2xl'],
    backgroundColor: rnTokens.overlay.modal,
  },
  title: {
    color: rnTokens.brand.foreground,
    fontSize: rnType.title.size,
    fontWeight: '600',
  },
  hint: {
    color: rnTokens.brand.foreground,
    fontSize: rnType.body.size,
    textAlign: 'center',
    opacity: 0.85,
  },
  button: {
    paddingHorizontal: rnSpacing.xl,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadiusFor.control,
    borderWidth: 1,
    borderColor: rnTokens.brand.foreground,
  },
  buttonText: {
    color: rnTokens.brand.foreground,
    fontSize: rnType.body.size,
    fontWeight: '500',
  },
  cancelText: {
    color: rnTokens.text.secondary,
    fontSize: rnType.body.size,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
