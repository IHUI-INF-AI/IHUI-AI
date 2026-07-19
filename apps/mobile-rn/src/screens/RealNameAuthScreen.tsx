import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card, Input } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface AuthStatus {
  status: 'unverified' | 'pending' | 'verified' | 'rejected'
  name?: string
  idNumber?: string
  reason?: string
}

export function RealNameAuthScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [name, setName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/user/real-name`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!resp.ok) throw new Error('http')
        const data = (await resp.json()) as { data?: AuthStatus }
        if (cancelled) return
        setStatus(data.data ?? { status: 'unverified' })
      } catch {
        if (!cancelled) setError(t('realNameAuth.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, t])

  const handleSubmit = async () => {
    if (!name || !idNumber) {
      setError(t('realNameAuth.fieldsRequired'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/user/real-name`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, idNumber }),
      })
      if (!resp.ok) throw new Error('http')
      setStatus({ status: 'pending', name, idNumber })
    } catch {
      setError(t('realNameAuth.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('realNameAuth.title')}</Text>
      </View>
      <View style={styles.body}>
        <Card style={styles.card}>
          <Text style={styles.statusLabel}>{t('realNameAuth.status')}</Text>
          <Text style={[styles.statusValue, status?.status === 'verified' && styles.statusVerified]}>
            {t(`realNameAuth.status_${status?.status ?? 'unverified'}`)}
          </Text>
          {status?.status === 'verified' ? (
            <Text style={styles.hint}>{t('realNameAuth.verifiedDesc')}</Text>
          ) : (
            <Text style={styles.hint}>{t('realNameAuth.unverifiedDesc')}</Text>
          )}
          {status?.reason ? <Text style={styles.errorText}>{status.reason}</Text> : null}
        </Card>
        {status?.status !== 'verified' && status?.status !== 'pending' ? (
          <Card style={styles.card}>
            <Text style={styles.label}>{t('realNameAuth.name')}</Text>
            <Input value={name} onChangeText={setName} placeholder={t('realNameAuth.namePlaceholder')} style={styles.input} />
            <Text style={styles.label}>{t('realNameAuth.idNumber')}</Text>
            <Input value={idNumber} onChangeText={setIdNumber} placeholder={t('realNameAuth.idNumberPlaceholder')} style={styles.input} />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button loading={submitting} disabled={submitting} onPress={handleSubmit} style={styles.submitBtn}>
              {submitting ? t('realNameAuth.submitting') : t('realNameAuth.submit')}
            </Button>
          </Card>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  body: { padding: 16 },
  card: { padding: 12, marginBottom: 12, borderRadius: 8 },
  statusLabel: { fontSize: 12, color: '#6B7280' },
  statusValue: { marginTop: 4, fontSize: 16, fontWeight: '600', color: '#DC2626' },
  statusVerified: { color: '#10B981' },
  hint: { marginTop: 8, fontSize: 12, color: '#9CA3AF' },
  label: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  input: { marginTop: 4 },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  submitBtn: { marginTop: 12, borderRadius: 8 },
  muted: { fontSize: 13, color: '#6B7280' },
})
