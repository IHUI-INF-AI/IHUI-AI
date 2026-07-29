import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { ExamResultScreen as SharedExamResultScreen, type ExamResultItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'ExamResult'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ExamResultScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [result, setResult] = useState<ExamResultItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<ExamResultItem>(`/api/exam/records/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setResult(res.data)
      else setError(res.error || t('examResult.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  return (
    <SharedExamResultScreen
      t={t}
      item={result}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
