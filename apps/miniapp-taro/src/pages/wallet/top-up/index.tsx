import { View, Text, Button, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { createRecharge, getWalletBalance } from '@/api'
import { useI18n } from '@/i18n'
import { requestWxPayment, requestAliPayment, type AnyPayParams } from '@/utils/pay'
import './index.scss'

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000]
type PayMethod = 'wechat' | 'alipay'

export default function TopUpPage() {
  const { t } = useI18n()
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceError, setBalanceError] = useState(false)
  const [preset, setPreset] = useState(100)
  const [custom, setCustom] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getWalletBalance()
      .then((res) => {
        setBalance(res.balance ?? 0)
        setBalanceError(false)
      })
      .catch(() => setBalanceError(true))
  }, [])

  const customNum = Number(custom) || 0
  const finalAmount = useCustom ? customNum : preset

  const onSelectPreset = (v: number) => {
    setPreset(v)
    setUseCustom(false)
  }

  const onInputCustom = (e: { detail: { value: string } }) => {
    setCustom(e.detail.value)
    setUseCustom(true)
  }

  const onSelectMethod = (m: PayMethod) => setPayMethod(m)

  const onSubmit = useCallback(async () => {
    if (!finalAmount || finalAmount < 1) {
      Taro.showToast({ title: t('wallet.topUp.invalidAmount'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const res = await createRecharge(finalAmount, payMethod)
      const orderNo = res.outTradeNo || ''
      if (res.payParams) {
        try {
          if (payMethod === 'alipay') {
            await requestAliPayment(res.payParams as AnyPayParams)
          } else {
            await requestWxPayment(res.payParams as AnyPayParams)
          }
          Taro.redirectTo({
            url: `/pages/wallet/recharge/success?orderNo=${orderNo}&amount=${finalAmount}`,
          })
        } catch {
          Taro.redirectTo({ url: `/pages/wallet/recharge/fail?orderNo=${orderNo}` })
        }
      } else {
        Taro.redirectTo({
          url: `/pages/wallet/recharge/success?orderNo=${orderNo}&amount=${finalAmount}`,
        })
      }
    } catch {
      Taro.redirectTo({ url: '/pages/wallet/recharge/fail?orderNo=' })
    } finally {
      setSubmitting(false)
    }
  }, [finalAmount, payMethod, t])

  return (
    <View className="top-up-page pb-[160rpx]">
      <View className="top-up-balance">
        <Text className="top-up-balance__label">{t('wallet.topUp.balanceLabel')}</Text>
        <Text className="top-up-balance__value">
          {balance === null ? '--' : `${balance.toFixed(2)} ${t('wallet.topUp.balanceUnit')}`}
        </Text>
        {balanceError && (
          <Text className="top-up-balance__err">{t('wallet.topUp.balanceLoadFail')}</Text>
        )}
      </View>

      <View className="top-up-card">
        <Text className="top-up-card__title">{t('wallet.topUp.amount')}</Text>
        <View className="top-up-card__presets">
          {PRESET_AMOUNTS.map((v) => (
            <View
              key={v}
              className={`top-up-amount ${
                !useCustom && preset === v ? 'top-up-amount--active' : ''
              }`}
              onClick={() => onSelectPreset(v)}
            >
              <Text className="top-up-amount__text">¥{v}</Text>
            </View>
          ))}
        </View>
        <View className="top-up-card__custom">
          <Text className="top-up-card__custom-label">{t('wallet.topUp.customAmount')}</Text>
          <Input
            className={`top-up-input ${useCustom ? 'top-up-input--active' : ''}`}
            type="digit"
            placeholder={t('wallet.topUp.customPlaceholder')}
            value={custom}
            onInput={onInputCustom}
          />
        </View>
      </View>

      <View className="top-up-card">
        <Text className="top-up-card__title">{t('wallet.topUp.method')}</Text>
        <View
          className={`top-up-method ${payMethod === 'wechat' ? 'top-up-method--active' : ''}`}
          onClick={() => onSelectMethod('wechat')}
        >
          <View className="top-up-method__icon top-up-method__icon--wx">微</View>
          <Text className="top-up-method__name">{t('wallet.topUp.methodWechat')}</Text>
          <View
            className={`top-up-method__radio ${
              payMethod === 'wechat' ? 'top-up-method__radio--on' : ''
            }`}
          />
        </View>
        <View
          className={`top-up-method ${payMethod === 'alipay' ? 'top-up-method--active' : ''}`}
          onClick={() => onSelectMethod('alipay')}
        >
          <View className="top-up-method__icon top-up-method__icon--ali">支</View>
          <Text className="top-up-method__name">{t('wallet.topUp.methodAlipay')}</Text>
          <View
            className={`top-up-method__radio ${
              payMethod === 'alipay' ? 'top-up-method__radio--on' : ''
            }`}
          />
        </View>
      </View>

      <Button
        className="top-up-submit"
        loading={submitting}
        disabled={submitting || !finalAmount}
        onClick={onSubmit}
      >
        {submitting
          ? t('wallet.topUp.submitting')
          : `${t('wallet.topUp.submit')} ¥${finalAmount || 0}`}
      </Button>
    </View>
  )
}
