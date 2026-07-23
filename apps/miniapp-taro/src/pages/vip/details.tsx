import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useI18n } from '@/i18n'
import './details.css'

// 权益对比数据(AI 平台场景)
interface Benefit {
  label: string
  normal: string
  vip: string
}

// 套餐方案(对标原 vip/details.vue 月度¥39.9/30天 + 年度¥299/365天)
interface VipPlan {
  type: 'monthly' | 'yearly'
  price: number
  days: number
  benefits: string[]
}

export default function VipDetailsPage() {
  const { t } = useI18n()
  // i18n key 不存在时回退到中文文案(任务约束允许的 tt 模式)
  const tt = (key: string, fallback: string) => {
    const v = t(key)
    return v === key ? fallback : v
  }
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly')

  const BENEFITS: Benefit[] = [
    { label: t('vip.details.features.chatCount'), normal: '有限', vip: '无限' },
    { label: t('vip.details.features.drawCount'), normal: '5次/天', vip: '100次/天' },
    { label: t('vip.details.features.videoDuration'), normal: '5分钟', vip: '60分钟' },
    { label: t('vip.details.features.modelAccess'), normal: '基础模型', vip: '全部模型' },
    { label: t('vip.details.features.prioritySupport'), normal: '—', vip: '✓ 专属' },
    { label: t('vip.details.features.exclusiveGroup'), normal: '—', vip: '✓' },
    { label: t('vip.details.features.adExperience'), normal: '有广告', vip: '免广告' },
  ]

  // 权益详情(对标原 vip/details.vue 权益图标 + 标题 + 描述)
  const BENEFIT_DETAILS = [
    { icon: '💬', title: tt('vip.details.benefit.chat', '无限 AI 对话'), desc: tt('vip.details.benefit.chatDesc', '畅享顶级模型,不限次数') },
    { icon: '🎨', title: tt('vip.details.benefit.draw', 'AI 绘图'), desc: tt('vip.details.benefit.drawDesc', '100次/天,高清无水印') },
    { icon: '🎬', title: tt('vip.details.benefit.video', '视频生成'), desc: tt('vip.details.benefit.videoDesc', '60分钟视频生成时长') },
    { icon: '🤖', title: tt('vip.details.benefit.model', '全部模型'), desc: tt('vip.details.benefit.modelDesc', '解锁所有付费模型') },
    { icon: '🎧', title: tt('vip.details.benefit.support', '优先客服'), desc: tt('vip.details.benefit.supportDesc', '7×24 小时专属服务') },
    { icon: '👥', title: tt('vip.details.benefit.group', '专属社群'), desc: tt('vip.details.benefit.groupDesc', 'VIP 会员专属交流群') },
  ]

  const PLANS: VipPlan[] = [
    {
      type: 'monthly',
      price: 39.9,
      days: 30,
      benefits: [
        t('vip.details.features.chatCount') + ': ' + t('vip.details.features.vipColumn'),
        t('vip.details.features.drawCount'),
        t('vip.details.features.prioritySupport'),
      ],
    },
    {
      type: 'yearly',
      price: 299,
      days: 365,
      benefits: [
        tt('vip.details.monthlyAllBenefits', '月度会员所有权益'),
        t('vip.details.features.exclusiveGroup'),
        t('vip.details.features.modelAccess'),
        tt('vip.details.highCommission', '高额返佣特权'),
      ],
    },
  ]

  const goUpgrade = () => {
    const plan = PLANS.find((p) => p.type === selectedPlan) ?? PLANS[0]
    if (!plan) return
    Taro.navigateTo({
      url: `/pages/vip/upgrade?plan=${plan.type}&price=${plan.price}&days=${plan.days}`,
    })
  }

  const selectPlan = (type: 'monthly' | 'yearly') => setSelectedPlan(type)

  const planName = (type: 'monthly' | 'yearly') =>
    type === 'yearly' ? tt('vip.details.yearlyPlan', '年度会员') : tt('vip.details.monthlyPlan', '月度会员')

  return (
    <View className="page">
      <View className="banner">
        <View className="banner-back" onClick={() => Taro.navigateBack()}>
          <Text className="banner-back-icon">‹</Text>
          <Text className="banner-back-text">{tt('common.back', '返回')}</Text>
        </View>
        <Text className="banner-title">{t('vip.details.title')}</Text>
        <Text className="banner-desc">{t('vip.upgrade.bannerDesc')}</Text>
      </View>

      <View className="benefits">
        <Text className="benefits-title">{tt('vip.details.benefitsTitle', '权益详情')}</Text>
        <View className="benefits-list">
          {BENEFIT_DETAILS.map((b) => (
            <View key={b.title} className="benefit-item">
              <View className="benefit-icon">
                <Text>{b.icon}</Text>
              </View>
              <View className="benefit-content">
                <Text className="benefit-title">{b.title}</Text>
                <Text className="benefit-desc">{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 套餐选择(对标原项目月度/年度卡片) */}
      <View className="plans">
        <Text className="plans-title">{t('vip.plans')}</Text>
        <View className="plans-list">
          {PLANS.map((p) => {
            const active = selectedPlan === p.type
            return (
              <View
                key={p.type}
                className={`plan-card${active ? ' active' : ''}${p.type === 'yearly' ? ' yearly' : ''}`}
                onClick={() => selectPlan(p.type)}
              >
                {p.type === 'yearly' ? (
                  <Text className="plan-tag">{t('developer.subscribe.recommended')}</Text>
                ) : null}
                <View className="plan-head">
                  <Text className="plan-name">{planName(p.type)}</Text>
                  <Text className="plan-days">
                    {p.days}
                    {t('page.vip.dayUnit')}
                  </Text>
                </View>
                <View className="plan-price-wrap">
                  <Text className="plan-price-symbol">¥</Text>
                  <Text className="plan-price">{p.price}</Text>
                </View>
                <View className="plan-benefits">
                  {p.benefits.map((b, i) => (
                    <View key={i} className="plan-benefit">
                      <Text className="plan-benefit-icon">✓</Text>
                      <Text className="plan-benefit-text">{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* 权益对比表 */}
      <View className="compare">
        <View className="row head">
          <Text className="cell label">{t('vip.details.feature')}</Text>
          <Text className="cell normal">{t('vip.details.normal')}</Text>
          <Text className="cell vip">{t('vip.details.vipColumn')}</Text>
        </View>
        {BENEFITS.map((b) => (
          <View className="row" key={b.label}>
            <Text className="cell label">{b.label}</Text>
            <Text className="cell normal">{b.normal}</Text>
            <Text className="cell vip">{b.vip}</Text>
          </View>
        ))}
      </View>

      <Button className="btn" onClick={goUpgrade}>
        {t('vip.details.upgrade')}
      </Button>
    </View>
  )
}
