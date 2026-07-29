import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CertDetailScreen as SharedCertDetailScreen, type CertDetailItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'CertDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CertDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [cert, setCert] = useState<CertDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<CertDetailItem>(`/api/certificates/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setCert(res.data)
      else setError(res.error || t('certDetail.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  return (
    <SharedCertDetailScreen
      t={t}
      item={cert}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
      onVerify={(certNo) => navigation.navigate('CertVerify', { certNo })}
    />
  )
}
