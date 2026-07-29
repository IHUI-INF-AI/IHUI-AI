import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  ReferrerScreen as SharedReferrerScreen,
  type ReferrerInfo,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ReferrerScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<ReferrerInfo | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetchApi<ReferrerInfo>('/user/referrer')
        if (cancelled) return
        if (!resp.success) throw new Error('http')
        setInfo(resp.data ?? { referrerName: null, referrerCode: null })
      } catch {
        if (!cancelled) setError(t('referrer.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const handleBind = async () => {
    if (!code) {
      setError(t('referrer.codeRequired'))
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const resp = await fetchApi<unknown>('/user/referrer', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      if (!resp.success) throw new Error('http')
      setInfo({ referrerName: code, referrerCode: code })
      setSuccess(t('referrer.bindSuccess'))
      setCode('')
    } catch {
      setError(t('referrer.bindFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SharedReferrerScreen
      t={t}
      info={info}
      code={code}
      loading={loading}
      submitting={submitting}
      error={error}
      success={success}
      onCodeChange={setCode}
      onSubmit={handleBind}
      onBack={() => navigation.goBack()}
    />
  )
}
