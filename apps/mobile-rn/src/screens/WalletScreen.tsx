import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getBalance } from '@ihui/api-client'
import { WalletScreen as SharedWalletScreen, type WalletBalance } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function WalletScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getBalance()
      if (!res.success || !res.data) throw new Error(res.error)
      setBalance(res.data)
    } catch {
      setError(t('wallet.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedWalletScreen
      t={t}
      balance={balance}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onAction={(action) => navigation.navigate(action === 'withdraw' ? 'Withdraw' : 'Recharge')}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
