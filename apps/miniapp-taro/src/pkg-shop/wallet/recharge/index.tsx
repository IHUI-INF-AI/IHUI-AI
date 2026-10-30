// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/app-topup/AppTopupScreen.tsx

import { useTt, useI18n } from '@/i18n'
import { View, Text, Button, Image } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { createRecharge, createAlipayMiniappPayment, getProfile, type UserInfo } from '@/api'
import { requestWxPayment, requestAliPayment, type AnyPayParams } from '@/utils/pay'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'
import './index.css'

const PRESET_AMOUNTS = [10, 50, 100, 500, 1000]
const TOKEN_RATE = 10
type PayMethod = 'wechat' | 'alipay'

const priceFmt = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export default function RechargePage() {
  const { t } = useI18n()
  const tt = useTt()

  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const [preset, setPreset] = useState(100)
  const [custom, setCustom] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat')
  const [submitting, setSubmitting] = useState(false)

  const customNum = Number(custom) || 0
  const finalAmount = useCustom ? customNum : preset
  const tokenRate = TOKEN_RATE

  // G-933 冷启动门控：getProfile → /user/profile 需鉴权（miniapp-compat-routes.ts:2247 checkAuth），
  // 整块延后到鉴权判定落定；顺带保留原先的 cleanup（取消未落定的订阅）。
  // (2026-10-30 g35-s8:原并列的 getActivity(/pay/activity) 腿已摘除——该路径经两面判据
  //  复核在两台后端均零注册,活动区 JSX 恒不渲染,摘除后本屏行为逐字节不变。)
  const { waitUntilReady } = useAuthReadyGate()
  useEffect(() => {
    return waitUntilReady(() => {
      getProfile()
        .then((u) => {
          if (u) setUser(u)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    })
  }, [waitUntilReady])

  const onSelectPreset = (v: number) => {
    setPreset(v)
    setUseCustom(false)
  }

  const onInputCustom = (e: { detail: { value: string } }) => {
    setCustom(e.detail.value)
    setUseCustom(true)
  }

  const onSelectMethod = (m: PayMethod) => setPayMethod(m)

  const payOrder = useCallback(
    async (amount: number, method: PayMethod) => {
      if (method === 'alipay') {
        const res = await createAlipayMiniappPayment({
          amount,
          subject: tt('wallet.recharge.submit', '充值'),
        })
        const orderNo = res.outTradeNo || ''
        if (!res.tradeNo) {
          Taro.showToast({ title: tt('pay.configNotReady', '支付宝支付配置未就绪'), icon: 'none' })
          Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=failed` })
          return
        }
        try {
          await requestAliPayment({ tradeNO: res.tradeNo } as AnyPayParams)
          Taro.redirectTo({
            url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&amount=${amount}&status=paid`,
          })
        } catch {
          Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=failed` })
        }
        return
      }
      const res = await createRecharge(amount, method)
      const orderNo = res.outTradeNo || ''
      if (res.payParams) {
        try {
          await requestWxPayment(res.payParams as AnyPayParams)
          Taro.redirectTo({
            url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&amount=${amount}&status=paid`,
          })
        } catch {
          Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=failed` })
        }
      } else {
        Taro.redirectTo({
          url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&amount=${amount}&status=paid`,
        })
      }
    },
    [tt],
  )

  const onSubmit = useCallback(async () => {
    if (!finalAmount || finalAmount < 1) {
      Taro.showToast({ title: tt('wallet.recharge.invalidAmount', '请输入有效金额'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await payOrder(finalAmount, payMethod)
    } catch {
      Taro.redirectTo({ url: '/pkg-shop/pay/result/index?orderNo=&status=failed' })
    } finally {
      setSubmitting(false)
    }
  }, [finalAmount, payMethod, payOrder, tt])

  if (loading) {
    return (
      <ThemeRoot>
        <View className="rc-loading-mask">
          <View className="rc-loading-spinner" />
          <Text className="rc-loading-text">{tt('common.loading', '加载中…')}</Text>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
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
              <Text className="rc-user-name">
                {user.nickname || tt('wallet.recharge.guest', '游客')}
              </Text>
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
                hoverClass="opacity-60"
              >
                <Text className="rc-preset-text">¥{v}</Text>
              </View>
            ))}
          </View>
          <View className="rc-custom">
            <Text className="rc-custom-label">
              {tt('wallet.recharge.customAmount', '自定义金额')}
            </Text>
            <FocusInput
              className={`rc-input ${useCustom ? 'rc-input--active' : ''}`}
              type="digit"
              placeholder={tt('wallet.recharge.customPlaceholder', '请输入金额')}
              value={custom}
              onInput={onInputCustom}
            />
          </View>
          <Text className="rc-token-tip">{t('wallet.recharge.tokenRate', { n: tokenRate })}</Text>
        </View>

        <View className="rc-card">
          <Text className="rc-section-title">{tt('wallet.recharge.method', '充值方式')}</Text>
          <View
            className={`rc-method ${payMethod === 'wechat' ? 'rc-method--active' : ''}`}
            onClick={() => onSelectMethod('wechat')}
            hoverClass="opacity-60"
          >
            <View className="rc-method-icon rc-method-icon--wx">{tt('pay.wechat', '微')}</View>
            <Text className="rc-method-name">{tt('wallet.recharge.methodWechat', '微信支付')}</Text>
            <View className={`rc-radio ${payMethod === 'wechat' ? 'rc-radio--on' : ''}`}>
              {/* 勾选位:原勾字符 → LineIcon。取值即该字符实际渲染档位 ——
                  index.css 的 .rc-radio-mark 记 font-size 24rpx / color
                  var(--color-cta-foreground);该规则只剩排版属性已随之删除,故类名不再挂
                  (挂在 mask 载体上既不染色也不定尺寸)。居中由父级 .rc-radio 的 flex 负责。 */}
              {payMethod === 'wechat' && (
                <LineIcon name="check" size={24} color="var(--color-cta-foreground)" />
              )}
            </View>
          </View>
          <View
            className={`rc-method ${payMethod === 'alipay' ? 'rc-method--active' : ''}`}
            onClick={() => onSelectMethod('alipay')}
            hoverClass="opacity-60"
          >
            <View className="rc-method-icon rc-method-icon--ali">{tt('pay.alipay', '支')}</View>
            <Text className="rc-method-name">{tt('wallet.recharge.methodAlipay', '支付宝')}</Text>
            <View className={`rc-radio ${payMethod === 'alipay' ? 'rc-radio--on' : ''}`}>
              {/* 勾选位:取值同微信支付方式那一处(.rc-radio-mark 的两个使用者同档) */}
              {payMethod === 'alipay' && (
                <LineIcon name="check" size={24} color="var(--color-cta-foreground)" />
              )}
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
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
