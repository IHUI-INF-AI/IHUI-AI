import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { WithdrawScreen as SharedWithdrawScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function WithdrawScreen() {
  const { t } = useI18n()
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
      const resp = await fetchApi<unknown>('/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: num, bankCardId: bankCardId || undefined }),
      })
      if (!resp.success) throw new Error('http')
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
    <SharedWithdrawScreen
      t={t}
      amount={amount}
      bankCardId={bankCardId}
      loading={loading}
      error={error}
      success={success}
      onAmountChange={setAmount}
      onBankCardIdChange={setBankCardId}
      onSubmit={handleSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
