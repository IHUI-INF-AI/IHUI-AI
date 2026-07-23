import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getDistributionInfo, withdraw } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

const priceFmt = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function WithdrawalPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const [available, setAvailable] = useState(0)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('wechat')
  const [submitting, setSubmitting] = useState(false)
  const availableRef = useRef(0)

  const methods = [
    { value: 'wechat', label: tt('distribution.withdraw.methodWechat', '微信'), icon: '微' },
    { value: 'alipay', label: tt('distribution.withdraw.methodAlipay', '支付宝'), icon: '支' },
  ]

  const load = async () => {
    try {
      const info = await getDistributionInfo()
      setAvailable(info.available)
      availableRef.current = info.available
    } catch {
      // ignore
    }
  }

  const fillAll = () => {
    setAmount(priceFmt.format(availableRef.current))
  }

  const onSubmit = async () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      Taro.showToast({ title: tt('distribution.withdraw.invalidAmount', '请输入有效金额'), icon: 'none' })
      return
    }
    if (amt > availableRef.current) {
      Taro.showToast({ title: tt('distribution.withdraw.insufficient', '可提现余额不足'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await withdraw({ amount: amt, type: method })
      Taro.showToast({ title: tt('distribution.withdraw.submitted', '提现申请已提交'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  const goRecords = () => {
    Taro.navigateTo({ url: '/pages/developer/withdrawal' })
  }

  useDidShow(() => {
    load()
  })

  return (
    <View className="wd-page">
      <View className="wd-balance-card">
        <Text className="wd-balance-label">{tt('wallet.withdrawal.availableYuan', '可提现金额(元)')}</Text>
        <Text className="wd-balance-amount">{priceFmt.format(available)}</Text>
      </View>

      <View className="wd-form-card">
        <Text className="wd-section-label">{tt('wallet.withdrawal.amountLabel', '提现金额')}</Text>
        <View className="wd-amount-row">
          <Text className="wd-currency">¥</Text>
          <Input
            className="wd-amount-input"
            type="digit"
            value={amount}
            onInput={(e) => setAmount(e.detail.value)}
            placeholder={tt('distribution.withdraw.amountPlaceholder', '请输入提现金额')}
          />
          <Text className="wd-all-btn" onClick={fillAll}>
            {tt('distribution.withdraw.all', '全部提现')}
          </Text>
        </View>

        <Text className="wd-section-label wd-mt">{tt('distribution.withdraw.method', '提现方式')}</Text>
        <View className="wd-method-list">
          {methods.map((m) => (
            <View
              key={m.value}
              className={`wd-method-item ${method === m.value ? 'active' : ''}`}
              onClick={() => setMethod(m.value)}
            >
              <View className={`wd-method-icon ${m.value}`}>
                {m.icon}
              </View>
              <Text className="wd-method-name">{m.label}</Text>
              <View className={`wd-radio ${method === m.value ? 'checked' : ''}`}>
                {method === m.value && <Text className="wd-radio-mark">✓</Text>}
              </View>
            </View>
          ))}
        </View>
      </View>

      <Button
        className="wd-submit-btn"
        loading={submitting}
        disabled={submitting}
        onClick={onSubmit}
      >
        {tt('distribution.withdraw.submit', '提交申请')}
      </Button>

      <View className="wd-records-entry" onClick={goRecords}>
        <Text>{tt('wallet.withdrawal.records', '提现记录')}</Text>
      </View>
    </View>
  )
}
