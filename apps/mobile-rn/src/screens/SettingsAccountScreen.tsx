import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { SettingsAccountScreen as SharedSettingsAccountScreen, type SettingsAccountItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function SettingsAccountScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [account, setAccount] = useState<SettingsAccountItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetchApi<SettingsAccountItem>('/account')
      if (!r.success) throw new Error()
      setAccount(r.data ?? { name: '', email: '', phone: '' })
    } catch { setError(t('settingsAccount.loadFailed')) } finally { setLoading(false) }
  }, [t])

  useEffect(() => { void load() }, [load])

  const onSave = async () => {
    if (!account) return
    setSaving(true); setError(''); setToast('')
    try {
      const r = await fetchApi<unknown>('/account', {
        method: 'PUT',
        body: JSON.stringify(account),
      })
      if (!r.success) throw new Error()
      setToast(t('settingsAccount.saved'))
    } catch { setError(t('settingsAccount.loadFailed')) } finally { setSaving(false) }
  }

  return (
    <SharedSettingsAccountScreen
      t={t}
      account={account}
      loading={loading}
      saving={saving}
      error={error}
      toast={toast}
      onNameChange={(v) => setAccount((a) => (a ? { ...a, name: v } : a))}
      onEmailChange={(v) => setAccount((a) => (a ? { ...a, email: v } : a))}
      onPhoneChange={(v) => setAccount((a) => (a ? { ...a, phone: v } : a))}
      onSave={onSave}
      onBack={() => navigation.goBack()}
    />
  )
}
