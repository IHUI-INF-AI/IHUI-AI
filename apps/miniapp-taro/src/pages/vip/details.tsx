// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon, { type IconName } from '@/components/LineIcon'

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
      icon: 'message-circle',
      title: tt('vip.details.benefit.chat', '无限 AI 对话'),
      desc: tt('vip.details.benefit.chatDesc', '畅享顶级模型,不限次数'),
    },
    {
      icon: 'palette',
      title: tt('vip.details.benefit.draw', 'AI 绘图'),
      desc: tt('vip.details.benefit.drawDesc', '100次/天,高清无水印'),
    },
    {
      icon: 'film',
      title: tt('vip.details.benefit.video', '视频生成'),
      desc: tt('vip.details.benefit.videoDesc', '60分钟视频生成时长'),
    },
    {
      icon: 'bot',
      title: tt('vip.details.benefit.model', '全部模型'),
      desc: tt('vip.details.benefit.modelDesc', '解锁所有付费模型'),
    },
    {
      icon: 'headphones',
      title: tt('vip.details.benefit.support', '优先客服'),
      desc: tt('vip.details.benefit.supportDesc', '7×24 小时专属服务'),
    },
    {
      icon: 'users',
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
      {/* 顶部标题区(对齐 RN VipCompareScreen header:px20/py24,back 32 medium,title 40 bold) */}
      <View className="pt-[24rpx] px-[20rpx] pb-[24rpx]">
        <View className="flex items-center mb-[16rpx]" hoverClass="opacity-60" onClick={() => Taro.navigateBack()}>
          <Text className="text-[32rpx] text-[var(--color-text-medium)] leading-none mr-[24rpx]">
            ‹
          </Text>
          <Text className="text-[32rpx] text-[var(--color-text-medium)]">
            {tt('common.back', '返回')}
          </Text>
        </View>
        <Text className="block text-[40rpx] font-bold text-foreground">{t('vip.details.title')}</Text>
        <Text className="block text-[28rpx] mt-[16rpx] text-muted-foreground">
          {t('vip.upgrade.bannerDesc')}
        </Text>
      </View>

      <View className="mx-[20rpx]">
        <Text className="block text-[32rpx] font-bold text-foreground mb-[16rpx]">
          {tt('vip.details.benefitsTitle', '权益详情')}
        </Text>
        <View className="flex flex-col gap-[24rpx]">
          {BENEFIT_DETAILS.map((b) => (
            <View
              key={b.title}
              className="flex items-start bg-card border-[2rpx] border-border rounded-[24rpx] p-[28rpx]"
            >
              <View className="w-[64rpx] h-[64rpx] rounded-[16rpx] bg-[var(--color-gold-muted)] flex items-center justify-center mr-[24rpx] shrink-0">
                <LineIcon
                  name={b.icon as IconName}
                  size={36}
                  color="var(--color-warning)"
                />
              </View>
              <View className="flex-1 flex flex-col">
                <Text className="text-[32rpx] font-bold text-foreground">{b.title}</Text>
                <Text className="mt-[16rpx] text-[28rpx] text-muted-foreground leading-[36rpx]">
                  {b.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 套餐选择(对标原项目月度/年度卡片) */}
      <View className="m-[24rpx]">
        <Text className="block text-[32rpx] font-bold text-foreground mb-[16rpx]">
          {t('vip.plans')}
        </Text>
        <View className="flex gap-[20rpx]">
          {PLANS.map((p) => {
            const active = selectedPlan === p.type
            return (
              <ThemeRoot key={p.type}>
                <View
                  key={p.type}
                  className={`flex-1 relative bg-card border-[2rpx] rounded-[24rpx] py-[28rpx] px-[24rpx] ${active ? 'border-warning bg-[var(--color-warning-tint)]' : 'border-border'}`}
                  hoverClass="opacity-60"
                  onClick={() => selectPlan(p.type)}
                >
                  {p.type === 'yearly' ? (
                    <Text className="absolute top-[-2rpx] right-[-2rpx] bg-warning text-[var(--color-black-85)] text-[20rpx] py-[4rpx] px-[12rpx] rounded-tr-[22rpx] rounded-bl-[12rpx]">
                      {t('developer.subscribe.recommended')}
                    </Text>
                  ) : null}
                  <View className="flex flex-col mb-[16rpx]">
                    <Text className="text-[30rpx] font-bold text-foreground">
                      {planName(p.type)}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground mt-[6rpx]">
                      {p.days}
                      {t('page.vip.dayUnit')}
                    </Text>
                  </View>
                  <View className="flex items-start mb-[20rpx]">
                    <Text className="text-[26rpx] text-[var(--color-danger)] font-semibold leading-none mt-[8rpx]">
                      ¥
                    </Text>
                    <Text className="text-[40rpx] text-[var(--color-danger)] font-semibold leading-none ml-[4rpx]">
                      {p.price}
                    </Text>
                  </View>
                  <View className="flex flex-col gap-[10rpx]">
                    {p.benefits.map((b, i) => (
                      <View key={i} className="flex items-start">
                        <LineIcon
                          name="check"
                          size={24}
                          color="var(--color-muted-foreground)"
                          className="mr-[12rpx]"
                        />
                        <Text className="flex-1 text-[24rpx] text-foreground leading-[1.4]">
                          {b}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </ThemeRoot>
            )
          })}
        </View>
      </View>

      {/* 权益对比表(对齐 RN VipCompareScreen table:m32/border2/r24,表头与隔行 muted,cell 22) */}
      <View className="m-[32rpx] border-[2rpx] border-border rounded-[24rpx] overflow-hidden">
        <View className="flex items-stretch bg-muted">
          <Text className="flex-[1.2] py-[20rpx] px-[20rpx] text-left text-foreground font-semibold text-[22rpx]">
            {t('vip.details.feature')}
          </Text>
          <Text className="flex-1 py-[20rpx] px-[20rpx] text-center text-muted-foreground text-[22rpx]">
            {t('vip.details.normal')}
          </Text>
          <Text className="flex-1 py-[20rpx] px-[20rpx] text-center text-muted-foreground text-[22rpx]">
            {t('vip.details.vipColumn')}
          </Text>
        </View>
        {BENEFITS.map((b, i) => (
          <View
            key={b.label}
            className={`flex items-stretch ${i % 2 === 1 ? 'bg-muted' : ''}`}
          >
            <Text className="flex-[1.2] py-[20rpx] px-[20rpx] text-left text-foreground font-semibold text-[22rpx]">
              {b.label}
            </Text>
            <Text className="flex-1 py-[20rpx] px-[20rpx] text-center text-muted-foreground text-[22rpx]">
              {b.normal}
            </Text>
            <Text className="flex-1 py-[20rpx] px-[20rpx] text-center text-muted-foreground text-[22rpx]">
              {b.vip}
            </Text>
          </View>
        ))}
      </View>

      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] h-[88rpx] leading-[88rpx] bg-primary text-primary-foreground rounded-[24rpx] text-[32rpx] font-semibold"
        onClick={goUpgrade}
      >
        {t('vip.details.upgrade')}
      </Button>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
