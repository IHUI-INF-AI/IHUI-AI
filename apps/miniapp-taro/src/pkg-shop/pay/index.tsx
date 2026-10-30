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
  getWalletBalance,
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

/** GET /orders/:orderNo 回 success({ order })，order 即 orders 原始行；金额字段单位是**分**。 */
interface OrderRow {
  status?: string
  amount?: number
  targetTitle?: string | null
  createdAt?: string
  expiresAt?: string | null
}

/** 支付窗口：订单没有落 expires_at 时按"下单后 15 分钟"算（与页面文案一致）。 */
const COUNTDOWN_TOTAL = 15 * 60
const COUNTDOWN_WINDOW_MS = COUNTDOWN_TOTAL * 1000
const priceFmt = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * 金额显示：本页内部一律用**分**运算（orders.amount、券折扣都是分），只有显示时折成元。
 * 改前把分当元直接 format，订单入口（order.amount=3990）会显示成 ¥3,990.00。
 */
const yuan = (fen: number): string => priceFmt.format(fen / 100)

/** ISO 时间 → 「YYYY-MM-DD HH:mm」，取设备本地时区；无值或非法返回空串（调用方渲染 '—'）。 */
function fmtDateTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * 支付截止时刻（毫秒）。优先订单真实 expiresAt，其次 createdAt + 支付窗口；
 * 都取不到（详情还没回来 / 该单不在 orders 表里）才退回"现在 + 窗口"，保证倒计时不会静止。
 */
function resolveDeadline(order?: OrderRow): number {
  const exp = order?.expiresAt ? Date.parse(order.expiresAt) : NaN
  if (Number.isFinite(exp)) return exp
  const created = order?.createdAt ? Date.parse(order.createdAt) : NaN
  if (Number.isFinite(created)) return created + COUNTDOWN_WINDOW_MS
  return Date.now() + COUNTDOWN_WINDOW_MS
}

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
  // 截止时刻（毫秒）。倒计时每秒按它重算，而不是"进页面就从 15:00 往下减"——
  // 后者对一张 10 分钟前下的单同样从 15:00 开始，等于把已过的时间还回去。
  const deadlineRef = useRef<number | null>(null)

  const expired = remaining <= 0
  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId)
  const couponDiscount = selectedCoupon?.amount ?? 0
  const finalAmount = Math.max(0, amount - couponDiscount)
  const balanceInsufficient = balance < finalAmount
  // G-933 冷启动门控用就绪位（见下方 effect 内的 return 说明）
  const { ready } = useAuthReadyGate()

  useEffect(() => {
    const no = router.params.orderNo || ''
    const amt = Number(router.params.amount) || 0
    setOrderNo(no)
    // 入口传参单位不统一（订单行是分、课程购买返回的是元），先按分记着，
    // 详情一到就以服务端 orders.amount（分）覆盖 —— 显示与支付都以它为准。
    setAmount(amt)
    if (!no) return
    // G-933：这一支的余额查询需鉴权（miniapp-compat-routes.ts:2247 checkAuth 同一鉴权面），
    // 与 /orders/:no、/coupons/available 三支共用同一个 Promise.all 与同一次状态事务，
    // 拆支会改该页的加载/回填语义 ⇒ 未落定时整支不出门，ready 翻真后本 effect 重跑一次。
    // waitUntilReady 语义等价：只等「判定落定」，不等登录 ⇒ 游客仍会在落定后走一次，终态与改前一致。
    if (!ready) return

    // 先按"进页面起算"兜底，详情回来后再用订单真实时间覆盖（避免详情前倒计时静止）
    deadlineRef.current = Date.now() + COUNTDOWN_WINDOW_MS
    setRemaining(COUNTDOWN_TOTAL)

    Promise.all([
      // 余额：原实现读 `getProfile().balance`，而 GET /user/profile 根本不返回该字段
      // ⇒ balance 恒 0、余额支付永远被判"余额不足"。改走真正的钱包余额端点（单位：元）。
      getWalletBalance().catch(() => null),
      // 订单详情：原路径 `/vip/order/:no` 后端不存在（只有 `/vip/order/:no/payinfo`）
      // ⇒ 商品名、下单时间永远为空，倒计时也拿不到真实时间。改用通用订单详情（仅本人或管理员可读）。
      get<{ order: OrderRow }>(`/orders/${no}`).catch(() => null),
      get<{ items: CouponItem[] } | CouponItem[]>('/coupons/available', { amount: amt }).catch(
        () => null,
      ),
    ]).then(([wallet, orderRes, couponRes]) => {
      // 钱包余额 getBalance → user_margins.token_quantity，单位就是**分**
      // （充值回调 rechargeToken(order.amount) 落的是订单分金额、赠送按分入账，
      //  见 services/order-service.ts 的 rechargeIfTokenOrder / creditTopupBonus），
      // 与本页订单金额同尺度，直接比较，不要再乘 100。
      if (wallet && typeof wallet.balance === 'number') {
        setBalance(wallet.balance)
      }
      const order = orderRes?.order
      if (order) {
        if (typeof order.amount === 'number' && order.amount > 0) setAmount(order.amount)
        setOrderDetail({
          goodsName: order.targetTitle ?? undefined,
          createTime: fmtDateTime(order.createdAt),
        })
      }
      if (couponRes) {
        const list = Array.isArray(couponRes) ? couponRes : couponRes.items || []
        setCoupons(list)
      }
      deadlineRef.current = resolveDeadline(order)
      setRemaining(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)))
    })

    timerRef.current = setInterval(() => {
      const deadline = deadlineRef.current
      // 截止时刻还没定（详情未到）就保持初值，别把"还没取到"显示成已超时
      if (deadline === null) return
      setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [router.params.orderNo, router.params.amount, ready])

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
      ...coupons.map((c) => ({ name: `${c.title} (-¥${yuan(c.amount)})`, id: c.id })),
    ]
    Taro.showActionSheet({
      itemList: items.map((i) => i.name),
      success: (res) => setSelectedCouponId(items[res.tapIndex]?.id ?? ''),
    })
  }

  const goRecharge = () => Taro.navigateTo({ url: '/pkg-shop/wallet/recharge/index' })

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
        Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=paid` })
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
      await dispatchPay(res.payInfo, orderNo)
    } catch {
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  async function dispatchPay(payInfo: VipPayInfo, no: string) {
    if (
      payInfo.method === 'jsapi' &&
      payInfo.timeStamp &&
      payInfo.nonceStr &&
      payInfo.package &&
      payInfo.signType &&
      payInfo.paySign
    ) {
      // 必须等微信收银台回来再复位 submitting:原实现 fire-and-forget,
      // onPay 的 finally 在支付弹窗还开着时就把按钮放回去 ⇒ 连点会重复拉起支付。
      await requestWxPayment(payInfo as AnyPayParams)
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

  // 无单号必须一起禁用:从某些入口(如学习页的支付弹窗)进来时没有 orderNo,
  // 原实现按钮照常可点,用户点下去才得到一句"订单异常",且页面照常渲染金额与订单卡片。
  const payDisabled =
    submitting || expired || !orderNo || (payMethod === 'balance' && balanceInsufficient)

  const methodBase = 'py-method'
  const methodActive = 'py-method--active'
  const radioBase = 'py-radio'
  const radioOn = 'py-radio--on'

  return (
    <ThemeRoot>
      <View className="py-page">
        <View className={`py-countdown${expired ? ' py-countdown--expired' : ''}`}>
          <Text className="py-countdown-text">
            {!orderNo
              ? tt('pay.orderAbnormal', '订单异常')
              : expired
                ? tt('pay.orderExpired', '订单已超时')
                : t('pay.countdownTip', { time: formatTime(remaining) })}
          </Text>
        </View>

        <View className="py-amount-card">
          <Text className="py-amount-label">{t('pay.orderAmount')}</Text>
          <Text className="py-amount-value">¥{yuan(finalAmount)}</Text>
          {couponDiscount > 0 && (
            <Text className="py-amount-discount">
              {t('pay.couponSaved', { n: yuan(couponDiscount) })}
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
                {t('pay.balanceAmount', { n: yuan(balance) })}
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
                  <LineIcon name="check" size={24} color="var(--color-cta-foreground)" />
                )}
              </View>
            )}
          </View>
        </View>

        <View className="py-coupon-card" hoverClass="opacity-60" onClick={onSelectCoupon}>
          <Text className="py-coupon-label">{tt('pay.coupon', '优惠券')}</Text>
          <View className="py-coupon-right">
            {selectedCoupon ? (
              <Text className="py-coupon-value">-¥{yuan(selectedCoupon.amount)}</Text>
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
            : `${t('pay.confirm')} ¥${yuan(finalAmount)}`}
        </Button>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
