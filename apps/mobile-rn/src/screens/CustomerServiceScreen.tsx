import { useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  CustomerServiceScreen as SharedCustomerServiceScreen,
  type CustomerServiceInfo,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CustomerServiceScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<CustomerServiceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<CustomerServiceInfo>('/customer-service/info')
        if (!res.success) throw new Error('http')
        if (cancelled) return
        setInfo(res.data ?? null)
      } catch {
        if (!cancelled) setError(t('customerService.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const onCall = () => {
    if (info?.phone) void Linking.openURL(`tel:${info.phone}`)
  }
  const onEmail = () => {
    if (info?.email) void Linking.openURL(`mailto:${info.email}`)
  }

  return (
    <SharedCustomerServiceScreen
      t={t}
      info={info}
      loading={loading}
      error={error}
      onCall={onCall}
      onEmail={onEmail}
      onBack={() => navigation.goBack()}
    />
  )
}
