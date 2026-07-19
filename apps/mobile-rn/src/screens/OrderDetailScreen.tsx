import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface OrderDetail {
  id: string
  orderNo: string
  amount: number
  status: string
  productName: string
  createdAt: string
  paidAt?: string
}

type Route = RouteProp<RootStackParamList, 'OrderDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PRIMARY = '#10B981'

export function OrderDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<OrderDetail>(`/api/orders/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setOrder(res.data)
      else setError(res.error || t('orderDetail.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, t])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  }
  if (error || !order) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('orderDetail.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
      </View>
    )
  }
  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('orderDetail.title')}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>{t('orderDetail.orderNo')}</Text>
        <Text style={styles.value}>{order.orderNo}</Text>
        <Text style={styles.label}>{t('orderDetail.product')}</Text>
        <Text style={styles.value}>{order.productName}</Text>
        <Text style={styles.label}>{t('orderDetail.amount')}</Text>
        <Text style={styles.price}>¥{order.amount.toFixed(2)}</Text>
        <Text style={styles.label}>{t('orderDetail.status')}</Text>
        <Text style={styles.value}>{order.status}</Text>
        <Text style={styles.label}>{t('orderDetail.createdAt')}</Text>
        <Text style={styles.value}>{order.createdAt}</Text>
        {order.paidAt ? <><Text style={styles.label}>{t('orderDetail.paidAt')}</Text><Text style={styles.value}>{order.paidAt}</Text></> : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827', marginBottom: 12 },
  card: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  label: { marginTop: 8, fontSize: 11, color: '#9ca3af' },
  value: { marginTop: 2, fontSize: 14, color: '#111827' },
  price: { marginTop: 2, fontSize: 18, fontWeight: '600', color: PRIMARY },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
