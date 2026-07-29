import { useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CertVerifyScreen as SharedCertVerifyScreen, type CertVerifyResult } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'CertVerify'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CertVerifyScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const initialNo = route.params?.certNo ?? ''
  const [result, setResult] = useState<CertVerifyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onVerify = async (certNo: string) => {
    if (!certNo) return
    setLoading(true)
    setError('')
    setResult(null)
    const res = await fetchApi<CertVerifyResult>(
      `/api/certificates/verify?certNo=${encodeURIComponent(certNo)}`,
    )
    setLoading(false)
    if (res.success) setResult(res.data)
    else setError(res.error || t('certVerify.failed'))
  }

  return (
    <SharedCertVerifyScreen
      t={t}
      initialCertNo={initialNo}
      result={result}
      loading={loading}
      error={error}
      onVerify={onVerify}
      onBack={() => navigation.goBack()}
    />
  )
}
