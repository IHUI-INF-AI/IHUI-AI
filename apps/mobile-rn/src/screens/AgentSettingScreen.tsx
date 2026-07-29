import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { AgentSettingScreen as SharedAgentSettingScreen, type AgentSettingItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function AgentSettingScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [setting, setSetting] = useState<AgentSettingItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<AgentSettingItem>('/agent-setting')
      if (!res.success) throw new Error()
      setSetting(res.data ?? { name: '', model: '', temperature: 0.7, enabled: true })
    } catch {
      setError(t('agentSetting.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onChange = useCallback((patch: Partial<AgentSettingItem>) => {
    setSetting((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const save = async () => {
    if (!setting) return
    setSaving(true)
    setError('')
    setToast('')
    try {
      const res = await fetchApi<AgentSettingItem>('/agent-setting', {
        method: 'PUT',
        body: JSON.stringify(setting),
      })
      if (!res.success) throw new Error()
      setToast(t('agentSetting.saved'))
    } catch {
      setError(t('agentSetting.loadFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SharedAgentSettingScreen
      t={t}
      setting={setting}
      loading={loading}
      saving={saving}
      error={error}
      toast={toast}
      onChange={onChange}
      onSave={save}
      onBack={() => navigation.goBack()}
    />
  )
}
