import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { VipCompareScreen as SharedVipCompareScreen, type VipCompareRow } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function VipCompareScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [rows, setRows] = useState<VipCompareRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetchApi<VipCompareRow[]>('/vip-compare')
      if (!r.success) throw new Error()
      setRows(r.data ?? [])
    } catch { setError(t('vipCompare.loadFailed')) } finally { setLoading(false) }
  }, [t])

  useEffect(() => { void load() }, [load])

  return (
    <SharedVipCompareScreen
      t={t}
      rows={rows}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
