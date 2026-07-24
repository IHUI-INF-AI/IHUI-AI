import { View, Text, Button, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { createRecharge, getActivity, getProfile, type UserInfo } from '@/api'
import { useI18n } from '@/i18n'
import { requestWxPayment, requestAliPayment, type AnyPayParams } from '@/utils/pay'
import './index.css'

const PRESET_AMOUNTS = [10, 50, 100, 500, 1000]
const TOKEN_RATE = 10
type PayMethod = 'wechat' | 'alipay'

interface ActivityData {
  activityRule?: string
  backgroundImage?: string
  computing?: number
}

const priceFmt = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function RechargePage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const [user, setUser] = useState<UserInfo | null>(null)
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [activityAmount, setActivityAmount] = useState('')
  const [loading, setLoading] = useState(true)

  const [preset, setPreset] = useState(100)
  const [custom, setCustom] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat')
  const [submitting, setSubmitting] = useState(false)

  const customNum = Number(custom) || 0
  const finalAmount = useCustom ? customNum : preset
  const tokenRate = activity?.computing ?? TOKEN_RATE

  useEffect(() => {
    Promise.all([
      getProfile().catch(() => null),
      getActivity().catch(() => null),
    ]).then(([u, a]) => {
      if (u) setUser(u)
      if (a && (a as ActivityData).activityRule) setActivity(a as ActivityData)
      setLoading(false)
    })
  }, [])

  const onSelectPreset = (v: number) => {
    setPreset(v)
    setUseCustom(false)
  }

  const onInputCustom = (e: { detail: { value: string } }) => {
    setCustom(e.detail.value)
    setUseCustom(true)
  }

  const onSelectMethod = (m: PayMethod) => setPayMethod(m)

  const payOrder = async (amount: number, method: PayMethod) => {
    const res = await createRecharge(amount, method)
    const orderNo = res.outTradeNo || ''
    if (res.payParams) {
      try {
        if (method === 'alipay') {
          await requestAliPayment(res.payParams as AnyPayParams)
        } else {
          await requestWxPayment(res.payParams as AnyPayParams)
        }
        Taro.redirectTo({
          url: `/pages/wallet/recharge/success?orderNo=${orderNo}&amount=${amount}`,
        })
      } catch {
        Taro.redirectTo({ url: `/pages/wallet/recharge/fail?orderNo=${orderNo}` })
      }
    } else {
      Taro.redirectTo({
        url: `/pages/wallet/recharge/success?orderNo=${orderNo}&amount=${amount}`,
      })
    }
  }

  const onSubmit = useCallback(async () => {
    if (!finalAmount || finalAmount < 1) {
      Taro.showToast({ title: tt('wallet.recharge.invalidAmount', '请输入有效金额'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await payOrder(finalAmount, payMethod)
    } catch {
      Taro.redirectTo({ url: '/pages/wallet/recharge/fail?orderNo=' })
    } finally {
      setSubmitting(false)
    }
  }, [finalAmount, payMethod])

  const onActivitySubmit = useCallback(async () => {
    const amt = Number(activityAmount) || 0
    if (!amt || amt < 1) {
      Taro.showToast({ title: tt('wallet.recharge.invalidAmount', '请输入有效金额'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await payOrder(amt, payMethod)
    } catch {
      Taro.redirectTo({ url: '/pages/wallet/recharge/fail?orderNo=' })
    } finally {
      setSubmitting(false)
    }
  }, [activityAmount, payMethod])

  if (loading) {
    return (
      <View className="rc-loading-mask">
        <View className="rc-loading-spinner" />
        <Text className="rc-loading-text">{tt('common.loading', '加载中…')}</Text>
      </View>
    )
  }

  return (
    <View className="rc-page">
      {submitting && (
        <View className="rc-loading-mask">
          <View className="rc-loading-spinner" />
          <Text className="rc-loading-text">{tt('wallet.recharge.submitting', '充值中…')}</Text>
        </View>
      )}

      {user && (
        <View className="rc-user-card">
          {user.avatar ? (
            <Image className="rc-user-avatar" src={user.avatar} mode="aspectFill" />
          ) : (
            <View className="rc-user-avatar rc-user-avatar--placeholder">
              <Text>{(user.nickname || 'U').slice(0, 1)}</Text>
            </View>
          )}
          <View className="rc-user-info">
            <Text className="rc-user-name">{user.nickname || tt('wallet.recharge.guest', '游客')}</Text>
            {user.phone && <Text className="rc-user-sub">{user.phone}</Text>}
          </View>
        </View>
      )}

      <View className="rc-card">
        <Text className="rc-section-title">{tt('wallet.recharge.amount', '充值金额')}</Text>
        <View className="rc-presets">
          {PRESET_AMOUNTS.map((v) => (
            <View
              key={v}
              className={`rc-preset ${!useCustom && preset === v ? 'rc-preset--active' : ''}`}
              onClick={() => onSelectPreset(v)}
            >
              <Text className="rc-preset-text">¥{v}</Text>
            </View>
          ))}
        </View>
        <View className="rc-custom">
          <Text className="rc-custom-label">{tt('wallet.recharge.customAmount', '自定义金额')}</Text>
          <Input
            className={`rc-input ${useCustom ? 'rc-input--active' : ''}`}
            type="digit"
            placeholder={tt('wallet.recharge.customPlaceholder', '请输入金额')}
            value={custom}
            onInput={onInputCustom}
          />
        </View>
        <Text className="rc-token-tip">
          {tt('wallet.recharge.tokenRate', '1元 = {{n}} 智汇值').replace('{{n}}', String(tokenRate))}
        </Text>
      </View>

      {activity && (
        <View className="rc-activity">
          {activity.backgroundImage && (
            <Image className="rc-activity-bg" src={activity.backgroundImage} mode="aspectFill" />
          )}
          <View className="rc-activity-body">
            <Text className="rc-activity-title">{tt('wallet.recharge.activityTitle', '限时活动')}</Text>
            {activity.activityRule && (
              <Text className="rc-activity-rule">{activity.activityRule}</Text>
            )}
            <Text className="rc-activity-rate">
              {tt('wallet.recharge.tokenRate', '1￥= {{n}} 智汇值').replace('{{n}}', String(activity.computing ?? TOKEN_RATE))}
            </Text>
            <Input
              className="rc-input rc-activity-input"
              type="digit"
              placeholder={tt('wallet.recharge.activityPlaceholder', '请输入活动充值金额')}
              value={activityAmount}
              onInput={(e) => setActivityAmount(e.detail.value)}
            />
            <Button
              className="rc-activity-btn"
              loading={submitting}
              disabled={submitting || !activityAmount}
              onClick={onActivitySubmit}
            >
              {tt('wallet.recharge.activitySubmit', '限时 优惠充值')}
            </Button>
          </View>
        </View>
      )}

      <View className="rc-card">
        <Text className="rc-section-title">{tt('wallet.recharge.method', '充值方式')}</Text>
        <View
          className={`rc-method ${payMethod === 'wechat' ? 'rc-method--active' : ''}`}
          onClick={() => onSelectMethod('wechat')}
        >
          <View className="rc-method-icon rc-method-icon--wx">{tt('pay.wechat', '微')}</View>
          <Text className="rc-method-name">{tt('wallet.recharge.methodWechat', '微信支付')}</Text>
          <View className={`rc-radio ${payMethod === 'wechat' ? 'rc-radio--on' : ''}`}>
            {payMethod === 'wechat' && <Text className="rc-radio-mark">✓</Text>}
          </View>
        </View>
        <View
          className={`rc-method ${payMethod === 'alipay' ? 'rc-method--active' : ''}`}
          onClick={() => onSelectMethod('alipay')}
        >
          <View className="rc-method-icon rc-method-icon--ali">{tt('pay.alipay', '支')}</View>
          <Text className="rc-method-name">{tt('wallet.recharge.methodAlipay', '支付宝')}</Text>
          <View className={`rc-radio ${payMethod === 'alipay' ? 'rc-radio--on' : ''}`}>
            {payMethod === 'alipay' && <Text className="rc-radio-mark">✓</Text>}
          </View>
        </View>
      </View>

      <Button
        className="rc-submit"
        loading={submitting}
        disabled={submitting || !finalAmount}
        onClick={onSubmit}
      >
        {submitting
          ? tt('wallet.recharge.submitting', '充值中…')
          : `${tt('wallet.recharge.submit', '充值')} ¥${priceFmt.format(finalAmount || 0)}`}
      </Button>
    </View>
  )
}
