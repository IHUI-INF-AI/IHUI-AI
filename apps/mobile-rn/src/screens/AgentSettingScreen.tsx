import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
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
    return <View style={s.center}><ActivityIndicator /><Text style={s.muted}>{t('common.loading')}</Text></View>
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('agentSetting.title')}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.label}>{t('agentSetting.name')}</Text>
        <TextInput style={s.input} value={setting.name} onChangeText={(v) => setSetting({ ...setting, name: v })} />
        <Text style={s.label}>{t('agentSetting.model')}</Text>
        <TextInput style={s.input} value={setting.model} onChangeText={(v) => setSetting({ ...setting, model: v })} />
        <Text style={s.label}>{t('agentSetting.temperature')}: {setting.temperature.toFixed(2)}</Text>
        <TextInput style={s.input} keyboardType="numeric" value={String(setting.temperature)} onChangeText={(v) => setSetting({ ...setting, temperature: Number(v) || 0 })} />
        <View style={s.row}>
          <Text style={s.label}>{t('agentSetting.enabled')}</Text>
          <Switch value={setting.enabled} onValueChange={(v) => setSetting({ ...setting, enabled: v })} thumbColor="#10B981" />
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        {toast ? <Text style={s.toast}>{toast}</Text> : null}
        <TouchableOpacity style={s.btn} onPress={save} disabled={saving}><Text style={s.btnText}>{saving ? t('common.loading') : t('agentSetting.save')}</Text></TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  body: { padding: 16 },
  back: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  label: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  input: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 13, color: '#111827' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  error: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  toast: { fontSize: 12, color: '#10B981', marginTop: 8 },
  btn: { marginTop: 16, backgroundColor: '#10B981', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: '#6B7280', marginTop: 8 },
})
