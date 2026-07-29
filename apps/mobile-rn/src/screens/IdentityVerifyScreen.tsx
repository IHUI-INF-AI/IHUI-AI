import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  IdentityVerifyScreen as SharedIdentityVerifyScreen,
  type IdentityVerifyStatus,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface VerifyResult {
  status: IdentityVerifyStatus
  reason?: string
}

export function IdentityVerifyScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [status, setStatus] = useState<IdentityVerifyStatus>('unverified')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<VerifyResult>('/user/identity-verify')
        if (cancelled) return
        if (!res.success) throw new Error()
        setStatus(res.data?.status ?? 'unverified')
        setReason(res.data?.reason ?? '')
      } catch {
        if (!cancelled) setError(t('identityVerify.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetchApi('/user/identity-verify', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (!res.success) throw new Error()
      setStatus('pending')
    } catch {
      setError(t('identityVerify.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SharedIdentityVerifyScreen
      t={t}
      status={status}
      reason={reason}
      loading={loading}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
