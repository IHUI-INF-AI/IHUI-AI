import { useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getRnTokens, type RnThemeTokens, type RnThemeMode } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'
import { useTt } from '@/i18n'
import freeVipIcon from '@/assets/remote/images/xtk/free_vip_icon.png'
import freeUseIcon from '@/assets/remote/images/xtk/free_use_icon.png'
import freeTimeIcon from '@/assets/remote/images/xtk/free_time_icon.png'
import buymonthIcon from '@/assets/remote/images/xtk/buymonth_icon.png'
import hasbuyIcon from '@/assets/remote/images/xtk/hasbuy_icon.png'
import agentAvatarFallbackIcon from '@/assets/remote/images/agent-avatar.png'

/**
 * Taro 适配层:PayButton
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text/Image + @tarojs/taro 的 showToast,
 * 不适合共享层。
 *
 * 复用 packages/app/src/components/PayButton 的 props 契约 + 5 种 type 配置,
 * 替换 web 元素 + 事件 + 弹窗改用 View 自绘 + onTap 触发关闭。
 * Toast 通过 `onShowToast` 注入,默认 fallback 调 `Taro.showToast`。
 */
export type PayButtonType = 'freevip' | '1' | '2' | '3' | '4'

export interface PayButtonProps {
  type: PayButtonType
  /** Agent/商品 ID(传给 onClick) */
  agentId?: string
  /** Agent/商品名称(显示在购买弹窗) */
  agentName?: string
  /** Agent 头像(显示在购买弹窗) */
  agentAvatar?: string
  /** 是否禁用 */
  disabled?: boolean
  onClick?: (type: PayButtonType, agentId?: string) => void
  /** 已解析主题,默认 'light' */
  colorScheme?: RnThemeMode
  /** i18n 翻译函数(可选) */
  t?: TFunction
  /** Toast 回调(原 Taro.showToast 等价);未传则调 Taro.showToast */
  onShowToast?: (message: string) => void
}

interface TypeConfig {
  /** 按钮背景色(token 解析后) */
  bg: (tk: RnThemeTokens) => string
  /** 按钮文字颜色 */
  text: (tk: RnThemeTokens) => string
  /** 图标 emoji */
  icon: string
  /** 按钮文字(fallback) */
  label: string
  /** 是否显示购买弹窗 */
  showPurchasePopup: boolean
}

const TYPE_CONFIG: Record<PayButtonType, TypeConfig> = {
  freevip: {
    bg: (tk) => tk.warning.light,
    text: (tk) => tk.warning.deep,
    icon: freeVipIcon,
    label: '会员免费',
    showPurchasePopup: false,
  },
  '1': {
    bg: (tk) => tk.indigo.light,
    text: (tk) => tk.indigo.DEFAULT,
    icon: freeUseIcon,
    label: '免费使用',
    showPurchasePopup: false,
  },
  '2': {
    bg: (tk) => tk.danger.light,
    text: (tk) => tk.danger.DEFAULT,
    icon: freeTimeIcon,
    label: '限时免费',
    showPurchasePopup: false,
  },
  '3': {
    bg: (tk) => tk.brand.DEFAULT,
    text: (tk) => tk.surface.light,
    icon: buymonthIcon,
    label: '每月',
    showPurchasePopup: true,
  },
  '4': {
    bg: (tk) => tk.gray[100],
    text: (tk) => tk.gray[500],
    icon: hasbuyIcon,
    label: '已购买',
    showPurchasePopup: false,
  },
}

// ===== 样式函数(view/text/image 分组,避免 style 联合类型) =====

const toRpx = (px: number): string => `${px * 2}rpx`

const viewStyles = {
  root: (): CSSProperties => ({ position: 'relative', display: 'inline-block' }),
  trigger: (bg: string, text: string, disabled: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
    paddingTop: toRpx(6),
    paddingBottom: toRpx(6),
    borderRadius: toRpx(6),
    backgroundColor: bg,
    color: text,
    opacity: disabled ? 0.5 : 1,
    fontSize: toRpx(12),
    fontWeight: 500,
  }),
  modal: (tk: RnThemeTokens): CSSProperties => ({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tk.overlay.modal,
  }),
  dialog: (tk: RnThemeTokens): CSSProperties => ({
    backgroundColor: tk.surface.light,
    borderRadius: toRpx(12),
    marginLeft: toRpx(24),
    marginRight: toRpx(24),
    width: '100%',
    maxWidth: toRpx(360),
    padding: toRpx(16),
  }),
  productRow: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    marginBottom: toRpx(12),
  }),
  avatarFallback: (tk: RnThemeTokens): CSSProperties => ({
    width: toRpx(42),
    height: toRpx(42),
    borderRadius: toRpx(8),
    marginRight: toRpx(12),
    backgroundColor: tk.gray[200],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: toRpx(20),
  }),
  productText: (): CSSProperties => ({ flex: 1, minWidth: 0 }),
  countRow: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    marginBottom: toRpx(12),
  }),
  countBtn: (tk: RnThemeTokens, disabled: boolean): CSSProperties => ({
    width: toRpx(28),
    height: toRpx(28),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: toRpx(6),
    border: `1px solid ${tk.border.light}`,
    opacity: disabled ? 0.5 : 1,
    backgroundColor: tk.surface.light,
    color: tk.text.primary,
  }),
  payBtn: (tk: RnThemeTokens): CSSProperties => ({
    width: '100%',
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    borderRadius: toRpx(6),
    textAlign: 'center',
    backgroundColor: tk.brand.DEFAULT,
    color: tk.surface.light,
    fontWeight: 500,
  }),
  closeBtn: (): CSSProperties => ({
    position: 'absolute',
    top: toRpx(8),
    right: toRpx(12),
  }),
  priceLine: (): CSSProperties => ({ marginBottom: toRpx(8) }),
}

const textStyles = {
  icon: (): CSSProperties => ({ marginRight: toRpx(4), fontSize: toRpx(12) }),
  label: (): CSSProperties => ({ fontSize: toRpx(12) }),
  productName: (tk: RnThemeTokens): CSSProperties => ({
    display: 'block',
    fontSize: toRpx(14),
    fontWeight: 500,
    color: tk.text.primary,
  }),
  productTip: (tk: RnThemeTokens): CSSProperties => ({
    display: 'block',
    fontSize: toRpx(12),
    color: tk.text.secondary,
  }),
  priceLabel: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.text.secondary,
  }),
  countLabel: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.text.secondary,
    marginRight: toRpx(8),
  }),
  countValue: (): CSSProperties => ({
    marginLeft: toRpx(12),
    marginRight: toRpx(12),
    fontSize: toRpx(14),
  }),
  payBtnText: (): CSSProperties => ({ fontSize: toRpx(14) }),
  closeBtn: (): CSSProperties => ({ fontSize: toRpx(18), color: '#999' }),
  defaultName: (): string => 'AI 助手',
  subscribeTip: (): string => '订阅后可无限使用',
  priceLabelFallback: (): string => '价格',
  perMonth: (): string => '月',
  countLabelFallback: (): string => '数量',
  payNow: (): string => '立即支付',
  payDisabledToast: (): string => '支付功能待接入后端',
}

const imageStyles = {
  avatar: (): CSSProperties => ({
    width: toRpx(42),
    height: toRpx(42),
    borderRadius: toRpx(8),
    marginRight: toRpx(12),
  }),
}

// ===== 主组件 =====

const DEFAULT_PRICE = 0.01

export function PayButton({
  type,
  agentId,
  agentName = '',
  agentAvatar = '',
  disabled = false,
  onClick,
  colorScheme = 'light',
  t: tProp,
  onShowToast,
}: PayButtonProps) {
  const tk = getRnTokens(colorScheme)
  const tt = useTt()
  const [popupVisible, setPopupVisible] = useState(false)
  const [count, setCount] = useState(1)
  // 默认单价 0.01 元(1 分),实际由后端 getChargeInfoById 返回
  const price = DEFAULT_PRICE

  const cfg = TYPE_CONFIG[type]
  const showToast = useCallback(
    (msg: string) => {
      if (onShowToast) onShowToast(msg)
      else Taro.showToast({ title: msg, icon: 'none' })
    },
    [onShowToast],
  )

  const handleClick = () => {
    if (disabled) return
    if (cfg.showPurchasePopup) {
      setPopupVisible(true)
      return
    }
    onClick?.(type, agentId)
  }

  const handlePay = () => {
    showToast(textStyles.payDisabledToast())
    setPopupVisible(false)
    onClick?.(type, agentId)
  }

  const handleModalTap = (e: { stopPropagation: () => void }) => {
    // Taro 端 e.target 等价于 react-native 的 event,这里靠 stopPropagation 区分
    e.stopPropagation()
  }

  const realPrice = (price * count).toFixed(2)

  // i18n fallback helper: prop t > I18nContext tt > 硬编码中文
  const tFn: TFunction | undefined =
    tProp ??
    ((key, options) => {
      const v = tt(key, key, options as Record<string, string | number> | undefined)
      return v
    })
  const tr = (key: string, fallback: string): string => (tFn ? tFn(key) : fallback)
  const productName = agentName || tr('pay.defaultName', textStyles.defaultName())
  const productTip = tr('pay.subscribeTip', textStyles.subscribeTip())
  const priceLabelText = tr('pay.priceLabel', textStyles.priceLabelFallback())
  const perMonthText = tr('pay.perMonth', textStyles.perMonth())
  const countLabelText = tr('pay.countLabel', textStyles.countLabelFallback())
  const payNowText = tr('pay.payNow', textStyles.payNow())

  return (
    <View style={viewStyles.root()}>
      <View style={viewStyles.trigger(cfg.bg(tk), cfg.text(tk), disabled)} onTap={handleClick}>
        <Image src={cfg.icon} style={{ width: toRpx(12), height: toRpx(12), marginRight: toRpx(4) }} mode="aspectFit" />
        <Text style={textStyles.label()}>{cfg.label}</Text>
      </View>

      {popupVisible ? (
        <View style={viewStyles.modal(tk)} onTap={() => setPopupVisible(false)}>
          <View style={viewStyles.dialog(tk)} onTap={handleModalTap}>
            {/* 关闭按钮 */}
            <View style={viewStyles.closeBtn()} onTap={() => setPopupVisible(false)}>
              <Text style={textStyles.closeBtn()}>×</Text>
            </View>
            {/* 商品信息 */}
            <View style={viewStyles.productRow()}>
              {agentAvatar ? (
                <Image src={agentAvatar} style={imageStyles.avatar()} mode="aspectFill" />
              ) : (
                <View style={viewStyles.avatarFallback(tk)}>
                  <Image src={agentAvatarFallbackIcon} style={{ width: toRpx(20), height: toRpx(20) }} mode="aspectFit" />
                </View>
              )}
              <View style={viewStyles.productText()}>
                <Text style={textStyles.productName(tk)}>{productName}</Text>
                <Text style={textStyles.productTip(tk)}>{productTip}</Text>
              </View>
            </View>
            {/* 价格 */}
            <View style={viewStyles.priceLine()}>
              <Text style={textStyles.priceLabel(tk)}>
                {priceLabelText}: ¥{price} / {perMonthText}
              </Text>
            </View>
            {/* 数量 */}
            <View style={viewStyles.countRow()}>
              <Text style={textStyles.countLabel(tk)}>{countLabelText}:</Text>
              <View
                style={viewStyles.countBtn(tk, count <= 1)}
                onTap={() => count > 1 && setCount(count - 1)}
              >
                <Text>−</Text>
              </View>
              <Text style={textStyles.countValue()}>{count}</Text>
              <View style={viewStyles.countBtn(tk, false)} onTap={() => setCount(count + 1)}>
                <Text>+</Text>
              </View>
            </View>
            {/* 立即支付按钮 */}
            <View style={viewStyles.payBtn(tk)} onTap={handlePay}>
              <Text style={textStyles.payBtnText()}>
                {payNowText} ¥{realPrice}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
