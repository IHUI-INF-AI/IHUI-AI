import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { VipBenefitScreen as SharedVipBenefitScreen, type VipBenefitItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function VipBenefitScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<VipBenefitItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetchApi<VipBenefitItem[]>('/vip-benefit')
      if (!r.success) throw new Error()
      setItems(r.data ?? [])
    } catch {
      setError(t('vipBenefit.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedVipBenefitScreen
      t={t}
      items={items}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
