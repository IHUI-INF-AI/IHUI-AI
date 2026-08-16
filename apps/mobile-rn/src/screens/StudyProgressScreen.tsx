import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  StudyProgressScreen as SharedStudyProgressScreen,
  type StudyProgressData,
} from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function StudyProgressScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [progress, setProgress] = useState<StudyProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<StudyProgressData>('/api/study/progress')
      if (cancelled) return
      if (res.success) setProgress(res.data)
      else setError(res.error || t('studyProgress.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SharedStudyProgressScreen
      t={t}
      progress={progress}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
