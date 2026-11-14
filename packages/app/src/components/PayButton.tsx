// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState, useCallback } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { getTokens, type AppThemeTokens, type AppThemeMode } from '../theme/tokens'
import type { TFunction, AppIcon } from '@ihui/types'
import { Crown, Gift, Clock, CreditCard, Check, X, Minus, Plus, Bot } from 'lucide-react'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

/**
 * 支付按钮 — 跨端共享层。
 *
 * 5 种 type 变体(对齐原项目 pay_btn.vue):
 * - 'freevip' = 会员免费
 * - '1' = 免费使用
 * - '2' = 限时免费
 * - '3' = 每月付费(点击触发购买弹窗)
 * - '4' = 已购买
 *
 * 平台无关:
 * - 不依赖 @tarojs/* 或 react-native
 * - i18n 通过 `t: TFunction` 注入,fallback 硬编码中文
 * - Toast 通过 `onShowToast` 回调注入(原 Taro.showToast 等价)
 * - 弹窗关闭通过 `onClick` + 背景蒙层点击
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
  colorScheme?: AppThemeMode
  /** i18n 翻译函数(可选) */
  t?: TFunction
  /** Toast 回调(原 Taro.showToast 等价);未传则在控制台输出 */
  onShowToast?: (message: string) => void
  /** 动态价格获取函数(传入 agentId 返回价格);不传则用 DEFAULT_PRICE */
  onFetchPrice?: (agentId: string) => Promise<number>
}

interface TypeConfig {
  /** 按钮背景色(token 解析后) */
  bg: (tk: AppThemeTokens) => string
  /** 按钮文字颜色 */
  text: (tk: AppThemeTokens) => string
  /** 图标 lucide 组件 */
  icon: AppIcon
  /** 按钮文字(fallback) */
  label: string
  /** 是否显示购买弹窗 */
  showPurchasePopup: boolean
}

const TYPE_CONFIG: Record<PayButtonType, TypeConfig> = {
  freevip: {
    bg: (tk) => tk.warning.light,
    text: (tk) => tk.brandAccent.deep,
    icon: Crown,
    label: '会员免费',
    showPurchasePopup: false,
  },
  '1': {
    bg: (tk) => tk.surface.muted,
    text: (tk) => tk.text.primary,
    icon: Gift,
    label: '免费使用',
    showPurchasePopup: false,
  },
  '2': {
    bg: (tk) => tk.danger.light,
    text: (tk) => tk.danger.DEFAULT,
    icon: Clock,
    label: '限时免费',
    showPurchasePopup: false,
  },
  '3': {
    bg: (tk) => tk.brand.cta,
    text: (tk) => tk.brand.ctaForeground,
    icon: CreditCard,
    label: '每月',
    showPurchasePopup: true,
  },
  '4': {
    bg: (tk) => tk.surface.muted,
    text: (tk) => tk.gray[500],
    icon: Check,
    label: '已购买',
    showPurchasePopup: false,
  },
}

// ===== 样式函数(避免 style 联合类型,view/text/image 分组) =====

const viewStyles = {
  root: (): CSSProperties => ({ position: 'relative', display: 'inline-block' }),
  trigger: (bg: string, text: string, disabled: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: rnSpacing.md,
    paddingRight: rnSpacing.md,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: rnRadius.xl,
    backgroundColor: bg,
    color: text,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: rnType.label.size,
    fontWeight: 500,
    border: 'none',
  }),
  modal: (tk: AppThemeTokens): CSSProperties => ({
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tk.overlay.modal,
  }),
  dialog: (tk: AppThemeTokens): CSSProperties => ({
    backgroundColor: tk.surface.light,
    borderRadius: rnRadius.xl,
    marginLeft: rnSpacing['2xl'],
    marginRight: rnSpacing['2xl'],
    width: '100%',
    maxWidth: 360,
    padding: rnSpacing.lg,
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  }),
  productRow: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    marginBottom: rnSpacing.md,
  }),
  avatarFallback: (tk: AppThemeTokens): CSSProperties => ({
    width: 42,
    height: 42,
    borderRadius: rnRadius.xl,
    marginRight: rnSpacing.md,
    backgroundColor: tk.gray[200],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: rnType.heading.size,
  }),
  productText: (): CSSProperties => ({ flex: 1, minWidth: 0 }),
  countRow: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    marginBottom: rnSpacing.md,
  }),
  countBtn: (tk: AppThemeTokens, disabled: boolean): CSSProperties => ({
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rnRadius.sm,
    border: `1px solid ${tk.border.light}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    backgroundColor: tk.surface.light,
    color: tk.text.primary,
  }),
  payBtn: (tk: AppThemeTokens): CSSProperties => ({
    width: '100%',
    paddingTop: rnSpacing.md,
    paddingBottom: rnSpacing.md,
    borderRadius: rnRadius.sm,
    textAlign: 'center',
    backgroundColor: tk.brand.cta,
    color: tk.brand.ctaForeground,
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
  }),
  closeBtn: (): CSSProperties => ({
    position: 'absolute',
    top: 8,
    right: 12,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: rnType.subtitle.size,
  }),
  priceLine: (): CSSProperties => ({ marginBottom: rnSpacing.sm }),
}

const textStyles = {
  icon: (): CSSProperties => ({ marginRight: rnSpacing.xs, fontSize: rnType.label.size }),
  label: (): CSSProperties => ({ fontSize: rnType.label.size }),
  productName: (tk: AppThemeTokens): CSSProperties => ({
    display: 'block',
    fontSize: rnType.body.size,
    fontWeight: 500,
    color: tk.text.primary,
  }),
  productTip: (tk: AppThemeTokens): CSSProperties => ({
    display: 'block',
    fontSize: rnType.label.size,
    color: tk.text.secondary,
  }),
  priceLabel: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: rnType.label.size,
    color: tk.text.secondary,
  }),
  countLabel: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: rnType.label.size,
    color: tk.text.secondary,
    marginRight: rnSpacing.sm,
  }),
  countValue: (): CSSProperties => ({
    marginLeft: rnSpacing.md,
    marginRight: rnSpacing.md,
    fontSize: rnType.body.size,
  }),
  payBtnText: (): CSSProperties => ({ fontSize: rnType.body.size }),
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
    width: 42,
    height: 42,
    borderRadius: rnRadius.xl,
    marginRight: rnSpacing.md,
    objectFit: 'cover',
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
  t,
  onShowToast,
  onFetchPrice,
}: PayButtonProps) {
  const tk = getTokens(colorScheme)
  const [popupVisible, setPopupVisible] = useState(false)
  const [count, setCount] = useState(1)
  const [price, setPrice] = useState<number>(DEFAULT_PRICE)

  const cfg = TYPE_CONFIG[type]
  const showToast = useCallback(
    (msg: string) => {
      if (onShowToast) onShowToast(msg)
      else if (typeof console !== 'undefined') console.info(`[PayButton] ${msg}`)
    },
    [onShowToast],
  )

  const handleClick = () => {
    if (disabled) return
    if (cfg.showPurchasePopup) {
      setPopupVisible(true)
      if (onFetchPrice && agentId) {
        onFetchPrice(agentId)
          .then(setPrice)
          .catch(() => setPrice(DEFAULT_PRICE))
      }
      return
    }
    onClick?.(type, agentId)
  }

  const handlePay = () => {
    // 实际接入后端 createPayHistory + 微信 JSAPI pay()
    showToast(textStyles.payDisabledToast())
    setPopupVisible(false)
    onClick?.(type, agentId)
  }

  const handleModalClick = (e: MouseEvent<HTMLDivElement>) => {
    // 关闭弹窗(冒泡到背景蒙层)
    if (e.target === e.currentTarget) {
      setPopupVisible(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') setPopupVisible(false)
  }

  const realPrice = (price * count).toFixed(2)

  // i18n fallback helper
  const tr = (key: string, fallback: string): string => (t ? t(key) : fallback)
  const productName = agentName || tr('pay.defaultName', textStyles.defaultName())
  const productTip = tr('pay.subscribeTip', textStyles.subscribeTip())
  const priceLabelText = tr('pay.priceLabel', textStyles.priceLabelFallback())
  const perMonthText = tr('pay.perMonth', textStyles.perMonth())
  const countLabelText = tr('pay.countLabel', textStyles.countLabelFallback())
  const payNowText = tr('pay.payNow', textStyles.payNow())

  return (
    <div style={viewStyles.root()}>
      <button
        type="button"
        style={viewStyles.trigger(cfg.bg(tk), cfg.text(tk), disabled)}
        onClick={handleClick}
        disabled={disabled}
      >
        <span style={textStyles.icon()}>
          <cfg.icon size={12} color={cfg.text(tk)} />
        </span>
        <span style={textStyles.label()}>{cfg.label}</span>
      </button>

      {popupVisible ? (
        <div
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onClick={handleModalClick}
          onKeyDown={handleKeyDown}
          style={viewStyles.modal(tk)}
        >
          <div style={viewStyles.dialog(tk)}>
            <button
              type="button"
              aria-label="关闭"
              style={viewStyles.closeBtn()}
              onClick={() => setPopupVisible(false)}
            >
              <X size={16} color={tk.text.primary} />
            </button>
            {/* 商品信息 */}
            <div style={viewStyles.productRow()}>
              {agentAvatar ? (
                <img src={agentAvatar} alt={productName} style={imageStyles.avatar()} />
              ) : (
                <div style={viewStyles.avatarFallback(tk)}>
                  <Bot size={20} color={tk.text.primary} />
                </div>
              )}
              <div style={viewStyles.productText()}>
                <span style={textStyles.productName(tk)}>{productName}</span>
                <span style={textStyles.productTip(tk)}>{productTip}</span>
              </div>
            </div>
            {/* 价格 */}
            <div style={viewStyles.priceLine()}>
              <span style={textStyles.priceLabel(tk)}>
                {priceLabelText}: ¥{price} / {perMonthText}
              </span>
            </div>
            {/* 数量 */}
            <div style={viewStyles.countRow()}>
              <span style={textStyles.countLabel(tk)}>{countLabelText}:</span>
              <button
                type="button"
                style={viewStyles.countBtn(tk, count <= 1)}
                onClick={() => count > 1 && setCount(count - 1)}
                disabled={count <= 1}
                aria-label="减少数量"
              >
                <Minus size={16} color={tk.text.primary} />
              </button>
              <span style={textStyles.countValue()}>{count}</span>
              <button
                type="button"
                style={viewStyles.countBtn(tk, false)}
                onClick={() => setCount(count + 1)}
                aria-label="增加数量"
              >
                <Plus size={16} color={tk.text.primary} />
              </button>
            </div>
            {/* 立即支付按钮 */}
            <button type="button" style={viewStyles.payBtn(tk)} onClick={handlePay}>
              <span style={textStyles.payBtnText()}>
                {payNowText} ¥{realPrice}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
