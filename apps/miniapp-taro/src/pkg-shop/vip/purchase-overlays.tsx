// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VIP 页的购买流程弹层(端侧 UI,共享屏不承载):
 * 介绍 / 确认购买 / 购买须知 / 支付方式 / 开通成功 + 既有 VipBenefitsPopup / VipPayConfirm。
 * 从 pkg-shop/vip/index.tsx 拆出,母页只保留状态机与业务回调。
 */
import { View, Text, Button } from '@tarojs/components'
import { useI18n, useTt } from '@/i18n'
import LineIcon from '@/components/LineIcon'
import {
  VipBenefitsPopup,
  VipPayConfirm,
  type PriceOption,
  type VipBenefit,
} from '@/components'

export interface VipPurchaseOverlaysProps {
  showBenefits: boolean
  benefits: VipBenefit[]
  onBenefitsUpgrade: () => void
  onBenefitsClose: () => void

  showPayConfirm: boolean
  plan: PriceOption | null
  payMethod: 'wechat' | 'alipay'
  onPayConfirm: () => void
  onPayCancel: () => void
  onPayMethodChange: (method: 'wechat' | 'alipay') => void

  showIntroduce: boolean
  onCloseIntroduce: () => void
  onIntroduceSubscribe: () => void

  showConfirm: boolean
  onCloseConfirm: () => void
  onConfirmNext: () => void

  showNotice: boolean
  noticeAgreed: boolean
  onToggleNoticeAgreed: () => void
  onCloseNotice: () => void
  onNoticeAgree: () => void

  showPayMethod: boolean
  onClosePayMethod: () => void
  onPayMethodConfirm: () => void

  showSuccess: boolean
  onSuccessViewBenefits: () => void
}

export default function VipPurchaseOverlays(props: VipPurchaseOverlaysProps) {
  const { t } = useI18n()
  const tt = useTt()
  const {
    showBenefits,
    benefits,
    onBenefitsUpgrade,
    onBenefitsClose,
    showPayConfirm,
    plan,
    payMethod,
    onPayConfirm,
    onPayCancel,
    onPayMethodChange,
    showIntroduce,
    onCloseIntroduce,
    onIntroduceSubscribe,
    showConfirm,
    onCloseConfirm,
    onConfirmNext,
    showNotice,
    noticeAgreed,
    onToggleNoticeAgreed,
    onCloseNotice,
    onNoticeAgree,
    showPayMethod,
    onClosePayMethod,
    onPayMethodConfirm,
    showSuccess,
    onSuccessViewBenefits,
  } = props

  return (
    <>
      <VipBenefitsPopup
        visible={showBenefits}
        benefits={benefits}
        onUpgrade={onBenefitsUpgrade}
        onClose={onBenefitsClose}
      />

      <VipPayConfirm
        visible={showPayConfirm}
        planName={plan ? `${plan.name}VIP` : t('vip.index.memberFallback')}
        price={plan?.price}
        originalPrice={plan?.originalPrice}
        paymentMethod={payMethod}
        onConfirm={onPayConfirm}
        onCancel={onPayCancel}
        onMethodChange={onPayMethodChange}
      />

      {/* 弹窗1: 等级介绍 */}
      {showIntroduce ? (
        <View className="pp-mask" onClick={onCloseIntroduce}>
          <View className="pp-card" onClick={(e) => e.stopPropagation()} hoverClass="opacity-60">
            <View className="pp-title">{t('vip.index.introduceTitle')}</View>
            <View className="pp-body">
              <Text className="pp-text">{t('vip.index.introduceDesc')}</Text>
            </View>
            <Button className="pp-btn" onClick={onIntroduceSubscribe}>
              {t('vip.subscribe')}
            </Button>
          </View>
        </View>
      ) : null}

      {/* 弹窗2: 确认购买 */}
      {showConfirm && plan ? (
        <View className="pp-mask" onClick={onCloseConfirm}>
          <View className="pp-card" onClick={(e) => e.stopPropagation()} hoverClass="opacity-60">
            <View className="pp-title">{t('vip.index.confirmTitle')}</View>
            <View className="pp-body">
              <View className="pp-plan">
                <Text className="pp-plan-name">{plan.name} VIP</Text>
                <Text className="pp-plan-price">¥{plan.price}</Text>
                <Text className="pp-plan-period">{plan.period}</Text>
              </View>
            </View>
            <Button className="pp-btn" onClick={onConfirmNext}>
              {t('vip.index.payNow')} ¥{plan.price}
            </Button>
          </View>
        </View>
      ) : null}

      {/* 弹窗3: 购买须知 */}
      {showNotice ? (
        <View className="pp-mask" onClick={onCloseNotice}>
          <View className="pp-card" onClick={(e) => e.stopPropagation()} hoverClass="opacity-60">
            <View className="pp-title">{t('vip.index.noticeTitle')}</View>
            <View className="pp-body">
              <Text className="pp-text">{t('vip.index.noticeRule1')}</Text>
              <Text className="pp-text">{t('vip.index.noticeRule2')}</Text>
              <Text className="pp-text">{t('vip.index.noticeRule3')}</Text>
              <Text className="pp-text">{t('vip.index.noticeRule4')}</Text>
              <View className="pp-check" hoverClass="opacity-60" onClick={onToggleNoticeAgreed}>
                <View className={`pp-checkbox ${noticeAgreed ? 'checked' : ''}`}>
                  {noticeAgreed ? (
                    <LineIcon
                      name="check"
                      size={24}
                      color="var(--color-brand-accent-foreground)"
                    />
                  ) : null}
                </View>
                <Text className="pp-check-text">{t('vip.index.noticeAgree')}</Text>
              </View>
            </View>
            <Button className="pp-btn" onClick={onNoticeAgree}>
              {t('vip.index.continuePay')}
            </Button>
          </View>
        </View>
      ) : null}

      {/* 弹窗4: 支付方式选择 */}
      {showPayMethod ? (
        <View className="pp-mask" onClick={onClosePayMethod}>
          <View className="pp-card" onClick={(e) => e.stopPropagation()} hoverClass="opacity-60">
            <View className="pp-title">{t('vip.index.payMethodTitle')}</View>
            <View className="pp-body">
              <View
                className={`pp-pay-item ${payMethod === 'wechat' ? 'active' : ''}`}
                hoverClass="opacity-60"
                onClick={() => onPayMethodChange('wechat')}
              >
                <View className="pp-pay-icon wechat">{tt('pay.wechat', '微')}</View>
                <Text className="pp-pay-name">{t('vip.index.wechatPay')}</Text>
                {payMethod === 'wechat' ? (
                  <LineIcon
                    className="pp-pay-check"
                    name="check"
                    size={32}
                    color="var(--color-brand)"
                  />
                ) : null}
              </View>
              <View
                className={`pp-pay-item ${payMethod === 'alipay' ? 'active' : ''}`}
                hoverClass="opacity-60"
                onClick={() => onPayMethodChange('alipay')}
              >
                <View className="pp-pay-icon alipay">{tt('pay.alipay', '付')}</View>
                <Text className="pp-pay-name">{t('vip.index.alipay')}</Text>
                {payMethod === 'alipay' ? (
                  <LineIcon
                    className="pp-pay-check"
                    name="check"
                    size={32}
                    color="var(--color-brand)"
                  />
                ) : null}
              </View>
            </View>
            <Button className="pp-btn" onClick={onPayMethodConfirm}>
              {t('vip.index.confirmPay')}
            </Button>
          </View>
        </View>
      ) : null}

      {/* 弹窗5: 开通成功 */}
      {showSuccess ? (
        <View className="pp-mask">
          <View className="pp-card">
            <View className="pp-success-icon">
              <LineIcon name="check-success" size={64} color="var(--color-success)" />
            </View>
            <View className="pp-title">{t('vip.index.successTitle')}</View>
            <View className="pp-body">
              <Text className="pp-text">{t('vip.index.successDesc')}</Text>
            </View>
            <Button className="pp-btn" onClick={onSuccessViewBenefits}>
              {t('vip.index.viewBenefits')}
            </Button>
          </View>
        </View>
      ) : null}
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
