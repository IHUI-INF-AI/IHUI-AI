// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 apps/mobile-rn PayResultScreen 状态机与信息结构(端内重写渲染层,
// Taro 无法直接渲染 RN 原语);收敛 miniapp 端支付/充值/VIP 三处结果呈现到统一页
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTt } from '@/i18n'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import { getPayResult } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

/** 支付结果三态(对齐 RN PayStatus / 旧 miniapp result.tsx) */
type PayStatus = 'pending' | 'paid' | 'failed'

/** 轮询间隔与上限(对齐 RN PayResultScreen:setInterval 2s × 30 次) */
const POLL_INTERVAL_MS = 2000
const MAX_POLL_COUNT = 30

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// ===== 样式函数(view/text 分组,避免 style 联合类型;对齐共享屏 createStyles) =====

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: tk.surface.bg,
  }),
  body: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: toRpx(120),
    paddingBottom: toRpx(120),
  }),
  statusBadge: (bg: string): CSSProperties => ({
    width: toRpx(160),
    height: toRpx(160),
    borderRadius: toRpx(24),
    backgroundColor: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  orderRow: (): CSSProperties => ({
    marginTop: toRpx(24),
    paddingLeft: toRpx(60),
    paddingRight: toRpx(60),
  }),
  actions: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    rowGap: toRpx(32),
    paddingLeft: toRpx(60),
    paddingRight: toRpx(60),
  }),
  primaryBtn: (tk: RnThemeTokens): CSSProperties => ({
    height: toRpx(88),
    borderRadius: toRpx(16),
    backgroundColor: tk.brand.DEFAULT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  secondaryBtn: (tk: RnThemeTokens): CSSProperties => ({
    height: toRpx(88),
    borderRadius: toRpx(16),
    backgroundColor: tk.surface.card,
    borderWidth: toRpx(1),
    borderStyle: 'solid',
    borderColor: tk.border.light,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
}

const textStyles = {
  badgeGlyph: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(80),
    lineHeight: toRpx(88),
    color: tk.surface.light,
    fontWeight: '600',
  }),
  statusText: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(32),
    fontSize: toRpx(18),
    fontWeight: '600',
    color: tk.text.primary,
  }),
  amountText: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(16),
    fontSize: toRpx(20),
    fontWeight: '600',
    color: tk.danger.DEFAULT,
  }),
  orderNo: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(13),
    color: tk.text.secondary,
    textAlign: 'center',
  }),
  primaryText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(15),
    fontWeight: '600',
    color: tk.surface.light,
  }),
  secondaryText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(15),
    color: tk.text.primary,
  }),
}

export default function PayResult() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)

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

  const statusBg: Record<PayStatus, string> = {
    pending: tk.warning.amber,
    paid: tk.success.DEFAULT,
    failed: tk.danger.DEFAULT,
  }
  const statusKey: Record<PayStatus, [string, string]> = {
    pending: ['pay.result.pending', '支付处理中'],
    paid: ['pay.result.paid', '支付成功'],
    failed: ['pay.result.failed', '支付失败'],
  }
  const statusGlyph: Record<PayStatus, string> = {
    pending: '…',
    paid: '✓',
    failed: '×',
  }

  return (
    <ThemeRoot>
      <View style={viewStyles.container(tk)}>
        <View style={viewStyles.body()}>
          <View style={viewStyles.statusBadge(statusBg[status])}>
            <Text style={textStyles.badgeGlyph(tk)}>{statusGlyph[status]}</Text>
          </View>
          <Text style={textStyles.statusText(tk)}>{tt(statusKey[status][0], statusKey[status][1])}</Text>
          {amount > 0 && <Text style={textStyles.amountText(tk)}>¥{amount.toFixed(2)}</Text>}
          {orderNo ? (
            <View style={viewStyles.orderRow()}>
              <Text style={textStyles.orderNo(tk)}>
                {`${tt('pay.orderNo', '订单号')}：${orderNo}`}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={viewStyles.actions()}>
          {status !== 'pending' ? (
            <>
              <View style={viewStyles.primaryBtn(tk)} onTap={goBack}>
                <Text style={textStyles.primaryText(tk)}>{tt('pay.backHome', '返回首页')}</Text>
              </View>
              <View style={viewStyles.secondaryBtn(tk)} onTap={goOrders}>
                <Text style={textStyles.secondaryText(tk)}>{tt('pay.viewOrders', '查看订单')}</Text>
              </View>
            </>
          ) : (
            <View style={viewStyles.primaryBtn(tk)} onTap={() => void check()}>
              <Text style={textStyles.primaryText(tk)}>{tt('pay.refresh', '刷新状态')}</Text>
            </View>
          )}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
