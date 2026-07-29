import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { VipLevelScreen as SharedVipLevelScreen, type VipLevelItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'VipLevel'>

export function VipLevelScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const id = route.params.id
  const [item, setItem] = useState<VipLevelItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetchApi<VipLevelItem>(`/vip-level/${id}`)
      if (!r.success) throw new Error()
      setItem(r.data ?? null)
    } catch { setError(t('vipLevel.loadFailed')) } finally { setLoading(false) }
  }, [id, t])

  useEffect(() => { void load() }, [load])

  return (
    <SharedVipLevelScreen
      t={t}
      item={item}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
