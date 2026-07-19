import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
interface Account { name: string; email: string; phone: string }

export function SettingsAccountScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/account`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: Account }
      setAccount(d.data ?? { name: '', email: '', phone: '' })
    } catch { setError(t('settingsAccount.loadFailed')) } finally { setLoading(false) }
  }, [token, t])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!account) return
    setSaving(true); setError(''); setToast('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/account`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(account),
      })
      if (!r.ok) throw new Error()
      setToast(t('settingsAccount.saved'))
    } catch { setError(t('settingsAccount.loadFailed')) } finally { setSaving(false) }
  }

  if (loading || !account) {
    return <View style={s.center}><ActivityIndicator /><Text style={s.muted}>{t('common.loading')}</Text></View>
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('settingsAccount.title')}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.label}>{t('settingsAccount.name')}</Text>
        <TextInput style={s.input} value={account.name} onChangeText={(v) => setAccount({ ...account, name: v })} />
        <Text style={s.label}>{t('settingsAccount.email')}</Text>
        <TextInput style={s.input} value={account.email} onChangeText={(v) => setAccount({ ...account, email: v })} keyboardType="email-address" autoCapitalize="none" />
        <Text style={s.label}>{t('settingsAccount.phone')}</Text>
        <TextInput style={s.input} value={account.phone} onChangeText={(v) => setAccount({ ...account, phone: v })} keyboardType="phone-pad" />
        {error ? <Text style={s.error}>{error}</Text> : null}
        {toast ? <Text style={s.toast}>{toast}</Text> : null}
        <TouchableOpacity style={[s.btn, saving && s.btnDisabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.btnText}>{t('settingsAccount.save')}</Text>}
        </TouchableOpacity>
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
  input: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 13, color: '#111827' },
  error: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  toast: { fontSize: 12, color: '#10B981', marginTop: 8 },
  btn: { marginTop: 16, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: '#6B7280', marginTop: 8 },
})
