import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { AppTopupScreen as SharedAppTopupScreen } from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const AMOUNT_OPTIONS = [
  { id: 'a1', amount: 9900, label: '¥99' },
  { id: 'a2', amount: 19900, label: '¥199' },
  { id: 'a3', amount: 49900, label: '¥499' },
  { id: 'a4', amount: 99900, label: '¥999' },
]

const PAY_METHODS = [
  { id: 'wechat', label: '微信支付' },
  { id: 'alipay', label: '支付宝' },
]

export default function AppTopupScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [selectedId, setSelectedId] = useState(AMOUNT_OPTIONS[0].id)
  const [customAmount, setCustomAmount] = useState('')
  const [payMethod, setPayMethod] = useState(PAY_METHODS[0].id)
  const [balance, setBalance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [introVisible, setIntroVisible] = useState(true)

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetchApi<{ balance: number }>('/user/balance')
      if (res.success && res.data) {
        setBalance(res.data.balance)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void loadBalance()
  }, [loadBalance])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadBalance()
    setRefreshing(false)
  }, [loadBalance])

  const onSubmit = useCallback(() => {
    const selected = AMOUNT_OPTIONS.find((o) => o.id === selectedId)
    const amount = selected ? selected.amount : Number(customAmount) * 100
    if (!amount || amount <= 0) {
      return
    }
    Alert.alert('提示', `即将支付 ${(amount / 100).toFixed(2)} 元`)
  }, [selectedId, customAmount])

  const onCloseIntro = useCallback(() => {
    setIntroVisible(false)
  }, [])

  return (
    <SharedAppTopupScreen
      t={t}
      selectedId={selectedId}
      customAmount={customAmount}
      payMethod={payMethod}
      balance={balance}
      refreshing={refreshing}
      introVisible={introVisible}
      amountOptions={AMOUNT_OPTIONS}
      payMethods={PAY_METHODS}
      onSelectAmount={setSelectedId}
      onCustomAmountChange={setCustomAmount}
      onSelectPayMethod={setPayMethod}
      onRefresh={onRefresh}
      onSubmit={onSubmit}
      onCloseIntro={onCloseIntro}
      onBack={() => navigation.goBack()}
    />
  )
}
