import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { OrderDetailScreen as SharedOrderDetailScreen, type OrderDetailItem } from '@ihui/rn-app'
import { BottomActionBar, type BottomActionBarAction } from '../components/BottomActionBar'
import { PurchaseNoticePopUp } from '../components/PurchaseNoticePopUp'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'OrderDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * mobile-rn 订单详情(2026-07-30 接入本地 BottomActionBar)
 *
 * shell 层职责:
 * - 主体调用 @ihui/rn-app.SharedOrderDetailScreen(订单信息 / loading / 错误)
 * - 底部叠加 mobile-rn 本地 BottomActionBar:
 *   - 待支付:取消订单(secondary) + 立即支付(primary)
 *   - 已支付:申请退款(secondary) + 联系卖家(primary)
 *   - 已完成:再次购买(primary,单按钮)
 *   - 已取消:无操作
 */
export function OrderDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [order, setOrder] = useState<OrderDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  // 购买须知弹窗(已支付订单首次进入时自动展示)
  const [noticeVisible, setNoticeVisible] = useState(false)
  // ref 标记提示已展示,避免 setState 触发 effect 重跑导致重复请求
  const noticeHandledRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<OrderDetailItem>(`/api/orders/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) {
        setOrder(res.data)
        // 已支付订单首次加载自动展示购买须知
        if (res.data?.status === 'paid' && !noticeHandledRef.current) {
          noticeHandledRef.current = true
          setNoticeVisible(true)
        }
      } else {
        setError(res.error || t('orderDetail.loadFailed'))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, t])

  const callOrderAction = useCallback(
    async (action: string): Promise<void> => {
      setActionLoading(action)
      try {
        const res = await fetchApi(`/api/orders/${encodeURIComponent(id)}/${action}`, {
          method: 'POST',
        })
        if (res.success) {
          // 触发详情重新加载以反映最新状态
          setOrder((prev) => (prev ? { ...prev, status: action === 'cancel' ? 'cancelled' : prev.status } : prev))
        }
      } finally {
        setActionLoading(null)
      }
    },
    [id],
  )

  const actions = useMemo<ReadonlyArray<BottomActionBarAction>>(() => {
    if (!order) return []
    const status = order.status
    const wrap = (key: string, action: () => void): BottomActionBarAction => ({
      key,
      onPress: action,
      loading: actionLoading === key,
    })
    if (status === 'pending' || status === 'unpaid') {
      return [
        wrap('cancel', () => { void callOrderAction('cancel') }),
        { ...wrap('pay', () => { void callOrderAction('pay') }), label: '立即支付', primary: true },
      ]
    }
    if (status === 'paid' || status === 'shipped') {
      return [
        wrap('refund', () => { void callOrderAction('refund') }),
        { ...wrap('contact', () => { void callOrderAction('contact') }), label: '联系卖家', primary: true },
      ]
    }
    if (status === 'completed') {
      return [
        { ...wrap('rebuy', () => { void callOrderAction('rebuy') }), label: '再次购买', primary: true },
      ]
    }
    if (status === 'cancelled') {
      return [
        { ...wrap('rebuy', () => { void callOrderAction('rebuy') }), label: '再次购买', primary: true },
      ]
    }
    return []
  }, [order, actionLoading, callOrderAction])

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <SharedOrderDetailScreen
          t={t}
          item={order}
          loading={loading}
          error={error}
          onBack={() => navigation.goBack()}
        />
      </View>
      {actions.length > 0 ? <BottomActionBar actions={actions} /> : null}
      <PurchaseNoticePopUp
        visible={noticeVisible}
        title="购买成功"
        subtitle="请仔细阅读购买须知,享受您的权益"
        icon="🎉"
        bullets={['订单已支付成功,请妥善保管凭证', '如需退款请在 7 天内申请', '专属客服 24 小时在线服务']}
        primaryLabel="我知道了"
        onClose={() => setNoticeVisible(false)}
        onPrimary={() => setNoticeVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
})
