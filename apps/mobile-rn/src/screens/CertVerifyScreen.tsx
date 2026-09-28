// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { CertVerifyScreen as SharedCertVerifyScreen, type CertVerifyResult } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'CertVerify'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CertVerifyScreen() {
  const { resolvedTheme } = useTheme()
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
    else setError(apiFailureToText(res, t('certVerify.failed')))
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
      colorScheme={resolvedTheme}
    />
  )
}
