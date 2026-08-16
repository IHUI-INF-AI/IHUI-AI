import { logger } from '@/utils/logger'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
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
import { useI18n, useTt } from '@/i18n'
import './index.css'

// 4 项会员特权(对齐原项目 zhs_app-ZZ,垂直列表展示)
interface VipFeature {
  id: string
  icon: string
  title: string
  desc: string
}

export default function VipIndexPage() {
  const { t } = useI18n()
  const tt = useTt()

  const defaultPlans = useMemo<PriceOption[]>(
    () => [
      {
        id: 'monthly',
        name: tt('vip.plan.monthly', '月度会员'),
        price: 30,
        period: tt('vip.plan.monthlyPeriod', '30天'),
      },
      {
        id: 'quarterly',
        name: tt('vip.plan.quarterly', '季度会员'),
        price: 88,
        period: tt('vip.plan.quarterlyPeriod', '90天'),
      },
      {
        id: 'yearly',
        name: tt('vip.plan.yearly', '年度会员'),
        price: 299,
        period: tt('vip.plan.yearlyPeriod', '365天'),
      },
    ],
    [tt],
  )

  const features = useMemo<ReadonlyArray<VipFeature>>(
    () => [
      {
        id: 'ai_copywriting',
        icon: '✍️',
        title: tt('vip.feature.aiCopywriting', 'AI营销文案'),
        desc: tt('vip.feature.aiCopywritingDesc', '智能生成各类营销文案'),
      },
      {
        id: 'ai_chat',
        icon: '💬',
        title: tt('vip.feature.aiChat', 'AI智能对话'),
        desc: tt('vip.feature.aiChatDesc', '智能助手解答各类问题'),
      },
      {
        id: 'ai_analysis',
        icon: '📊',
        title: tt('vip.feature.aiAnalysis', 'AI数据分析'),
        desc: tt('vip.feature.aiAnalysisDesc', '智能分析各类数据报表'),
      },
      {
        id: 'ai_design',
        icon: '🎨',
        title: tt('vip.feature.aiDesign', 'AI智能设计'),
        desc: tt('vip.feature.aiDesignDesc', '智能生成图片和设计'),
      },
    ],
    [tt],
  )

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

  const dispatchVipPay = useCallback(
    (payInfo: VipPayInfo, orderNo: string, amount: number, planName: string) => {
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
    },
    [t],
  )

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
      const finalOpts = opts.length > 0 ? opts : defaultPlans
      setPriceOptions(finalOpts)
      setSelectedPlan((prev) => prev ?? finalOpts[0] ?? null)
    } catch (e) {
      logger.error('vip/index', '获取VIP信息', e)
      setPriceOptions(defaultPlans)
      setSelectedPlan((prev) => prev ?? defaultPlans[0] ?? null)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }, [t, defaultPlans])

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
  }, [selectedPlan, autoRenew, t, dispatchVipPay])

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

  const currentPrice = selectedPlan?.price ?? 0

  return (
    <View className="vip-page">
      {/* 头部 400rpx + vip_back.png 背景 */}
      <View className="header">
        <Image className="bg-image" src="/static/images/vip_back.png" mode="aspectFill" />
        <View className="content">
          <View className="title">{tt('vip.index.brandTitle', 'AI智汇社 VIP会员')}</View>
          <View className="subtitle">{t('vip.openHint')}</View>
          <View className="price-box">
            <Text className="current-price">¥{currentPrice}</Text>
          </View>
        </View>
      </View>

      {/* 状态行:等级 + 等级介绍入口 */}
      <View className="status-bar">
        <View className="status-level">{info.level ? info.name : t('vip.notOpened')}</View>
        <Text className="intro-link" onClick={onIntroduceClick}>
          {t('vip.index.introduce')}
        </Text>
      </View>
      {info.expireTime ? (
        <View className="expire-row">{t('vip.expireTime', { time: info.expireTime })}</View>
      ) : null}

      {/* 特权列表(垂直 4 项) */}
      <View className="features">
        <View className="section-title">{t('vip.privileges')}</View>
        <View className="feature-list">
          {features.map((f) => (
            <View key={f.id} className="feature-item">
              <Text className="feature-icon">{f.icon}</Text>
              <View className="feature-info">
                <Text className="feature-title">{f.title}</Text>
                <Text className="feature-desc">{f.desc}</Text>
              </View>
              <Text className="feature-tag">VIP</Text>
            </View>
          ))}
        </View>
        <View className="more-btn" onClick={onBenefitsClick}>
          <Text>{t('vip.viewAllBenefits')}</Text>
        </View>
      </View>

      {/* 套餐选择 + 自动续费 + 会员说明(深色卡片) */}
      <View className="plans-card">
        <View className="section-title">{t('vip.plans')}</View>
        <VipPriceSelector
          options={priceOptions}
          selectedId={selectedPlan?.id || ''}
          onSelect={onSelectPlan}
        />
        <View className="auto-renew" onClick={() => setAutoRenew((v) => !v)}>
          <View className={`auto-check ${autoRenew ? 'checked' : ''}`}>
            {autoRenew ? <Text className="auto-mark">✓</Text> : null}
          </View>
          <Text className="auto-text">{t('vip.index.autoRenew')}</Text>
        </View>
        <View
          className="manage-link"
          onClick={() => Taro.navigateTo({ url: '/pages/subscription/contracts/index' })}
        >
          <Text>{t('vip.index.manageAutoRenew')}</Text>
        </View>
        <View className="member-desc">
          <View className="section-title small">{t('vip.memberDesc')}</View>
          <Text className="desc-text">{t('vip.memberDescText')}</Text>
        </View>
      </View>

      {/* 底部购买区 fixed */}
      <View className="buy-section">
        <View className="price-info">
          <View className="price">
            <Text className="symbol">¥</Text>
            <Text className="number">{currentPrice}</Text>
          </View>
        </View>
        <Button className="buy-btn" onClick={onUpgradeClick}>
          {t('vip.subscribe')}
        </Button>
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
      {showIntroduce ? (
        <View className="pp-mask" onClick={() => setShowIntroduce(false)}>
          <View className="pp-card" onClick={(e) => e.stopPropagation()}>
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
      {showConfirm && selectedPlan ? (
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
      ) : null}

      {/* 弹窗3: 购买须知 */}
      {showNotice ? (
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
                  {noticeAgreed ? <Text className="pp-check-mark">✓</Text> : null}
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
        <View className="pp-mask" onClick={() => setShowPayMethod(false)}>
          <View className="pp-card" onClick={(e) => e.stopPropagation()}>
            <View className="pp-title">{t('vip.index.payMethodTitle')}</View>
            <View className="pp-body">
              <View
                className={`pp-pay-item ${payMethod === 'wechat' ? 'active' : ''}`}
                onClick={() => setPayMethod('wechat')}
              >
                <View className="pp-pay-icon wechat">{tt('pay.wechat', '微')}</View>
                <Text className="pp-pay-name">{t('vip.index.wechatPay')}</Text>
                <Text className="pp-pay-check">{payMethod === 'wechat' ? '✓' : ''}</Text>
              </View>
              <View
                className={`pp-pay-item ${payMethod === 'alipay' ? 'active' : ''}`}
                onClick={() => setPayMethod('alipay')}
              >
                <View className="pp-pay-icon alipay">{tt('pay.alipay', '付')}</View>
                <Text className="pp-pay-name">{t('vip.index.alipay')}</Text>
                <Text className="pp-pay-check">{payMethod === 'alipay' ? '✓' : ''}</Text>
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
            <View className="pp-success-icon">✓</View>
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
    </View>
  )
}
