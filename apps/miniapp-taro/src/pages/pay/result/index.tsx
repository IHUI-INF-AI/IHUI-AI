// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 apps/mobile-rn PayResultScreen 状态机与信息结构(端内重写渲染层,
// Taro 无法直接渲染 RN 原语);收敛 miniapp 端支付/充值/VIP 三处结果呈现到统一页
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTt } from '@/i18n'
import { getPayResult } from '@/api'
import LineIcon, { type IconName } from '@/components/LineIcon'
import ThemeRoot from '@/components/ThemeRoot'

/** 支付结果三态(对齐 RN PayStatus / 旧 miniapp result.tsx) */
type PayStatus = 'pending' | 'paid' | 'failed'

/** 轮询间隔与上限(对齐 RN PayResultScreen:setInterval 2s × 30 次) */
const POLL_INTERVAL_MS = 2000
const MAX_POLL_COUNT = 30

// ===== 样式对齐 RN PayResultScreen(StyleSheet 原值换算:rpx(N)→N rpx,raw dp M→M*2 rpx) =====

/** 状态标底色:pending=warning.amber / paid=success / failed=danger(随明暗语义 token) */
const statusBgClass: Record<PayStatus, string> = {
  pending: 'bg-[color:var(--color-warning-amber)]',
  paid: 'bg-[color:var(--color-success)]',
  failed: 'bg-[color:var(--color-danger)]',
}

/** 状态图标:对齐 RN lucide Check/X/Clock size rpx(80)→80rpx + surface.light */
const statusGlyph: Record<PayStatus, IconName> = {
  pending: 'clock',
  paid: 'check',
  failed: 'x',
}

export default function PayResult() {
  const tt = useTt()

  // 路由参数:orderNo(必带)+ status/amount/from(调用方预置初始态,可选)
  const params = Taro.getCurrentInstance().router?.params ?? {}
  const orderNo = params.orderNo ?? ''
  const initialStatus: PayStatus =
    params.status === 'paid' || params.status === 'failed' ? params.status : 'pending'
  const initialAmount = Number(params.amount ?? '') || 0
  const fromUrl = params.from ? decodeURIComponent(params.from) : ''

  const [status, setStatus] = useState<PayStatus>(initialStatus)
  const [amount, setAmount] = useState(initialAmount)
  const orderNoRef = useRef(orderNo)
  const statusRef = useRef<PayStatus>(initialStatus)

  const check = useCallback(async (): Promise<PayStatus> => {
    if (!orderNoRef.current) return statusRef.current
    try {
      const res = await getPayResult(orderNoRef.current)
      // 状态映射对齐 getPayResult:仅 paid/pending 有意义,其余(cancelled/refunded/failed)→ failed
      const next: PayStatus =
        res.status === 'paid' ? 'paid' : res.status === 'pending' ? 'pending' : 'failed'
      statusRef.current = next
      setStatus(next)
      setAmount(res.amount ?? 0)
      return next
    } catch {
      return statusRef.current
    }
  }, [])

  useEffect(() => {
    orderNoRef.current = orderNo
    statusRef.current = initialStatus
    // 无 orderNo 或调用方已预置终态:不轮询,由用户手动刷新/返回(对齐 RN)
    if (!orderNo || initialStatus !== 'pending') return
    let count = 0
    let intervalId: ReturnType<typeof setInterval> | null = null
    const stop = () => {
      if (intervalId) clearInterval(intervalId)
      intervalId = null
    }
    const tick = async () => {
      count += 1
      const result = await check()
      if (result !== 'pending' || count >= MAX_POLL_COUNT) stop()
    }
    void tick()
    intervalId = setInterval(() => void tick(), POLL_INTERVAL_MS)
    return stop
  }, [orderNo, initialStatus, check])

  const goBack = () => {
    // 优先回到来源页(from 参数);无来源时回落 navigateTo 栈,最终回首页
    if (fromUrl) {
      Taro.redirectTo({ url: fromUrl }).catch(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      })
      return
    }
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }

  const goOrders = () => {
    Taro.navigateTo({ url: '/pages/order/list' })
  }

  const statusKey: Record<PayStatus, [string, string]> = {
    pending: ['pay.result.pending', '支付处理中'],
    paid: ['pay.result.paid', '支付成功'],
    failed: ['pay.result.failed', '支付失败'],
  }

  return (
    <ThemeRoot>
      {/* 根容器背景对齐 RN PayResultScreen container(surface.bg → --color-background) */}
      <View className="flex min-h-screen flex-col bg-background">
        {/* body 对齐 RN: alignItems center + paddingVertical rpx(120)→120rpx */}
        <View className="flex flex-col items-center pt-[120rpx] pb-[120rpx]">
          {/* 状态标对齐 RN statusIcon: 160×160rpx + 圆角 rpx(24)→24rpx;
              pending=warning.amber / paid=success / failed=danger(语义 token 随明暗) */}
          <View
            className={`flex h-[160rpx] w-[160rpx] items-center justify-center rounded-[24rpx] ${statusBgClass[status]}`}
          >
            <LineIcon name={statusGlyph[status]} size={80} color="var(--color-surface-light)" />
          </View>
          {/* statusText 对齐 RN: mt rpx(32)→32rpx + fontSize 18dp→36rpx semibold + text.primary→foreground */}
          <Text className="mt-[32rpx] text-[36rpx] font-semibold text-foreground">
            {tt(statusKey[status][0], statusKey[status][1])}
          </Text>
          {/* amountText 对齐 RN: mt rpx(16)→16rpx + fontSize 20dp→40rpx semibold + danger.DEFAULT→--color-danger */}
          {amount > 0 && (
            <Text className="mt-[16rpx] text-[40rpx] font-semibold text-[color:var(--color-danger)]">
              ¥{amount.toFixed(2)}
            </Text>
          )}
          {orderNo ? (
            <View className="mt-[24rpx] px-[60rpx]">
              {/* 订单号为小程序端补充信息(RN 无此行):13dp→26rpx + text.secondary→muted-foreground */}
              <Text className="text-center text-[26rpx] text-muted-foreground">
                {`${tt('pay.orderNo', '订单号')}：${orderNo}`}
              </Text>
            </View>
          ) : null}
        </View>
        {/* actions 对齐 RN: paddingHorizontal rpx(60)→60rpx + gap rpx(32)→32rpx */}
        <View className="flex flex-col gap-[32rpx] px-[60rpx]">
          {status !== 'pending' ? (
            <>
              {/* primaryBtn 对齐 RN: 高 rpx(88)→88rpx + 圆角 rpx(16)→16rpx + brand.DEFAULT→--color-primary;
                  文字 15dp→30rpx semibold,色用 --color-primary-foreground 修正 RN surface.light
                  在暗色纯白 brand 底上不可读的问题(亮色仍是白字黑底,与 RN 一致) */}
              <View
                className="flex h-[88rpx] items-center justify-center rounded-[16rpx] bg-primary"
                hoverClass="opacity-85"
                onTap={goBack}
              >
                <Text className="text-[30rpx] font-semibold text-[color:var(--color-primary-foreground)]">
                  {tt('pay.backHome', '返回首页')}
                </Text>
              </View>
              {/* secondaryBtn 对齐 RN: 高/圆角同 primaryBtn + surface.card→--color-card
                  (RN 无描边,移除小程序原 border.border.light) */}
              <View
                className="flex h-[88rpx] items-center justify-center rounded-[16rpx] bg-card"
                hoverClass="opacity-85"
                onTap={goOrders}
              >
                <Text className="text-[30rpx] text-foreground">{tt('pay.viewOrders', '查看订单')}</Text>
              </View>
            </>
          ) : (
            <View
              className="flex h-[88rpx] items-center justify-center rounded-[16rpx] bg-primary"
              hoverClass="opacity-85"
              onTap={() => void check()}
            >
              <Text className="text-[30rpx] font-semibold text-[color:var(--color-primary-foreground)]">
                {tt('pay.refresh', '刷新状态')}
              </Text>
            </View>
          )}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
