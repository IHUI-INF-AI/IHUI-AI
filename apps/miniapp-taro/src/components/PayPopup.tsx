import { useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import { useTt } from '@/i18n'
import {
  requestPayment,
  type WechatPayParams,
  type AlipayPayParams,
  type PayResult,
} from '@/platform/pay'
import './PayPopup.css'

/**
 * 支付按钮变体(对齐历史项目 pay_btn.vue 的 5 类型语义)
 * - default  默认 - 普通支付按钮(对齐 ConfirmPurchasePopUp .pay-button 蓝色渐变)
 * - vip      VIP 专属 - 金色渐变(对齐 VipPayConfirm 金色 / pay_btn .discount #8B91FF)
 * - discount 折扣 - 红色促销(对齐 ConfirmPurchasePopUp .benefit-item.highlight #ff5722)
 * - subscription 订阅 - 紫色(对齐 pay_btn .title #517BFF + brand token)
 * - gift     礼物 - 粉色(对齐 chart-6 #ec4899)
 */
export type PayButtonType = 'default' | 'vip' | 'discount' | 'subscription' | 'gift'

export interface PayInfo {
  payType?: number
  payCrowd?: number
  amount?: number
  isVip?: number
  title?: string
  /** 商品权益列表(对齐原项目 product-desc.benefit-item) */
  benefits?: string[]
  /** 高亮权益(对齐原项目 .benefit-item.highlight) */
  highlightBenefit?: string
  /** 原价/划线价(对齐原项目 price-original,line-through) */
  originalPrice?: number
}

export interface PayPopupProps {
  visible?: boolean
  pay?: PayInfo
  /** 按钮变体:控制底部"立即支付"按钮颜色风格 */
  payButtonType?: PayButtonType
  /** 支付参数(微信 JSAPI / 支付宝),传入后点击按钮触发 JSAPI 流程;不传则走旧 onPay 回调 */
  payParams?: WechatPayParams | AlipayPayParams
  /** 支付方式(用于 UI 显示与支付方式选择) */
  paymentMethod?: 'wechat' | 'alipay'
  onClose?: () => void
  /** 旧回调:无 payParams 时点击按钮触发(向后兼容) */
  onPay?: () => void
  /** JSAPI 支付成功回调 */
  onPaySuccess?: (result: PayResult) => void
  /** JSAPI 支付失败/取消回调(err === 'cancel' 表示用户取消) */
  onPayError?: (err: unknown) => void
  /** 支付方式切换回调 */
  onMethodChange?: (method: 'wechat' | 'alipay') => void
}

const BUTTON_VARIANT_CLASS: Record<PayButtonType, string> = {
  default: 'pp-pay-button--default',
  vip: 'pp-pay-button--vip',
  discount: 'pp-pay-button--discount',
  subscription: 'pp-pay-button--subscription',
  gift: 'pp-pay-button--gift',
}

export default function PayPopup({
  visible = false,
  pay = {},
  payButtonType = 'default',
  payParams,
  paymentMethod = 'wechat',
  onClose,
  onPay,
  onPaySuccess,
  onPayError,
  onMethodChange,
}: PayPopupProps) {
  const tt = useTt()

  // loading/error 状态(对齐原项目 isLoading + 错误处理)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  /**
   * 微信 JSAPI 支付流程(对齐原项目 ConfirmPurchasePopUp.callWxPay):
   * 1. 点击按钮 → 触发 requestPayment(payParams)
   * 2. requestPayment 内部已封装:Taro.showLoading + Taro.requestPayment + 用户友好错误提示
   * 3. 成功 → onPaySuccess;失败 → onPayError + 按钮下方错误文本
   * 4. 用户取消(err === 'cancel')不显示错误文本(避免"失败"误导)
   */
  const handlePay = useCallback(async () => {
    if (!payParams) {
      onPay?.()
      return
    }
    if (isLoading) return
    setIsLoading(true)
    setErrorMsg('')
    try {
      const result = await requestPayment(payParams)
      onPaySuccess?.(result)
    } catch (err) {
      if (err !== 'cancel') {
        const message = err instanceof Error ? err.message : tt('pay.payFailed', '支付失败,请重试')
        setErrorMsg(message)
      }
      onPayError?.(err)
    } finally {
      setIsLoading(false)
    }
  }, [payParams, isLoading, onPay, onPaySuccess, onPayError, tt])

  if (!visible) return null

  const {
    payType = 0,
    payCrowd = 0,
    amount = 0,
    isVip = 0,
    title,
    benefits,
    highlightBenefit,
    originalPrice,
  } = pay
  const isFree = payType === 0
  const isLimitFree = payType === 1 && payCrowd === 0
  const isVipFree = payCrowd === 1 && isVip > 0
  const isPaid = !isFree && !isLimitFree && !isVipFree
  const displayAmount = (amount / 100).toFixed(2)
  const displayOriginal = originalPrice ? (originalPrice / 100).toFixed(2) : ''

  const btnVariantClass = BUTTON_VARIANT_CLASS[payButtonType] ?? BUTTON_VARIANT_CLASS.default

  return (
    <View className="fixed inset-0 z-[2000] flex items-end" onClick={onClose}>
      <View className="absolute inset-0 bg-black/50" />
      <View
        className="relative bg-card rounded-t-2xl w-full px-6 pb-6 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题区 */}
        <View className="flex items-center justify-between mb-4">
          <Text className="text-base font-medium text-foreground">
            {title || tt('pay.purchaseContent', '购买内容')}
          </Text>
          <Text className="text-sm text-muted-foreground" onClick={onClose}>
            {tt('common.close', '关闭')}
          </Text>
        </View>

        {/* 价格区(对齐原项目 product-price:¥符号 + 大号金额 + 划线原价) */}
        <View className="mb-4">
          {isFree ? (
            <Text className="text-2xl font-bold text-primary">{tt('common.free', '免费')}</Text>
          ) : isLimitFree ? (
            <Text className="text-2xl font-bold text-warning">
              {tt('pay.limitedFree', '限时免费')}
            </Text>
          ) : isVipFree ? (
            <Text className="text-2xl font-bold text-warning">
              {tt('pay.memberFree', '会员免费')}
            </Text>
          ) : (
            <View className="flex items-baseline">
              <Text className="text-lg font-bold text-destructive">¥</Text>
              <Text className="text-2xl font-bold text-destructive">{displayAmount}</Text>
              {displayOriginal && (
                <Text className="text-sm text-muted-foreground line-through ml-2">
                  ¥{displayOriginal}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* 权益列表(对齐原项目 product-desc.benefit-item) */}
        {benefits && benefits.length > 0 && (
          <View className="pp-benefits mb-4">
            {benefits.map((b, i) => (
              <Text key={i} className="pp-benefit-item">
                {b}
              </Text>
            ))}
            {highlightBenefit && (
              <Text className="pp-benefit-item pp-benefit-item--highlight">{highlightBenefit}</Text>
            )}
          </View>
        )}

        {/* 支付方式选择(对齐原项目 payment-options:微信支付选项) */}
        {isPaid && (
          <View className="mb-4">
            <Text className="block text-sm text-foreground mb-2">
              {tt('pay.paymentMethod', '支付方式')}
            </Text>
            <View className="flex space-x-3">
              <View
                className={`flex-1 flex items-center justify-center py-3 rounded-lg border-2 ${
                  paymentMethod === 'wechat' ? 'border-green-500 bg-primary/10' : 'border-border'
                }`}
                onClick={() => onMethodChange?.('wechat')}
              >
                <Text className="text-sm text-foreground">{tt('pay.wechat', '微信支付')}</Text>
              </View>
              <View
                className={`flex-1 flex items-center justify-center py-3 rounded-lg border-2 ${
                  paymentMethod === 'alipay' ? 'border-primary bg-primary/10' : 'border-border'
                }`}
                onClick={() => onMethodChange?.('alipay')}
              >
                <Text className="text-sm text-foreground">{tt('pay.alipay', '支付宝')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 错误提示(对齐"用户友好错误提示"约束) */}
        {errorMsg && (
          <View className="mb-3">
            <Text className="text-xs text-destructive">{errorMsg}</Text>
          </View>
        )}

        {/* 按钮区(对齐原项目 button-area.pay-button,支持 5 类型变体) */}
        <View className="flex space-x-3">
          {!isFree && !isLimitFree && !isPaid && (
            <View
              className="flex-1 py-3 rounded-md border border-yellow-400 bg-yellow-50 text-center"
              onClick={onPay}
            >
              <Text className="text-sm text-warning">{tt('pay.memberFree', '会员免费')}</Text>
            </View>
          )}
          {isPaid && (
            <View
              className={`flex-1 py-3 rounded-md text-center pp-pay-button ${btnVariantClass} ${
                isLoading ? 'pp-pay-button--loading' : ''
              }`}
              onClick={handlePay}
            >
              <Text className="text-sm text-white font-medium">
                {isLoading
                  ? tt('pay.paying', '支付中...')
                  : `${tt('pay.buyNow', '立即支付')} ¥${displayAmount}`}
              </Text>
            </View>
          )}
        </View>

        {/* 协议链接(对齐原项目 agreement:点击立即支付表示同意《用户协议》) */}
        {isPaid && (
          <View className="mt-3 text-center">
            <Text className="text-xs text-muted-foreground">
              {tt('pay.agreementPrefix', '点击立即支付,表示同意')}
            </Text>
            <Text className="text-xs text-link ml-1">
              {tt('pay.userAgreement', '《用户协议》')}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}
