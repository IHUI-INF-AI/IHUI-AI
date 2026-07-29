import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { FinanceScreen as SharedFinanceScreen, type FinanceSummary } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function FinanceScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetchApi<FinanceSummary>('/wallet/balance')
        if (!res.success) throw new Error('http')
        if (cancelled) return
        setSummary(res.data ?? null)
      } catch {
        if (!cancelled) setError(t('finance.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <SharedFinanceScreen
      t={t}
      summary={summary}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
