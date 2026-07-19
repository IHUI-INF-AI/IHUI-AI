import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type VerifyStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

interface VerifyResult {
  status: VerifyStatus
  reason?: string
}

export function IdentityVerifyScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [status, setStatus] = useState<VerifyStatus>('unverified')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/user/identity-verify`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!resp.ok) throw new Error('http')
        const data = (await resp.json()) as { data?: VerifyResult }
        if (cancelled) return
        setStatus(data.data?.status ?? 'unverified')
        setReason(data.data?.reason ?? '')
      } catch {
        if (!cancelled) setError(t('identityVerify.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, t])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/user/identity-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      })
      if (!resp.ok) throw new Error('http')
      setStatus('pending')
    } catch {
      setError(t('identityVerify.failed'))
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

  const items: Array<{ key: string; desc: string }> = [
    { key: 'front', desc: t('identityVerify.uploadFront') },
    { key: 'back', desc: t('identityVerify.uploadBack') },
    { key: 'selfie', desc: t('identityVerify.uploadSelfie') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('identityVerify.title')}</Text>
      </View>
      <View style={styles.body}>
        <Card style={styles.card}>
          <Text style={styles.subtitle}>{t('identityVerify.subtitle')}</Text>
          <Text style={[styles.status, status === 'verified' && styles.statusOk]}>
            {t(`identityVerify.status_${status}`)}
          </Text>
          {reason ? <Text style={styles.errorText}>{reason}</Text> : null}
        </Card>
        {status !== 'verified' && status !== 'pending' ? (
          <Card style={styles.card}>
            {items.map((item) => (
              <View key={item.key} style={styles.uploadItem}>
                <Text style={styles.label}>{item.desc}</Text>
                <TouchableOpacity style={styles.uploadBtn}>
                  <Text style={styles.uploadBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            ))}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button loading={submitting} disabled={submitting} onPress={handleSubmit} style={styles.submitBtn}>
              {submitting ? t('identityVerify.submitting') : t('identityVerify.submit')}
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
  subtitle: { fontSize: 12, color: '#6B7280' },
  status: { marginTop: 6, fontSize: 14, fontWeight: '600', color: '#DC2626' },
  statusOk: { color: '#10B981' },
  uploadItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  label: { fontSize: 12, color: '#374151' },
  uploadBtn: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  uploadBtnText: { fontSize: 24, color: '#9CA3AF' },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  submitBtn: { marginTop: 12, borderRadius: 8 },
  muted: { fontSize: 13, color: '#6B7280' },
})
