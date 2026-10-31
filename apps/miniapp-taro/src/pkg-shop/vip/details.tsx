// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/vip-compare/VipCompareScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon, { type IconName } from '@/components/LineIcon'
import { formatPrice } from '@ihui/shared/utils/format'
import CompareTable from './compare-table'

// 套餐方案(对标原 vip/details.vue 月度¥39.9/30天 + 年度¥299/365天;
// price 单位为「分」,与 GET /vip/levels 的库里列同源(0037_vip_captcha.sql 种 3990/29900),
// 展示一律走 formatPrice(守门 248:分→元只许这一个出口)
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
      price: 3990,
      days: 30,
      benefits: [
        t('vip.details.features.chatCount') + ': ' + t('vip.details.features.vipColumn'),
        t('vip.details.features.drawCount'),
        t('vip.details.features.prioritySupport'),
      ],
    },
    {
      type: 'yearly',
      price: 29900,
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
    // price 透传「分」,与 /vip/levels 的 price 列同单位(升级页现读不消费该参数,自行拉取档位)
    Taro.navigateTo({
      url: `/pkg-shop/vip/upgrade?plan=${plan.type}&price=${plan.price}&days=${plan.days}`,
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
        <Text className="block text-[length:40rpx] font-bold text-foreground">
          {t('vip.details.title')}
        </Text>
        <Text className="block text-body mt-[16rpx] text-muted-foreground">
          {t('vip.upgrade.bannerDesc')}
        </Text>
      </View>

      <View className="mx-[20rpx]">
        <Text className="block text-[length:32rpx] font-bold text-foreground mb-[16rpx]">
          {tt('vip.details.benefitsTitle', '权益详情')}
        </Text>
        <View className="flex flex-col gap-[24rpx]">
          {BENEFIT_DETAILS.map((b) => (
            <View
              key={b.title}
              className="flex items-start bg-card border-[length:2rpx] border-border rounded-lg p-[28rpx]"
            >
              <View className="w-[64rpx] h-[64rpx] rounded-lg bg-[var(--color-gold-muted)] flex items-center justify-center mr-[24rpx] shrink-0">
                <LineIcon name={b.icon as IconName} size={36} color="var(--color-warning)" />
              </View>
              <View className="flex-1 flex flex-col">
                <Text className="text-[length:32rpx] font-bold text-foreground">{b.title}</Text>
                <Text className="mt-[16rpx] text-body text-muted-foreground leading-[36rpx]">
                  {b.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 套餐选择(对标原项目月度/年度卡片) */}
      <View className="m-[24rpx]">
        <Text className="block text-[length:32rpx] font-bold text-foreground mb-[16rpx]">
          {t('vip.plans')}
        </Text>
        <View className="flex gap-[20rpx]">
          {PLANS.map((p) => {
            const active = selectedPlan === p.type
            return (
              <ThemeRoot key={p.type}>
                <View
                  key={p.type}
                  className={`flex-1 relative bg-card border-[length:2rpx] rounded-xl py-[28rpx] px-[24rpx] ${active ? 'border-warning bg-[var(--color-warning-tint)]' : 'border-border'}`}
                  hoverClass="opacity-60"
                  onClick={() => selectPlan(p.type)}
                >
                  {p.type === 'yearly' ? (
                    <Text className="absolute top-[-2rpx] right-[-2rpx] bg-warning text-[var(--color-black-85)] text-[length:20rpx] py-[4rpx] px-[12rpx] rounded-tr-xl rounded-bl-md">
                      {t('developer.subscribe.recommended')}
                    </Text>
                  ) : null}
                  <View className="flex flex-col mb-[16rpx]">
                    <Text className="text-[length:30rpx] font-bold text-foreground">
                      {planName(p.type)}
                    </Text>
                    <Text className="text-label text-muted-foreground mt-[6rpx]">
                      {p.days}
                      {t('page.vip.dayUnit')}
                    </Text>
                  </View>
                  <View className="flex items-start mb-[20rpx]">
                    <Text className="text-[length:26rpx] text-[var(--color-danger)] font-semibold leading-none mt-[8rpx]">
                      ¥
                    </Text>
                    <Text className="text-heading text-[var(--color-danger)] font-semibold leading-none ml-[4rpx]">
                      {formatPrice(p.price)}
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
                        <Text className="flex-1 text-label text-foreground leading-[1.4]">
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

      {/* 会员对比表(镜像 RN VipCompareScreen 的 table:四列表头 + 后端三档取值,同目录 ./compare-table) */}
      <View className="mx-[32rpx] my-[32rpx]">
        <Text className="block text-[length:32rpx] font-bold text-foreground mb-[16rpx]">
          {t('vipCompare.title')}
        </Text>
        <CompareTable />
      </View>

      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] h-[88rpx] leading-[88rpx] bg-cta text-cta-foreground rounded-sm text-title font-semibold"
        onClick={goUpgrade}
      >
        {t('vip.details.upgrade')}
      </Button>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
