// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PayResultScreen 支付结果页(mobile-rn 端)
 *
 * 镜像 miniapp-taro pages/pay/result(P0 统一支付结果页补齐):
 * - 路由参数:orderNo(对齐小程序 ?orderNo=)
 * - 数据源:复用共享层 @ihui/api-client getPaymentOrderDetail(GET /payment/orders/:orderNo),
 *   状态映射对齐 miniapp getPayResult:paid→paid / pending→pending / 其余(cancelled/refunded/failed)→failed
 * - 轮询:进入页立即查一次,未出结果每 2s 轮询,最多 30 次(对齐 miniapp),出结果或超时停止
 * - UI:状态圆标(pending=warning / paid=success / failed=danger)+ 金额展示 + 回跳按钮(回首页/查订单)
 * - 样式:getRnTokens 语义 token(零 hex,过 check:rn-parity);图标 lucide-react-native(无 emoji)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { Check, Clock, X } from 'lucide-react-native'
import { getPaymentOrderDetail } from '@ihui/api-client'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'PayResult'>

/** 支付结果三态(对齐 miniapp PayStatus) */
type PayStatus = 'pending' | 'paid' | 'failed'

/** 轮询间隔与上限(对齐 miniapp:setInterval 2s × 30 次) */
const POLL_INTERVAL_MS = 2000
const MAX_POLL_COUNT = 30

export function PayResultScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { orderNo } = useRoute<Route>().params
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [status, setStatus] = useState<PayStatus>('pending')
  const [amount, setAmount] = useState(0)
  const [checking, setChecking] = useState(false)
  // orderNo/最新状态放 ref:轮询闭包内读最新值,避免 setInterval 回调过期
  const orderNoRef = useRef(orderNo)
  const statusRef = useRef<PayStatus>('pending')

  const check = useCallback(async (): Promise<PayStatus> => {
    if (!orderNoRef.current) return statusRef.current
    setChecking(true)
    const res = await getPaymentOrderDetail(orderNoRef.current)
    setChecking(false)
    // 查询失败保持当前状态(对齐 miniapp catch → pending)
    if (!res.success || !res.data) return statusRef.current
    // 状态映射对齐 miniapp getPayResult:仅 paid/pending 有意义,其余视为失败
    const next: PayStatus =
      res.data.status === 'paid' ? 'paid' : res.data.status === 'pending' ? 'pending' : 'failed'
    statusRef.current = next
    setStatus(next)
    setAmount(res.data.amount ?? 0)
    return next
  }, [])

  useEffect(() => {
    orderNoRef.current = orderNo
    statusRef.current = 'pending'
    setStatus('pending')
    // 无 orderNo:保持 pending,由用户手动刷新(对齐 miniapp)
    if (!orderNo) return
    let count = 0
    let intervalId: ReturnType<typeof setInterval> | null = null
    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
    const tick = async () => {
      count += 1
      const result = await check()
      // 出结果或达到轮询上限即停止(对齐 miniapp)
      if (result !== 'pending' || count >= MAX_POLL_COUNT) stop()
    }
    void tick()
    intervalId = setInterval(() => void tick(), POLL_INTERVAL_MS)
    return stop
  }, [orderNo, check])

  /** 回首页(对齐 miniapp switchTab 首页,复用 RN Main Tab 跳转惯例) */
  const goHome = () => navigation.navigate('Main', { screen: 'HomeMain' })
  /** 查订单(对齐 miniapp navigateTo /pages/order/list → RN Order 订单列表) */
  const goOrders = () => navigation.navigate('Order')

  const statusBg: Record<PayStatus, string> = {
    pending: tk.warning.amber,
    paid: tk.success.DEFAULT,
    failed: tk.danger.DEFAULT,
  }
  const statusKey: Record<PayStatus, string> = {
    pending: 'payResult.pending',
    paid: 'payResult.paid',
    failed: 'payResult.failed',
  }

  return (
    <View style={styles.container}>
      <NavBar title={t('payResult.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {/* 状态圆标(对齐 miniapp 160rpx 圆形图标位) */}
        <View style={[styles.statusIcon, { backgroundColor: statusBg[status] }]}>
          {status === 'paid' ? (
            <Check size={rpx(80)} color={tk.surface.light} />
          ) : status === 'failed' ? (
            <X size={rpx(80)} color={tk.surface.light} />
          ) : (
            <Clock size={rpx(80)} color={tk.surface.light} />
          )}
        </View>
        <Text style={styles.statusText}>{t(statusKey[status])}</Text>
        {amount > 0 && <Text style={styles.amountText}>¥{amount.toFixed(2)}</Text>}
        {checking && <ActivityIndicator style={styles.checking} color={tk.text.secondary} />}
      </View>
      <View style={styles.actions}>
        {status !== 'pending' ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed ? styles.btnPressed : null]}
              onPress={goHome}
              accessibilityRole="button"
              accessibilityLabel={t('payResult.backHome')}
            >
              <Text style={styles.primaryText}>{t('payResult.backHome')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed ? styles.btnPressed : null]}
              onPress={goOrders}
              accessibilityRole="button"
              accessibilityLabel={t('payResult.viewOrders')}
            >
              <Text style={styles.secondaryText}>{t('payResult.viewOrders')}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed ? styles.btnPressed : null]}
            onPress={() => void check()}
            accessibilityRole="button"
            accessibilityLabel={t('payResult.refresh')}
          >
            <Text style={styles.primaryText}>{t('payResult.refresh')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const createStyles = (tk: RnThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    body: {
      alignItems: 'center',
      paddingVertical: rpx(120),
    },
    statusIcon: {
      width: rpx(160),
      height: rpx(160),
      borderRadius: rpx(24),
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusText: {
      marginTop: rpx(32),
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
    },
    amountText: {
      marginTop: rpx(16),
      fontSize: 20,
      fontWeight: '600',
      color: tk.danger.DEFAULT,
    },
    checking: {
      marginTop: rpx(20),
    },
    actions: {
      paddingHorizontal: rpx(60),
      gap: rpx(32),
    },
    primaryBtn: {
      height: rpx(88),
      borderRadius: rpx(16),
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtn: {
      height: rpx(88),
      borderRadius: rpx(16),
      backgroundColor: tk.surface.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPressed: {
      opacity: 0.85,
    },
    primaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.surface.light,
    },
    secondaryText: {
      fontSize: 15,
      color: tk.text.primary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
