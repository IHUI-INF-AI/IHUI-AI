// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PayResultScreen 支付结果页(mobile-rn 端 wrapper)
 *
 * 2026-09-15 迁移:UI 与展示逻辑已下沉共享层 @ihui/rn-app PayResultScreen
 * (对齐 miniapp pages/pay/result),本 wrapper 仅保留平台特定职责:
 * - 数据:复用共享层 @ihui/api-client getPaymentOrderDetail(GET /payment/orders/:orderNo),
 *   状态映射对齐 miniapp getPayResult:paid→paid / pending→pending / 其余(cancelled/refunded/failed)→failed
 * - 轮询:进入页立即查一次,未出结果每 2s 轮询,最多 30 次(对齐 miniapp),出结果或超时停止
 * - 导航:回首页(Main/HomeMain)/ 订单列表(Order)/ goBack;主题色 / i18n 注入
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { getPaymentOrderDetail } from '@ihui/api-client'
import { PayResultScreen as SharedPayResultScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

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

  return (
    <SharedPayResultScreen
      t={t}
      status={status}
      amount={amount}
      checking={checking}
      onRefresh={() => void check()}
      onBackHome={goHome}
      onViewOrders={goOrders}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
