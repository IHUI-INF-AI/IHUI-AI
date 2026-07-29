import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  RealNameAuthScreen as SharedRealNameAuthScreen,
  type RealNameAuthItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function RealNameAuthScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [status, setStatus] = useState<RealNameAuthItem | null>(null)
  const [name, setName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetchApi<RealNameAuthItem>('/user/real-name')
        if (cancelled) return
        if (!resp.success) throw new Error('http')
        setStatus(resp.data ?? { status: 'unverified' })
      } catch {
        if (!cancelled) setError(t('realNameAuth.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const onSubmit = useCallback(async () => {
    if (!name || !idNumber) {
      setError(t('realNameAuth.fieldsRequired'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const resp = await fetchApi<unknown>('/user/real-name', {
        method: 'POST',
        body: JSON.stringify({ name, idNumber }),
      })
      if (!resp.success) throw new Error('http')
      setStatus({ status: 'pending', name, idNumber })
    } catch {
      setError(t('realNameAuth.failed'))
    } finally {
      setSubmitting(false)
    }
  }, [name, idNumber, t])

  return (
    <SharedRealNameAuthScreen
      t={t}
      status={status}
      name={name}
      idNumber={idNumber}
      loading={loading}
      submitting={submitting}
      error={error}
      onNameChange={setName}
      onIdNumberChange={setIdNumber}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
