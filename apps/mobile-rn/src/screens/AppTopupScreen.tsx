import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { AppTopupScreen as SharedAppTopupScreen } from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useWechatPayment } from '../hooks/useWechatPayment'
import { useAuth } from '../context/AuthContext'

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
  const { user } = useAuth()

  // 当前用户档位:identityType(操盘手=trader)优先,其次 isVip(0/1);数据源补齐 identityType 后操盘手档位即可高亮
  const userTier: 'normal' | 'vip' | 'trader' =
    user?.identityType === 'trader' ? 'trader' : user?.isVip === 1 ? 'vip' : 'normal'

  const [selectedId, setSelectedId] = useState(AMOUNT_OPTIONS[0]?.id ?? '')
  const [customAmount, setCustomAmount] = useState('')
  const [payMethod, setPayMethod] = useState(PAY_METHODS[0]?.id ?? '')
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

  // 最近一次提交的充值金额(分),供支付成功跳转 TopupSuccess 展示
  const lastAmountRef = useRef(0)

  // 真实微信 APP 支付链:检查安装→创建订单→调起支付→查询状态(对齐 VipScreen 范式)
  const { paying, pay } = useWechatPayment({
    orderType: 2, // 充值订单,对齐后端 orderType 枚举
    onSuccess: async (outTradeNo) => {
      await loadBalance()
      navigation.replace('TopupSuccess', {
        amount: lastAmountRef.current,
        orderId: outTradeNo,
      })
    },
    onFail: (reason) => {
      navigation.navigate('TopupFail', { reason })
    },
  })

  const onSubmit = useCallback(() => {
    const selected = AMOUNT_OPTIONS.find((o) => o.id === selectedId)
    const amount = selected ? selected.amount : Number(customAmount) * 100
    if (!amount || amount <= 0) {
      return
    }
    if (paying) {
      return
    }
    if (payMethod !== 'wechat') {
      Alert.alert('提示', '支付宝支付暂未开通，请选择微信支付')
      return
    }
    lastAmountRef.current = amount
    void pay(amount, `充值 ${(amount / 100).toFixed(2)} 元`)
  }, [selectedId, customAmount, payMethod, paying, pay])

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
      userTier={userTier}
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
