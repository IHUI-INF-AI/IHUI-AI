import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getDistributionInfo, withdraw } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function WithdrawalPage() {
  const { t } = useI18n()
  const [available, setAvailable] = useState(0)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('wechat')
  const [submitting, setSubmitting] = useState(false)
  const availableRef = useRef(0)

  const methods = [
    { value: 'wechat', label: t('distribution.withdraw.methodWechat') },
    { value: 'alipay', label: t('distribution.withdraw.methodAlipay') },
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
    setAmount(String(availableRef.current))
  }

  const onSubmit = async () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      Taro.showToast({ title: t('distribution.withdraw.invalidAmount'), icon: 'none' })
      return
    }
    if (amt > availableRef.current) {
      Taro.showToast({ title: t('distribution.withdraw.insufficient'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await withdraw({ amount: amt, type: method })
      Taro.showToast({ title: t('distribution.withdraw.submitted'), icon: 'success' })
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
        <Text className="wd-balance-label">{t('distribution.withdraw.available')}</Text>
        <Text className="wd-balance-amount">¥{available}</Text>
      </View>

      <View className="wd-form-card">
        <Text className="wd-section-label">{t('wallet.withdrawal.amountLabel')}</Text>
        <View className="wd-amount-row">
          <Text className="wd-currency">¥</Text>
          <Input
            className="wd-amount-input"
            type="digit"
            value={amount}
            onInput={(e) => setAmount(e.detail.value)}
            placeholder={t('distribution.withdraw.amountPlaceholder')}
          />
          <Text className="wd-all-btn" onClick={fillAll}>
            {t('distribution.withdraw.all')}
          </Text>
        </View>

        <Text className="wd-section-label wd-mt">{t('distribution.withdraw.method')}</Text>
        <View className="wd-method-list">
          {methods.map((m) => (
            <View
              key={m.value}
              className={`wd-method-item ${method === m.value ? 'active' : ''}`}
              onClick={() => setMethod(m.value)}
            >
              <View className={`wd-method-icon ${m.value}`}>
                {m.value === 'wechat' ? '微' : '付'}
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
        {t('distribution.withdraw.submit')}
      </Button>

      <View className="wd-records-entry" onClick={goRecords}>
        <Text>{t('wallet.withdrawal.records')}</Text>
      </View>
    </View>
  )
}
