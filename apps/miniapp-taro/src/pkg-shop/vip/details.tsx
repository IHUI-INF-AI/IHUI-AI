// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/vip-compare/VipCompareScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import ThemeRoot from '@/components/ThemeRoot'
import { MessageCircle, Palette, Film, Bot, Headset, Users } from 'lucide-react-native'
import type { VipBenefitCardItem, VipPlanOption } from '@ihui/types'
import { VipBenefitsSection, VipPlansSection } from '@ihui/rn-app/features/vip/VipSections'
import CompareTable from './compare-table'

// 套餐方案(对标原 vip/details.vue 月度¥39.9/30天 + 年度¥299/365天)。
// 卡面渲染已下沉共享 VipPlansSection;本页只保留取词与升级跳转。

export default function VipDetailsPage() {
  const { t } = useI18n()
  // i18n key 不存在时回退到中文文案(任务约束允许的 tt 模式)
  const tt = (key: string, fallback: string) => {
    const v = t(key)
    return v === key ? fallback : v
  }
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly')

  // 权益详情:视图段委托共享 VipBenefitsSection(压掉手抄副本),本端只保留取词
  const BENEFIT_DETAILS: VipBenefitCardItem[] = [
    {
      key: 'chat',
      icon: MessageCircle,
      title: tt('vip.details.benefit.chat', '无限 AI 对话'),
      desc: tt('vip.details.benefit.chatDesc', '畅享顶级模型,不限次数'),
    },
    {
      key: 'draw',
      icon: Palette,
      title: tt('vip.details.benefit.draw', 'AI 绘图'),
      desc: tt('vip.details.benefit.drawDesc', '100次/天,高清无水印'),
    },
    {
      key: 'video',
      icon: Film,
      title: tt('vip.details.benefit.video', '视频生成'),
      desc: tt('vip.details.benefit.videoDesc', '60分钟视频生成时长'),
    },
    {
      key: 'model',
      icon: Bot,
      title: tt('vip.details.benefit.model', '全部模型'),
      desc: tt('vip.details.benefit.modelDesc', '解锁所有付费模型'),
    },
    {
      key: 'support',
      icon: Headset,
      title: tt('vip.details.benefit.support', '优先客服'),
      desc: tt('vip.details.benefit.supportDesc', '7×24 小时专属服务'),
    },
    {
      key: 'group',
      icon: Users,
      title: tt('vip.details.benefit.group', '专属社群'),
      desc: tt('vip.details.benefit.groupDesc', 'VIP 会员专属交流群'),
    },
  ]

  const planName = (type: 'monthly' | 'yearly') =>
    type === 'yearly'
      ? tt('vip.details.yearlyPlan', '年度会员')
      : tt('vip.details.monthlyPlan', '月度会员')

  // 套餐档位:数据仍由本端取词,卡面渲染委托共享 VipPlansSection。
  // price 为「元」,与共享 VipPlanOption 契约一致(共享卡按元展示)。
  const PLAN_OPTIONS: VipPlanOption[] = [
    {
      id: 'monthly',
      name: planName('monthly'),
      price: 39.9,
      period: `30${t('page.vip.dayUnit')}`,
      features: [
        t('vip.details.features.chatCount') + ': ' + t('vip.details.features.vipColumn'),
        t('vip.details.features.drawCount'),
        t('vip.details.features.prioritySupport'),
      ],
    },
    {
      id: 'yearly',
      name: planName('yearly'),
      price: 299,
      period: `365${t('page.vip.dayUnit')}`,
      badge: t('developer.subscribe.recommended'),
      features: [
        tt('vip.details.monthlyAllBenefits', '月度会员所有权益'),
        t('vip.details.features.exclusiveGroup'),
        t('vip.details.features.modelAccess'),
        tt('vip.details.highCommission', '高额返佣特权'),
      ],
    },
  ]

  const goUpgrade = () => {
    const plan = PLAN_OPTIONS.find((p) => p.id === selectedPlan) ?? PLAN_OPTIONS[0]
    if (!plan) return
    // 升级页现读自行拉取档位,这里只透传档位标识与天数(price 为元,与升级页同口径)
    Taro.navigateTo({
      url: `/pkg-shop/vip/upgrade?plan=${plan.id}&price=${Math.round(plan.price * 100)}&days=${plan.id === 'yearly' ? 365 : 30}`,
    })
  }

  /** 共享套餐卡的选中态回调:把 id 折回本页维度的联合类型 */
  const selectPlanById = (id: string) => {
    if (id === 'monthly' || id === 'yearly') setSelectedPlan(id)
  }

  return (
    <ThemeRoot className="min-h-screen bg-background pb-[140rpx]">
      {/* 顶部标题区(对齐 RN VipCompareScreen header:px20/py24,back 32 medium,title 40 bold) */}
      <View className="pt-[24rpx] px-[20rpx] pb-[24rpx]">
        <Text className="block text-heading font-bold text-foreground">
          {t('vip.details.title')}
        </Text>
        <Text className="block text-body mt-[16rpx] text-muted-foreground">
          {t('vip.upgrade.bannerDesc')}
        </Text>
      </View>

      {/* 权益详情:整段视图委托共享 VipBenefitsSection(三端同一份实现) */}
      <VipBenefitsSection t={t} items={BENEFIT_DETAILS} colorScheme="light" />

      {/* 套餐选择:整段委托共享 VipPlansSection(角标/逐条权益槽位已下沉,三端同一份实现) */}
      <VipPlansSection
        plans={{
          title: t('vip.plans'),
          options: PLAN_OPTIONS,
          selectedId: selectedPlan,
          onSelect: selectPlanById,
        }}
        colorScheme="light"
      />

      {/* 会员对比表(镜像 RN VipCompareScreen 的 table:四列表头 + 后端三档取值,同目录 ./compare-table) */}
      <View className="mx-[32rpx] my-[32rpx]">
        <Text className="block text-title font-bold text-foreground mb-[16rpx]">
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
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
