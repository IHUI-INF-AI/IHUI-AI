import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { BankCardScreen as SharedBankCardScreen, type BankCardItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function BankCardScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<BankCardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<BankCardItem[]>('/wallet/bank-cards')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('bankCard.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  return (
    <SharedBankCardScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={onRefresh}
      onBack={() => navigation.goBack()}
    />
  )
}
