import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useI18n } from '@/i18n'

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
    {
      icon: '💬',
      title: tt('vip.details.benefit.chat', '无限 AI 对话'),
      desc: tt('vip.details.benefit.chatDesc', '畅享顶级模型,不限次数'),
    },
    {
      icon: '🎨',
      title: tt('vip.details.benefit.draw', 'AI 绘图'),
      desc: tt('vip.details.benefit.drawDesc', '100次/天,高清无水印'),
    },
    {
      icon: '🎬',
      title: tt('vip.details.benefit.video', '视频生成'),
      desc: tt('vip.details.benefit.videoDesc', '60分钟视频生成时长'),
    },
    {
      icon: '🤖',
      title: tt('vip.details.benefit.model', '全部模型'),
      desc: tt('vip.details.benefit.modelDesc', '解锁所有付费模型'),
    },
    {
      icon: '🎧',
      title: tt('vip.details.benefit.support', '优先客服'),
      desc: tt('vip.details.benefit.supportDesc', '7×24 小时专属服务'),
    },
    {
      icon: '👥',
      title: tt('vip.details.benefit.group', '专属社群'),
      desc: tt('vip.details.benefit.groupDesc', 'VIP 会员专属交流群'),
    },
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
    type === 'yearly'
      ? tt('vip.details.yearlyPlan', '年度会员')
      : tt('vip.details.monthlyPlan', '月度会员')

  return (
    <View className="min-h-screen bg-background pb-[140rpx]">
      <View className="pt-[56rpx] pr-[40rpx] pb-[40rpx] pl-[40rpx] bg-[linear-gradient(135deg,#f8d486,var(--color-warning))] text-foreground">
        <View className="flex items-center mb-[20rpx]" onClick={() => Taro.navigateBack()}>
          <Text className="text-[40rpx] text-foreground leading-none mr-[8rpx]">‹</Text>
          <Text className="text-[28rpx] text-foreground">{tt('common.back', '返回')}</Text>
        </View>
        <Text className="block text-[44rpx] font-bold">{t('vip.details.title')}</Text>
        <Text className="block text-[26rpx] mt-[12rpx] opacity-90">
          {t('vip.upgrade.bannerDesc')}
        </Text>
      </View>

      <View className="m-[24rpx]">
        <Text className="block text-[30rpx] font-semibold text-foreground mb-[16rpx]">
          {tt('vip.details.benefitsTitle', '权益详情')}
        </Text>
        <View className="flex flex-col gap-[16rpx]">
          {BENEFIT_DETAILS.map((b) => (
            <View key={b.title} className="flex items-start bg-card rounded-[16rpx] p-[24rpx]">
              <View className="w-[64rpx] h-[64rpx] rounded-[16rpx] bg-[rgba(245,158,11,0.1)] flex items-center justify-center mr-[20rpx] shrink-0 text-[32rpx]">
                <Text>{b.icon}</Text>
              </View>
              <View className="flex-1 flex flex-col">
                <Text className="text-[28rpx] font-semibold text-foreground">{b.title}</Text>
                <Text className="mt-[8rpx] text-[24rpx] text-muted-foreground leading-[1.5]">
                  {b.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 套餐选择(对标原项目月度/年度卡片) */}
      <View className="m-[24rpx]">
        <Text className="block text-[30rpx] font-semibold text-foreground mb-[16rpx]">
          {t('vip.plans')}
        </Text>
        <View className="flex gap-[20rpx]">
          {PLANS.map((p) => {
            const active = selectedPlan === p.type
            return (
              <View
                key={p.type}
                className={`flex-1 relative bg-card border-[2rpx] rounded-[16rpx] py-[28rpx] px-[24rpx] ${active ? (p.type === 'yearly' ? 'border-warning bg-[rgba(245,158,11,0.1)]' : 'border-warning bg-[rgba(245,158,11,0.06)]') : 'border-border'}`}
                onClick={() => selectPlan(p.type)}
              >
                {p.type === 'yearly' ? (
                  <Text className="absolute top-[-2rpx] right-[-2rpx] bg-warning text-foreground text-[20rpx] py-[4rpx] px-[12rpx] rounded-tr-[14rpx] rounded-bl-[12rpx]">
                    {t('developer.subscribe.recommended')}
                  </Text>
                ) : null}
                <View className="flex flex-col mb-[16rpx]">
                  <Text className="text-[30rpx] font-bold text-foreground">{planName(p.type)}</Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[6rpx]">
                    {p.days}
                    {t('page.vip.dayUnit')}
                  </Text>
                </View>
                <View className="flex items-start mb-[20rpx]">
                  <Text className="text-[26rpx] text-warning font-bold leading-none mt-[8rpx]">
                    ¥
                  </Text>
                  <Text className="text-[52rpx] text-warning font-bold leading-none ml-[4rpx]">
                    {p.price}
                  </Text>
                </View>
                <View className="flex flex-col gap-[10rpx]">
                  {p.benefits.map((b, i) => (
                    <View key={i} className="flex items-start">
                      <Text className="text-[24rpx] text-warning mr-[12rpx] leading-[1.4]">✓</Text>
                      <Text className="flex-1 text-[24rpx] text-foreground leading-[1.4]">{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* 权益对比表 */}
      <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden border-[2rpx] border-border">
        <View className="flex items-stretch bg-[rgba(245,158,11,0.12)]">
          <Text className="flex-[1.4] py-[24rpx] px-[16rpx] text-left text-foreground font-medium text-[28rpx] font-bold">
            {t('vip.details.feature')}
          </Text>
          <Text className="flex-1 py-[24rpx] px-[16rpx] text-center text-muted-foreground text-[28rpx] font-bold">
            {t('vip.details.normal')}
          </Text>
          <Text className="flex-1 py-[24rpx] px-[16rpx] text-center text-warning font-semibold bg-[rgba(245,158,11,0.08)] text-[28rpx] font-bold">
            {t('vip.details.vipColumn')}
          </Text>
        </View>
        {BENEFITS.map((b, i) => (
          <View
            key={b.label}
            className={`flex items-stretch ${i % 2 === 0 ? 'bg-background' : ''}`}
          >
            <Text className="flex-[1.4] py-[24rpx] px-[16rpx] text-left text-foreground font-medium text-[26rpx]">
              {b.label}
            </Text>
            <Text className="flex-1 py-[24rpx] px-[16rpx] text-center text-muted-foreground text-[26rpx]">
              {b.normal}
            </Text>
            <Text className="flex-1 py-[24rpx] px-[16rpx] text-center text-warning font-semibold bg-[rgba(245,158,11,0.08)] text-[26rpx]">
              {b.vip}
            </Text>
          </View>
        ))}
      </View>

      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-warning text-foreground rounded-[16rpx] text-[32rpx] font-semibold"
        onClick={goUpgrade}
      >
        {t('vip.details.upgrade')}
      </Button>
    </View>
  )
}
