// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import {
  getVipOrderPayInfo,
  createAlipayMiniappPayment,
  type VipPayInfo,
  getProfile,
  get,
  post,
} from '@/api'
import { requestWxPayment, requestAliPayment, type AnyPayParams } from '@/utils/pay'
import ThemeRoot from '@/components/ThemeRoot'

type PayMethod = 'wechat' | 'alipay' | 'balance'

interface CouponItem {
  id: string
  title: string
  amount: number
  threshold: number
}

interface OrderDetailInfo {
  goodsName?: string
  createTime?: string
}

const COUNTDOWN_TOTAL = 15 * 60
const priceFmt = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const METHOD_ICON_COLOR: Record<PayMethod, string> = {
  wechat: 'text-success',
  alipay: 'text-primary',
  balance: 'text-warning',
}

function formatTime(sec: number): string {
  const m = String(Math.max(0, Math.floor(sec / 60))).padStart(2, '0')
  const s = String(Math.max(0, sec % 60)).padStart(2, '0')
  return `${m}:${s}`
}

export default function PayIndex() {
  const { t } = useI18n()
  const tt = useTt()
  const router = useRouter()

  const [orderNo, setOrderNo] = useState('')
  const [amount, setAmount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat')
  const [balance, setBalance] = useState(0)
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [selectedCouponId, setSelectedCouponId] = useState('')
  const [orderDetail, setOrderDetail] = useState<OrderDetailInfo>({})
  const [remaining, setRemaining] = useState(COUNTDOWN_TOTAL)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const expired = remaining <= 0
  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId)
  const couponDiscount = selectedCoupon?.amount ?? 0
  const finalAmount = Math.max(0, amount - couponDiscount)
  const balanceInsufficient = balance < finalAmount

  useEffect(() => {
    const no = router.params.orderNo || ''
    const amt = Number(router.params.amount) || 0
    setOrderNo(no)
    setAmount(amt)
    if (!no) return

    Promise.all([
      getProfile().catch(() => null),
      get<OrderDetailInfo>(`/vip/order/${no}`).catch(() => null),
      get<{ items: CouponItem[] } | CouponItem[]>('/coupons/available', { amount: amt }).catch(
        () => null,
      ),
    ]).then(([user, detail, couponRes]) => {
      if (user && typeof user.balance === 'number') setBalance(user.balance)
      if (detail) setOrderDetail(detail)
      if (couponRes) {
        const list = Array.isArray(couponRes) ? couponRes : couponRes.items || []
        setCoupons(list)
      }
    })

    timerRef.current = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [router.params.orderNo, router.params.amount])

  const onSelectMethod = (m: PayMethod) => {
    if (m === 'balance' && balanceInsufficient) {
      Taro.showToast({ title: tt('pay.balanceInsufficient', '余额不足,请充值'), icon: 'none' })
      return
    }
    setPayMethod(m)
  }

  const onSelectCoupon = () => {
    if (coupons.length === 0) {
      Taro.showToast({ title: tt('pay.noCoupon', '暂无可用优惠券'), icon: 'none' })
      return
    }
    const items = [
      { name: tt('pay.couponNone', '不使用优惠券'), id: '' },
      ...coupons.map((c) => ({ name: `${c.title} (-¥${priceFmt.format(c.amount)})`, id: c.id })),
    ]
    Taro.showActionSheet({
      itemList: items.map((i) => i.name),
      success: (res) => setSelectedCouponId(items[res.tapIndex]?.id ?? ''),
    })
  }

  const goRecharge = () => Taro.navigateTo({ url: '/pages/wallet/recharge/index' })

  const onPay = async () => {
    if (!orderNo) {
      Taro.showToast({ title: t('pay.orderAbnormal'), icon: 'none' })
      return
    }
    if (expired) {
      Taro.showToast({ title: tt('pay.orderExpired', '订单已超时,请重新下单'), icon: 'none' })
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      if (payMethod === 'balance') {
        await post('/pay/balance', { orderNo })
        Taro.redirectTo({ url: `/pages/pay/result/index?orderNo=${orderNo}&status=paid` })
        return
      }
      if (payMethod === 'alipay') {
        const res = await createAlipayMiniappPayment({
          amount: finalAmount,
          subject: orderDetail.goodsName || tt('pay.vipSubscription', '会员订阅'),
        })
        if (!res.tradeNo) {
          Taro.showToast({ title: tt('pay.configNotReady', '支付宝支付配置未就绪'), icon: 'none' })
          return
        }
        try {
          await requestAliPayment({ tradeNO: res.tradeNo } as AnyPayParams)
          Taro.redirectTo({ url: `/pages/pay/result/index?orderNo=${res.outTradeNo}&status=paid` })
        } catch {
          Taro.redirectTo({
            url: `/pages/pay/result/index?orderNo=${res.outTradeNo}&status=failed`,
          })
        }
        return
      }
      const res = await getVipOrderPayInfo(orderNo)
      if (res.status === 'paid') {
        Taro.redirectTo({ url: `/pages/pay/result/index?orderNo=${orderNo}&status=paid` })
        return
      }
      if (!res.payInfo) {
        Taro.showToast({ title: t('pay.missingParams'), icon: 'none' })
        return
      }
      dispatchPay(res.payInfo, orderNo)
    } catch {
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  function dispatchPay(payInfo: VipPayInfo, no: string) {
    if (
      payInfo.method === 'jsapi' &&
      payInfo.timeStamp &&
      payInfo.nonceStr &&
      payInfo.package &&
      payInfo.signType &&
      payInfo.paySign
    ) {
      requestWxPayment(payInfo as AnyPayParams)
        .then(() => Taro.redirectTo({ url: `/pages/pay/result/index?orderNo=${no}&status=paid` }))
        .catch(() =>
          Taro.redirectTo({ url: `/pages/pay/result/index?orderNo=${no}&status=failed` }),
        )
      return
    }
    if (payInfo.method === 'h5' && payInfo.h5Url && process.env.TARO_ENV === 'h5') {
      window.location.href = payInfo.h5Url
      return
    }
    if (payInfo.method === 'native') {
      Taro.showToast({ title: t('pay.useWechatScan'), icon: 'none' })
      return
    }
    if (payInfo.mock && payInfo.error) {
      Taro.showToast({ title: t('pay.configNotReady'), icon: 'none' })
    }
    Taro.redirectTo({ url: `/pages/pay/result/index?orderNo=${no}` })
  }

  const payDisabled = submitting || expired || (payMethod === 'balance' && balanceInsufficient)

  const methodBase = 'py-method'
  const methodActive = 'py-method--active'
  const radioBase = 'py-radio'
  const radioOn = 'py-radio--on'

  return (
    <ThemeRoot>
      <View className="py-page">
        <View className={`py-countdown${expired ? ' py-countdown--expired' : ''}`}>
          <Text className="py-countdown-text">
            {expired
              ? tt('pay.orderExpired', '订单已超时')
              : t('pay.countdownTip', { time: formatTime(remaining) })}
          </Text>
        </View>

        <View className="py-amount-card">
          <Text className="py-amount-label">{t('pay.orderAmount')}</Text>
          <Text className="py-amount-value">¥{priceFmt.format(finalAmount)}</Text>
          {couponDiscount > 0 && (
            <Text className="py-amount-discount">
              {t('pay.couponSaved', { n: priceFmt.format(couponDiscount) })}
            </Text>
          )}
        </View>

        <View className="py-order-card">
          <View className="py-order-row">
            <Text className="py-order-label">{tt('pay.orderNo', '订单号')}</Text>
            <Text className="py-order-value">{orderNo || '—'}</Text>
          </View>
          <View className="py-order-row">
            <Text className="py-order-label">{tt('pay.goodsName', '商品名称')}</Text>
            <Text className="py-order-value">
              {orderDetail.goodsName || tt('pay.vipSubscription', '会员订阅')}
            </Text>
          </View>
          <View className="py-order-row">
            <Text className="py-order-label">{tt('pay.createTime', '下单时间')}</Text>
            <Text className="py-order-value">{orderDetail.createTime || '—'}</Text>
          </View>
        </View>

        <View className="py-method-card">
          <Text className="py-section-title">{t('pay.selectMethod')}</Text>

          <View
            className={`${methodBase}${payMethod === 'wechat' ? ` ${methodActive}` : ''}`}
            hoverClass="opacity-60"
            onClick={() => onSelectMethod('wechat')}
          >
            <View className={`py-method-icon ${METHOD_ICON_COLOR.wechat}`}>
              {tt('pay.wechat', '微')}
            </View>
            <View className="py-method-body">
              <Text className="py-method-name">{t('pay.wechat')}</Text>
            </View>
            <View className={`${radioBase}${payMethod === 'wechat' ? ` ${radioOn}` : ''}`}>
              {payMethod === 'wechat' && (
                <LineIcon name="check" size={24} color="var(--color-primary-foreground)" />
              )}
            </View>
          </View>

          <View
            className={`${methodBase}${payMethod === 'alipay' ? ` ${methodActive}` : ''}`}
            hoverClass="opacity-60"
            onClick={() => onSelectMethod('alipay')}
          >
            <View className={`py-method-icon ${METHOD_ICON_COLOR.alipay}`}>
              {tt('pay.alipay', '支')}
            </View>
            <View className="py-method-body">
              <Text className="py-method-name">{tt('pay.alipay', '支付宝')}</Text>
            </View>
            <View className={`${radioBase}${payMethod === 'alipay' ? ` ${radioOn}` : ''}`}>
              {payMethod === 'alipay' && (
                <LineIcon name="check" size={24} color="var(--color-primary-foreground)" />
              )}
            </View>
          </View>

          <View
            className={`${methodBase}${payMethod === 'balance' ? ` ${methodActive}` : ''}`}
            hoverClass="opacity-60"
            onClick={() => onSelectMethod('balance')}
          >
            <View className={`py-method-icon ${METHOD_ICON_COLOR.balance}`}>
              {tt('pay.balance', '余')}
            </View>
            <View className="py-method-body">
              <Text className="py-method-name">{tt('pay.balance', '余额支付')}</Text>
              <Text className="py-method-sub">
                {t('pay.balanceAmount', { n: priceFmt.format(balance) })}
                {balanceInsufficient
                  ? ` · ${tt('pay.balanceInsufficient', '余额不足,请充值')}`
                  : ''}
              </Text>
            </View>
            {balanceInsufficient ? (
              <Text
                className="py-recharge-link"
                onClick={(e) => {
                  e.stopPropagation()
                  goRecharge()
                }}
              >
                {tt('pay.recharge', '充值')}
              </Text>
            ) : (
              <View className={`${radioBase}${payMethod === 'balance' ? ` ${radioOn}` : ''}`}>
                {payMethod === 'balance' && (
                  <LineIcon name="check" size={24} color="var(--color-primary-foreground)" />
                )}
              </View>
            )}
          </View>
        </View>

        <View className="py-coupon-card" hoverClass="opacity-60" onClick={onSelectCoupon}>
          <Text className="py-coupon-label">{tt('pay.coupon', '优惠券')}</Text>
          <View className="py-coupon-right">
            {selectedCoupon ? (
              <Text className="py-coupon-value">-¥{priceFmt.format(selectedCoupon.amount)}</Text>
            ) : (
              <Text className="py-coupon-placeholder">
                {coupons.length > 0
                  ? t('pay.couponAvailable', { n: coupons.length })
                  : tt('pay.noCoupon', '暂无可用优惠券')}
              </Text>
            )}
            <Text className="py-coupon-arrow">›</Text>
          </View>
        </View>

        <Button
          className={`py-submit${payDisabled ? ' py-submit--disabled' : ''}`}
          loading={submitting}
          disabled={payDisabled}
          onClick={onPay}
        >
          {expired
            ? tt('pay.orderExpired', '订单已超时')
            : `${t('pay.confirm')} ¥${priceFmt.format(finalAmount)}`}
        </Button>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
