import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { getVipOrderPayInfo, createAlipayMiniappPayment, type VipPayInfo, getProfile, get, post } from '@/api'
import { requestWxPayment, requestAliPayment, type AnyPayParams } from '@/utils/pay'
import { useI18n } from '@/i18n'

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
const priceFmt = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
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
      get<{ items: CouponItem[] } | CouponItem[]>('/coupons/available', { amount: amt }).catch(() => null),
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

  const goRecharge = () => Taro.navigateTo({ url: '/pages/wallet/recharge' })

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
        Taro.redirectTo({ url: `/pages/pay/result?orderNo=${orderNo}` })
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
          Taro.redirectTo({ url: `/pages/pay/result?orderNo=${res.outTradeNo}` })
        } catch {
          Taro.redirectTo({ url: `/pages/wallet/recharge/fail?orderNo=${res.outTradeNo}` })
        }
        return
      }
      const res = await getVipOrderPayInfo(orderNo)
      if (res.status === 'paid') {
        Taro.redirectTo({ url: `/pages/pay/result?orderNo=${orderNo}` })
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
        .then(() => Taro.redirectTo({ url: `/pages/pay/result?orderNo=${no}` }))
        .catch(() => Taro.redirectTo({ url: `/pages/wallet/recharge/fail?orderNo=${no}` }))
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
    Taro.redirectTo({ url: `/pages/pay/result?orderNo=${no}` })
  }

  const payDisabled = submitting || expired || (payMethod === 'balance' && balanceInsufficient)

  const methodBase = 'flex items-center px-[12rpx] py-[20rpx] rounded-xl border-[2rpx] border-transparent'
  const methodActive = 'bg-[rgba(0,242,255,0.08)] border-[rgba(0,242,255,0.3)]'
  const radioBase = 'w-[36rpx] h-[36rpx] border-[2rpx] border-border rounded-lg bg-secondary flex items-center justify-center'
  const radioOn = 'border-primary bg-primary'

  return (
    <View className="min-h-[100vh] bg-background p-[24rpx] pb-[180rpx]">
      <View className={`mb-[24rpx] px-[32rpx] py-[20rpx] bg-secondary rounded-xl border-[2rpx] border-border text-center${expired ? ' border-destructive bg-[rgba(255,59,59,0.08)]' : ''}`}>
        <Text className={`text-[26rpx] font-semibold${expired ? ' text-destructive' : ' text-primary'}`}>
          {expired
            ? tt('pay.orderExpired', '订单已超时')
            : tt('pay.countdownTip', '支付剩余时间 {{time}}').replace('{{time}}', formatTime(remaining))}
        </Text>
      </View>

      <View className="px-[32rpx] py-[40rpx] bg-card rounded-2xl border-[2rpx] border-border text-center">
        <Text className="block text-[26rpx] text-muted-foreground">{t('pay.orderAmount')}</Text>
        <Text className="block mt-[16rpx] text-[64rpx] text-destructive font-bold">¥{priceFmt.format(finalAmount)}</Text>
        {couponDiscount > 0 && (
          <Text className="block mt-[12rpx] text-[24rpx] text-success">
            {tt('pay.couponSaved', '已优惠 ¥{{n}}').replace('{{n}}', priceFmt.format(couponDiscount))}
          </Text>
        )}
      </View>

      <View className="mt-[24rpx] px-[32rpx] py-[24rpx] bg-card rounded-2xl border-[2rpx] border-border">
        <View className="flex items-center justify-between py-[12rpx]">
          <Text className="text-[26rpx] text-muted-foreground">{tt('pay.orderNo', '订单号')}</Text>
          <Text className="text-[26rpx] text-foreground max-w-[360rpx] overflow-hidden text-ellipsis whitespace-nowrap">{orderNo || '—'}</Text>
        </View>
        <View className="flex items-center justify-between py-[12rpx]">
          <Text className="text-[26rpx] text-muted-foreground">{tt('pay.goodsName', '商品名称')}</Text>
          <Text className="text-[26rpx] text-foreground max-w-[360rpx] overflow-hidden text-ellipsis whitespace-nowrap">
            {orderDetail.goodsName || tt('pay.vipSubscription', '会员订阅')}
          </Text>
        </View>
        <View className="flex items-center justify-between py-[12rpx]">
          <Text className="text-[26rpx] text-muted-foreground">{tt('pay.createTime', '下单时间')}</Text>
          <Text className="text-[26rpx] text-foreground max-w-[360rpx] overflow-hidden text-ellipsis whitespace-nowrap">{orderDetail.createTime || '—'}</Text>
        </View>
      </View>

      <View className="mt-[24rpx] px-[32rpx] py-[24rpx] bg-card rounded-2xl border-[2rpx] border-border">
        <Text className="block text-[28rpx] text-foreground font-semibold mb-[16rpx]">{t('pay.selectMethod')}</Text>

        <View
          className={`${methodBase}${payMethod === 'wechat' ? ` ${methodActive}` : ''}`}
          onClick={() => onSelectMethod('wechat')}
        >
          <View className={`w-[64rpx] h-[64rpx] leading-[64rpx] text-center rounded-xl text-[28rpx] bg-muted font-bold ${METHOD_ICON_COLOR.wechat}`}>{tt('pay.wechat', '微')}</View>
          <View className="flex-1 ml-[24rpx] flex flex-col">
            <Text className="text-[28rpx] text-foreground">{t('pay.wechat')}</Text>
          </View>
          <View className={`${radioBase}${payMethod === 'wechat' ? ` ${radioOn}` : ''}`}>
            {payMethod === 'wechat' && <Text className="text-primary-foreground text-[24rpx] font-bold leading-none">✓</Text>}
          </View>
        </View>

        <View
          className={`${methodBase}${payMethod === 'alipay' ? ` ${methodActive}` : ''}`}
          onClick={() => onSelectMethod('alipay')}
        >
          <View className={`w-[64rpx] h-[64rpx] leading-[64rpx] text-center rounded-xl text-[28rpx] bg-muted font-bold ${METHOD_ICON_COLOR.alipay}`}>{tt('pay.alipay', '支')}</View>
          <View className="flex-1 ml-[24rpx] flex flex-col">
            <Text className="text-[28rpx] text-foreground">{tt('pay.alipay', '支付宝')}</Text>
          </View>
          <View className={`${radioBase}${payMethod === 'alipay' ? ` ${radioOn}` : ''}`}>
            {payMethod === 'alipay' && <Text className="text-primary-foreground text-[24rpx] font-bold leading-none">✓</Text>}
          </View>
        </View>

        <View
          className={`${methodBase}${payMethod === 'balance' ? ` ${methodActive}` : ''}`}
          onClick={() => onSelectMethod('balance')}
        >
          <View className={`w-[64rpx] h-[64rpx] leading-[64rpx] text-center rounded-xl text-[28rpx] bg-muted font-bold ${METHOD_ICON_COLOR.balance}`}>{tt('pay.balance', '余')}</View>
          <View className="flex-1 ml-[24rpx] flex flex-col">
            <Text className="text-[28rpx] text-foreground">{tt('pay.balance', '余额支付')}</Text>
            <Text className="mt-[6rpx] text-[24rpx] text-muted-foreground">
              {tt('pay.balanceAmount', '余额 ¥{{n}}').replace('{{n}}', priceFmt.format(balance))}
              {balanceInsufficient ? ` · ${tt('pay.balanceInsufficient', '余额不足,请充值')}` : ''}
            </Text>
          </View>
          {balanceInsufficient ? (
            <Text
              className="px-[20rpx] py-[8rpx] text-[24rpx] text-primary border-[2rpx] border-primary rounded-lg"
              onClick={(e) => {
                e.stopPropagation()
                goRecharge()
              }}
            >
              {tt('pay.recharge', '充值')}
            </Text>
          ) : (
            <View className={`${radioBase}${payMethod === 'balance' ? ` ${radioOn}` : ''}`}>
              {payMethod === 'balance' && <Text className="text-primary-foreground text-[24rpx] font-bold leading-none">✓</Text>}
            </View>
          )}
        </View>
      </View>

      <View className="flex items-center justify-between mt-[24rpx] px-[32rpx] py-[24rpx] bg-card rounded-2xl border-[2rpx] border-border" onClick={onSelectCoupon}>
        <Text className="text-[28rpx] text-foreground">{tt('pay.coupon', '优惠券')}</Text>
        <View className="flex items-center">
          {selectedCoupon ? (
            <Text className="text-[28rpx] text-destructive font-semibold">-¥{priceFmt.format(selectedCoupon.amount)}</Text>
          ) : (
            <Text className="text-[26rpx] text-muted-foreground">
              {coupons.length > 0
                ? tt('pay.couponAvailable', '{{n}} 张可用').replace('{{n}}', String(coupons.length))
                : tt('pay.noCoupon', '暂无可用优惠券')}
            </Text>
          )}
          <Text className="ml-[12rpx] text-[32rpx] text-muted-foreground">›</Text>
        </View>
      </View>

      <Button
        className={`fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-primary text-primary-foreground rounded-xl text-[32rpx] font-bold${payDisabled ? ' opacity-50' : ''}`}
        loading={submitting}
        disabled={payDisabled}
        onClick={onPay}
      >
        {expired
          ? tt('pay.orderExpired', '订单已超时')
          : `${t('pay.confirm')} ¥${priceFmt.format(finalAmount)}`}
      </Button>
    </View>
  )
}
