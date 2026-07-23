import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import {
  getVipInfo,
  getVipPrivilege,
  getVipLevels,
  upgradeVip,
  signRecurringContract,
  type VipInfo,
  type VipPayInfo,
} from '@/api'
import { requestWxPayment, type AnyPayParams } from '@/utils/pay'
import {
  VipBenefitsPopup,
  VipPriceSelector,
  VipPayConfirm,
  type VipBenefit,
  type PriceOption,
} from '@/components'
import { useI18n } from '@/i18n'
import './index.css'

const gradient = 'linear-gradient(135deg, #f8d486, var(--color-warning))'

const DEFAULT_PLANS: PriceOption[] = [
  { id: 'monthly', name: '月度会员', price: 30, period: '30天' },
  { id: 'quarterly', name: '季度会员', price: 88, period: '90天' },
  { id: 'yearly', name: '年度会员', price: 299, period: '365天' },
]

export default function VipIndexPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }
  const [info, setInfo] = useState<VipInfo>({} as VipInfo)
  const [benefits, setBenefits] = useState<VipBenefit[]>([])
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>([])
  const [selectedPlan, setSelectedPlan] = useState<PriceOption | null>(null)
  const [showBenefits, setShowBenefits] = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat')
  const [autoRenew, setAutoRenew] = useState(false)
  // 5 弹窗 state
  const [showIntroduce, setShowIntroduce] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showNotice, setShowNotice] = useState(false)
  const [showPayMethod, setShowPayMethod] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [noticeAgreed, setNoticeAgreed] = useState(false)

  function dispatchVipPay(payInfo: VipPayInfo, orderNo: string, amount: number, planName: string) {
    const successUrl = `/pages/vip/success?orderNo=${orderNo}&amount=${amount}&planName=${encodeURIComponent(planName)}`
    if (
      payInfo.method === 'jsapi' &&
      payInfo.timeStamp &&
      payInfo.nonceStr &&
      payInfo.package &&
      payInfo.signType &&
      payInfo.paySign
    ) {
      requestWxPayment(payInfo as AnyPayParams)
        .then(() => Taro.redirectTo({ url: successUrl }))
        .catch(() => Taro.redirectTo({ url: `/pages/wallet/recharge/fail?orderNo=${orderNo}` }))
      return
    }
    if (payInfo.method === 'h5' && payInfo.h5Url && process.env.TARO_ENV === 'h5') {
      window.location.href = payInfo.h5Url
      return
    }
    if (payInfo.mock && payInfo.error) {
      Taro.showToast({ title: t('vip.index.configNotReady'), icon: 'none' })
    }
    Taro.redirectTo({ url: successUrl })
  }

  const load = useCallback(async () => {
    Taro.showLoading({ title: t('common.loading'), mask: true })
    try {
      const [i, p, lv] = await Promise.all([getVipInfo(), getVipPrivilege(), getVipLevels()])
      setInfo(i)
      const list = (p.list || []).map((item) => ({
        id: String(item.id),
        title: item.title,
        desc: item.desc,
      })) as VipBenefit[]
      setBenefits(list)
      const opts = (lv.items || []).map((l) => ({
        id: String(l.id),
        name: l.levelName,
        price: l.price / 100,
        period: `${l.durationDays}${t('page.vip.dayUnit')}`,
      })) as PriceOption[]
      const finalOpts = opts.length > 0 ? opts : DEFAULT_PLANS
      setPriceOptions(finalOpts)
      setSelectedPlan((prev) => prev ?? finalOpts[0] ?? null)
    } catch (e) {
      logger.error('vip/index', '获取VIP信息', e)
      setPriceOptions(DEFAULT_PLANS)
      setSelectedPlan((prev) => prev ?? DEFAULT_PLANS[0] ?? null)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }, [t])

  const onSelectPlan = useCallback((opt: PriceOption) => {
    setSelectedPlan(opt)
  }, [])

  const onUpgradeClick = useCallback(() => {
    if (!selectedPlan) {
      Taro.showToast({ title: t('vip.selectPlanFirst'), icon: 'none' })
      return
    }
    setShowPayConfirm(true)
  }, [selectedPlan, t])

  const onConfirmPay = useCallback(async () => {
    if (!selectedPlan) return
    setShowPayConfirm(false)
    try {
      if (autoRenew) {
        const signRes = await signRecurringContract({ planId: selectedPlan.id })
        Taro.navigateTo({
          url: `/pages/webview/index?url=${encodeURIComponent(signRes.signUrl)}`,
        })
        return
      }
      const res = await upgradeVip(selectedPlan.id)
      dispatchVipPay(res.payInfo, res.orderNo, selectedPlan.price, selectedPlan.name)
    } catch (e) {
      logger.error('vip/index', '开通VIP', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [selectedPlan, autoRenew, t])

  const onBenefitsClick = useCallback(() => {
    setShowBenefits(true)
  }, [])

  // 5 弹窗流程 handlers
  const onIntroduceClick = useCallback(() => setShowIntroduce(true), [])
  const onIntroduceSubscribe = useCallback(() => {
    if (!selectedPlan) {
      Taro.showToast({ title: t('vip.selectPlanFirst'), icon: 'none' })
      return
    }
    setShowIntroduce(false)
    setShowConfirm(true)
  }, [selectedPlan, t])
  const onConfirmNext = useCallback(() => {
    setShowConfirm(false)
    setNoticeAgreed(false)
    setShowNotice(true)
  }, [])
  const onNoticeAgree = useCallback(() => {
    if (!noticeAgreed) {
      Taro.showToast({ title: t('vip.index.agreeFirst'), icon: 'none' })
      return
    }
    setShowNotice(false)
    setShowPayMethod(true)
  }, [noticeAgreed, t])
  const onPayMethodConfirm = useCallback(() => {
    setShowPayMethod(false)
    setShowSuccess(true)
  }, [])
  const onSuccessViewBenefits = useCallback(() => {
    setShowSuccess(false)
    setShowBenefits(true)
  }, [])

  useDidShow(load)

  return (
    <View className="page">
      <View className="header" style={{ background: info.level ? gradient : '#999' }}>
        <Text className="brand-title">{tt('vip.index.brandTitle', 'AI智汇社 会员')}</Text>
        <View className="level-row">
          <View className="level">{info.level ? info.name : t('vip.notOpened')}</View>
          <Text className="intro-link" onClick={onIntroduceClick}>{t('vip.index.introduce')}</Text>
        </View>
        {info.expireTime ? (
          <View className="expire">{t('vip.expireTime', { time: info.expireTime })}</View>
        ) : (
          <View className="expire">{t('vip.openHint')}</View>
        )}
      </View>

      <View className="card">
        <View className="card-title">{t('vip.privileges')}</View>
        <View className="grid">
          {benefits.slice(0, 8).map((p) => (
            <View key={p.id} className="grid-item" onClick={onBenefitsClick}>
              <View className="gicon">★</View>
              <Text className="gtext">{p.title}</Text>
            </View>
          ))}
        </View>
        <View className="more-btn" onClick={onBenefitsClick}>
          <Text>{t('vip.viewAllBenefits')}</Text>
        </View>
      </View>

      <View className="card">
        <View className="card-title">{t('vip.plans')}</View>
        <VipPriceSelector
          options={priceOptions}
          selectedId={selectedPlan?.id || ''}
          onSelect={onSelectPlan}
        />
        <View
          className="flex items-center mt-[24rpx] py-[8rpx]"
          onClick={() => setAutoRenew((v) => !v)}
        >
          <View
            className={`w-[36rpx] h-[36rpx] mr-[16rpx] flex items-center justify-center border-[2rpx] rounded-[8rpx] ${autoRenew ? 'bg-[var(--color-warning)] border-[var(--color-warning)]' : 'border-[#ccc] bg-card'}`}
          >
            {autoRenew && <Text className="text-white text-[24rpx] leading-none">✓</Text>}
          </View>
          <Text className="text-[24rpx] text-muted-foreground">{t('vip.index.autoRenew')}</Text>
        </View>
        <View
          className="mt-[12rpx] text-[22rpx] text-primary"
          onClick={() => Taro.navigateTo({ url: '/pages/subscription/contracts/index' })}
        >
          <Text>{t('vip.index.manageAutoRenew')}</Text>
        </View>
        <Button className="btn" onClick={onUpgradeClick}>
          {t('vip.subscribe')}
          {selectedPlan ? ` ¥${selectedPlan.price}` : ''}
        </Button>
      </View>

      <View className="card">
        <View className="card-title">{t('vip.memberDesc')}</View>
        <Text className="desc-text">{t('vip.memberDescText')}</Text>
      </View>

      <VipBenefitsPopup
        visible={showBenefits}
        benefits={benefits}
        onUpgrade={() => {
          setShowBenefits(false)
          setShowPayConfirm(true)
        }}
        onClose={() => setShowBenefits(false)}
      />

      <VipPayConfirm
        visible={showPayConfirm}
        planName={selectedPlan ? `${selectedPlan.name}VIP` : t('vip.index.memberFallback')}
        price={selectedPlan?.price}
        originalPrice={selectedPlan?.originalPrice}
        paymentMethod={payMethod}
        onConfirm={onConfirmPay}
        onCancel={() => setShowPayConfirm(false)}
        onMethodChange={setPayMethod}
      />

      {/* 弹窗1: 等级介绍 */}
      {showIntroduce && (
        <View className="pp-mask" onClick={() => setShowIntroduce(false)}>
          <View className="pp-card" onClick={(e) => e.stopPropagation()}>
            <View className="pp-title">{t('vip.index.introduceTitle')}</View>
            <View className="pp-body">
              <Text className="pp-text">{t('vip.index.introduceDesc')}</Text>
            </View>
            <Button className="pp-btn" onClick={onIntroduceSubscribe}>{t('vip.subscribe')}</Button>
          </View>
        </View>
      )}

      {/* 弹窗2: 确认购买 */}
      {showConfirm && selectedPlan && (
        <View className="pp-mask" onClick={() => setShowConfirm(false)}>
          <View className="pp-card" onClick={(e) => e.stopPropagation()}>
            <View className="pp-title">{t('vip.index.confirmTitle')}</View>
            <View className="pp-body">
              <View className="pp-plan">
                <Text className="pp-plan-name">{selectedPlan.name} VIP</Text>
                <Text className="pp-plan-price">¥{selectedPlan.price}</Text>
                <Text className="pp-plan-period">{selectedPlan.period}</Text>
              </View>
            </View>
            <Button className="pp-btn" onClick={onConfirmNext}>
              {t('vip.index.payNow')} ¥{selectedPlan.price}
            </Button>
          </View>
        </View>
      )}

      {/* 弹窗3: 购买须知 */}
      {showNotice && (
        <View className="pp-mask" onClick={() => setShowNotice(false)}>
          <View className="pp-card" onClick={(e) => e.stopPropagation()}>
            <View className="pp-title">{t('vip.index.noticeTitle')}</View>
            <View className="pp-body">
              <Text className="pp-text">{t('vip.index.noticeRule1')}</Text>
              <Text className="pp-text">{t('vip.index.noticeRule2')}</Text>
              <Text className="pp-text">{t('vip.index.noticeRule3')}</Text>
              <Text className="pp-text">{t('vip.index.noticeRule4')}</Text>
              <View className="pp-check" onClick={() => setNoticeAgreed(!noticeAgreed)}>
                <View className={`pp-checkbox ${noticeAgreed ? 'checked' : ''}`}>
                  {noticeAgreed && <Text className="pp-check-mark">✓</Text>}
                </View>
                <Text className="pp-check-text">{t('vip.index.noticeAgree')}</Text>
              </View>
            </View>
            <Button className="pp-btn" onClick={onNoticeAgree}>{t('vip.index.continuePay')}</Button>
          </View>
        </View>
      )}

      {/* 弹窗4: 支付方式选择 */}
      {showPayMethod && (
        <View className="pp-mask" onClick={() => setShowPayMethod(false)}>
          <View className="pp-card" onClick={(e) => e.stopPropagation()}>
            <View className="pp-title">{t('vip.index.payMethodTitle')}</View>
            <View className="pp-body">
              <View
                className={`pp-pay-item ${payMethod === 'wechat' ? 'active' : ''}`}
                onClick={() => setPayMethod('wechat')}
              >
                <View className="pp-pay-icon wechat">微</View>
                <Text className="pp-pay-name">{t('vip.index.wechatPay')}</Text>
                <Text className="pp-pay-check">{payMethod === 'wechat' ? '✓' : ''}</Text>
              </View>
              <View
                className={`pp-pay-item ${payMethod === 'alipay' ? 'active' : ''}`}
                onClick={() => setPayMethod('alipay')}
              >
                <View className="pp-pay-icon alipay">付</View>
                <Text className="pp-pay-name">{t('vip.index.alipay')}</Text>
                <Text className="pp-pay-check">{payMethod === 'alipay' ? '✓' : ''}</Text>
              </View>
            </View>
            <Button className="pp-btn" onClick={onPayMethodConfirm}>{t('vip.index.confirmPay')}</Button>
          </View>
        </View>
      )}

      {/* 弹窗5: 开通成功 */}
      {showSuccess && (
        <View className="pp-mask">
          <View className="pp-card">
            <View className="pp-success-icon">✓</View>
            <View className="pp-title">{t('vip.index.successTitle')}</View>
            <View className="pp-body">
              <Text className="pp-text">{t('vip.index.successDesc')}</Text>
            </View>
            <Button className="pp-btn" onClick={onSuccessViewBenefits}>{t('vip.index.viewBenefits')}</Button>
          </View>
        </View>
      )}
    </View>
  )
}
