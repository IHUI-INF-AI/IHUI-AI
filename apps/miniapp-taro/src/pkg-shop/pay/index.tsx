// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import {
  getVipOrderPayInfo,
  createAlipayMiniappPayment,
  type VipPayInfo,
  get,
} from '@/api'
import { requestWxPayment, requestAliPayment, type AnyPayParams } from '@/utils/pay'
import ThemeRoot from '@/components/ThemeRoot'

/**
 * 支付方式与 web 端同源收银台对齐(见 apps/web/app/(main)/payment/checkout/PageClient.tsx
 * 的 METHODS 现值:wechat/alipay 两档)。原先的第三档「余额支付」已摘除,三重证据:
 * ① 它打的 `POST /pay/balance` 后端注册面从未有过(每次 404,被外层 catch 吞成"操作失败");
 * ② 档位上的"余额"读数取自 GET /user/profile 的 balance 字段,而该端点的字段投影里
 *    根本没有 balance ⇒ 永远显示 ¥0.00、永远"余额不足,请充值",这一档从上线起就不可选;
 * ③ 全仓唯一的"余额"账本 userMargins.tokenQuantity 是 **AI token 额度**(充值订单回调
 *    rechargeToken 加的就是它),不是现金负债 —— 拿它抵扣会员订单在资金语义上不成立,
 *    要真做"余额支付"需要先定义现金钱包账本,那是独立产品票,不是这一枚 bug 修复。
 * §30 口径:没有终态的能力不许渲染成可用档。
 */
type PayMethod = 'wechat' | 'alipay'

interface CouponItem {
  id: string
  title: string
  amount: number
  threshold: number
}

/**
 * GET /orders/:orderNo 的真实回形(原写法打 `/vip/order/${no}` —— 后端只有
 * POST /vip/order 与 GET /vip/order/:orderNo/payinfo,从未有过 GET /vip/order/:orderNo)。
 * 字段名按后端投影逐字取:eduOrders 行是 targetTitle/createdAt,不是 goodsName/createTime。
 */
interface OrderInfo {
  orderNo?: string
  targetTitle?: string
  createdAt?: string
}

const COUNTDOWN_TOTAL = 15 * 60
const priceFmt = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const METHOD_ICON_COLOR: Record<PayMethod, string> = {
  wechat: 'text-success',
  alipay: 'text-primary',
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
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [selectedCouponId, setSelectedCouponId] = useState('')
  const [orderDetail, setOrderDetail] = useState<OrderInfo>({})
  const [remaining, setRemaining] = useState(COUNTDOWN_TOTAL)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const expired = remaining <= 0
  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId)
  const couponDiscount = selectedCoupon?.amount ?? 0
  const finalAmount = Math.max(0, amount - couponDiscount)
  // G-933 冷启动门控用就绪位（见下方 effect 内的 return 说明）
  const { ready } = useAuthReadyGate()

  useEffect(() => {
    const no = router.params.orderNo || ''
    const amt = Number(router.params.amount) || 0
    setOrderNo(no)
    setAmount(amt)
    if (!no) return
    // G-933:未落定时整支不出门,ready 翻真后本 effect 重跑一次(waitUntilReady 语义等价:
    // 只等「判定落定」,不等登录 ⇒ 游客仍会在落定后走一次,终态与改前一致)。
    if (!ready) return

    Promise.all([
      get<{ order: OrderInfo }>(`/orders/${no}`).catch(() => null),
      get<{ items: CouponItem[] } | CouponItem[]>('/coupons/available', { amount: amt }).catch(
        () => null,
      ),
    ]).then(([detail, couponRes]) => {
      if (detail?.order) setOrderDetail(detail.order)
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
  }, [router.params.orderNo, router.params.amount, ready])

  const onSelectMethod = (m: PayMethod) => {
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
      if (payMethod === 'alipay') {
        const res = await createAlipayMiniappPayment({
          amount: finalAmount,
          subject: orderDetail.targetTitle || tt('pay.vipSubscription', '会员订阅'),
        })
        if (!res.tradeNo) {
          Taro.showToast({ title: tt('pay.configNotReady', '支付宝支付配置未就绪'), icon: 'none' })
          return
        }
        try {
          await requestAliPayment({ tradeNO: res.tradeNo } as AnyPayParams)
          Taro.redirectTo({
            url: `/pkg-shop/pay/result/index?orderNo=${res.outTradeNo}&status=paid`,
          })
        } catch {
          Taro.redirectTo({
            url: `/pkg-shop/pay/result/index?orderNo=${res.outTradeNo}&status=failed`,
          })
        }
        return
      }
      const res = await getVipOrderPayInfo(orderNo)
      if (res.status === 'paid') {
        Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=paid` })
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
        .then(() =>
          Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${no}&status=paid` }),
        )
        .catch(() =>
          Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${no}&status=failed` }),
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
    Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${no}` })
  }

  const payDisabled = submitting || expired

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
              {orderDetail.targetTitle || tt('pay.vipSubscription', '会员订阅')}
            </Text>
          </View>
          <View className="py-order-row">
            <Text className="py-order-label">{tt('pay.createTime', '下单时间')}</Text>
            <Text className="py-order-value">{orderDetail.createdAt || '—'}</Text>
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
                <LineIcon name="check" size={24} color="var(--color-cta-foreground)" />
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
                <LineIcon name="check" size={24} color="var(--color-cta-foreground)" />
              )}
            </View>
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
            <LineIcon
              name="chevron-right"
              size={24}
              color="var(--color-muted-foreground)"
              className="py-coupon-arrow"
            />
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
