import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'
import './success.css'

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export default function RechargeSuccess() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const router = useRouter()
  const [amount, setAmount] = useState(0)
  const [orderNo, setOrderNo] = useState('')
  const [arriveTime, setArriveTime] = useState('')

  useEffect(() => {
    setAmount(Number(router.params.amount) || 0)
    setOrderNo(decodeURIComponent(router.params.orderNo || ''))
    setArriveTime(timeFmt.format(new Date()))
  }, [router.params.amount, router.params.orderNo])

  const goBack = () => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/user/index' }) })
  }

  const goHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  const viewDetail = () => {
    Taro.navigateTo({ url: '/pages/token/balance' })
  }

  return (
    <View className="rs-page">
      <View className="rs-head">
        <View className="rs-icon">
          <Text className="rs-icon-mark">✓</Text>
        </View>
        <Text className="rs-title">{tt('wallet.recharge.success.title', '充值成功')}</Text>
        <Text className="rs-desc">{tt('wallet.recharge.success.desc', '充值已到账')}</Text>
        {amount > 0 && (
          <View className="rs-amount-wrap">
            <Text className="rs-amount-symbol">¥</Text>
            <Text className="rs-amount">{amount.toFixed(2)}</Text>
          </View>
        )}
      </View>

      <View className="rs-tips">
        <Text className="rs-tips-title">{tt('wallet.recharge.success.tipsTitle', '温馨提示')}</Text>
        <Text className="rs-tips-text">
          {tt(
            'wallet.recharge.success.tipsText',
            '充值金额已到账,可在钱包明细中查看变动记录。如有疑问请联系客服。',
          )}
        </Text>
      </View>

      {(orderNo || arriveTime) && (
        <View className="rs-card">
          {orderNo ? (
            <View className="rs-row">
              <Text className="rs-row-label">{tt('wallet.recharge.success.orderNoLabel', '订单号')}</Text>
              <Text className="rs-row-value">{orderNo}</Text>
            </View>
          ) : null}
          {arriveTime ? (
            <View className="rs-row">
              <Text className="rs-row-label">{tt('wallet.recharge.success.arriveTime', '到账时间')}</Text>
              <Text className="rs-row-value">{arriveTime}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View className="rs-actions">
        <Button className="rs-btn rs-btn--primary" onClick={goBack}>
          {tt('wallet.recharge.success.backWallet', '返回钱包')}
        </Button>
        <Button className="rs-btn rs-btn--ghost" onClick={viewDetail}>
          {tt('wallet.recharge.success.viewDetail', '查看明细')}
        </Button>
        <Button className="rs-btn rs-btn--ghost" onClick={goHome}>
          {tt('wallet.recharge.success.backHome', '返回首页')}
        </Button>
        <Button className="rs-btn rs-btn--share" openType="share">
          {tt('wallet.recharge.success.shareFriend', '分享给好友')}
        </Button>
      </View>
    </View>
  )
}
