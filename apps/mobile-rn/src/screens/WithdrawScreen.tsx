import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card, Input } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function WithdrawScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [amount, setAmount] = useState('')
  const [bankCardId, setBankCardId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    const num = Number(amount)
    if (!Number.isFinite(num) || num <= 0) {
      setError(t('withdraw.amountInvalid'))
      return
    }
    if (num < 10) {
      setError(t('withdraw.minAmount'))
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/wallet/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ amount: num, bankCardId: bankCardId || undefined }),
      })
      if (!resp.ok) throw new Error('http')
      setSuccess(t('withdraw.success'))
      setAmount('')
      setBankCardId('')
    } catch {
      setError(t('withdraw.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('withdraw.title')}</Text>
      </View>
      <View style={styles.body}>
        <Card style={styles.card}>
          <Text style={styles.label}>{t('withdraw.amount')}</Text>
          <Input
            value={amount}
            onChangeText={setAmount}
            placeholder={t('withdraw.amountPlaceholder')}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <Text style={styles.label}>{t('withdraw.bankCard')}</Text>
          <Input
            value={bankCardId}
            onChangeText={setBankCardId}
            placeholder={t('withdraw.bankCardPlaceholder')}
            style={styles.input}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}
          <Button loading={loading} disabled={loading} onPress={handleSubmit} style={styles.submitBtn}>
            {loading ? t('withdraw.submitting') : t('withdraw.submit')}
          </Button>
          <Text style={styles.hint}>{t('withdraw.feeHint')}</Text>
        </Card>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  body: { padding: 16 },
  card: { padding: 12, borderRadius: 8 },
  label: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  input: { marginTop: 4 },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  successText: { fontSize: 12, color: '#10B981', marginTop: 8 },
  submitBtn: { marginTop: 12, borderRadius: 8 },
  hint: { fontSize: 11, color: '#9CA3AF', marginTop: 8 },
})
