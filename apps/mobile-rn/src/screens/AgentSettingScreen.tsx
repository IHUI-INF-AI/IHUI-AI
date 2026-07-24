import { useCallback, useEffect, useState } from 'react'
import { Switch, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Input, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
interface Setting { name: string; model: string; temperature: number; enabled: boolean }

export function AgentSettingScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const [setting, setSetting] = useState<Setting | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/agent-setting`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: Setting }
      setSetting(d.data ?? { name: '', model: '', temperature: 0.7, enabled: true })
    } catch { setError(t('agentSetting.loadFailed')) } finally { setLoading(false) }
  }, [token, t])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!setting) return
    setSaving(true); setError(''); setToast('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/agent-setting`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(setting),
      })
      if (!r.ok) throw new Error()
      setToast(t('agentSetting.saved'))
    } catch { setError(t('agentSetting.loadFailed')) } finally { setSaving(false) }
  }

  if (loading || !setting) {
    return <View className="flex-1 items-center justify-center p-4"><Loading /><Text className="mt-2 text-xs text-muted-foreground">{t('common.loading')}</Text></View>
  }

  return (
    <View className="flex-1 bg-card">
      <View className="flex-row items-center gap-3 px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()}><Text className="text-sm text-foreground">{t('common.back')}</Text></TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">{t('agentSetting.title')}</Text>
      </View>
      <View className="p-4">
        <Text className="mt-2 text-xs text-muted-foreground">{t('agentSetting.name')}</Text>
        <Input className="mt-1" value={setting.name} onChangeText={(v) => setSetting({ ...setting, name: v })} />
        <Text className="mt-2 text-xs text-muted-foreground">{t('agentSetting.model')}</Text>
        <Input className="mt-1" value={setting.model} onChangeText={(v) => setSetting({ ...setting, model: v })} />
        <Text className="mt-2 text-xs text-muted-foreground">{t('agentSetting.temperature')}: {setting.temperature.toFixed(2)}</Text>
        <Input className="mt-1" keyboardType="numeric" value={String(setting.temperature)} onChangeText={(v) => setSetting({ ...setting, temperature: Number(v) || 0 })} />
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-xs text-muted-foreground">{t('agentSetting.enabled')}</Text>
          <Switch value={setting.enabled} onValueChange={(v) => setSetting({ ...setting, enabled: v })} thumbColor="#10B981" />
        </View>
        {error ? <Text className="mt-2 text-xs text-destructive">{error}</Text> : null}
        {toast ? <Text className="mt-2 text-xs text-primary">{toast}</Text> : null}
        <TouchableOpacity className={`mt-4 items-center rounded-lg bg-primary py-2.5 ${saving ? 'opacity-50' : ''}`} onPress={save} disabled={saving}><Text className="text-sm font-semibold text-primary-foreground">{saving ? t('common.loading') : t('agentSetting.save')}</Text></TouchableOpacity>
      </View>
    </View>
  )
}
