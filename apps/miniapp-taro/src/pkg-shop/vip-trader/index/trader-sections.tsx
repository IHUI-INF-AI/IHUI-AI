// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VIP 操盘手页 — 对齐 RN 共享屏的补齐分区(2026-10-29 还原度补齐)
 *
 * 对齐目标:packages/app/src/features/vip-trader/VipTraderScreen.tsx
 *
 * 本页原先把「简介 / 能力 / 业绩 / 服务包 / 评价」写全了,而共享屏的
 * 页头(title + subtitle)、hero 卡(badge / heroDesc / lifetime)、三入口
 * (entryTeam / entryStats / entryWithdraw)、权益区头(benefits / benefitCount)
 * 四块在端内一个元素都没有 —— 还原度门因此记 10 个缺口。
 * 这里按共享屏的结构最小补齐,文案键**一律复用共享屏那套**
 * (词条已在 packages/i18n/messages/miniapp-taro/ 五语言齐备),不新造键、不写死中文。
 *
 * 三入口的去向取端内真实存在的分销子包页(与 pages/distribution/index.tsx 同一批路由),
 * 不做点了没反应的死按钮;这是端内既有能力,共享屏因平台无关而不带导航。
 */
import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import LineIcon, { type IconName } from '@/components/LineIcon'

/** 共享屏 heroDesc 的 {power} 占位值(RN 端常量 TRADER_POWER,同一句文案同一口径) */
const TRADER_POWER = '1600W'

/** 页头 + hero 卡:title / subtitle / badge / heroDesc / lifetime */
export function TraderHero({ amount }: { amount: number }) {
  const tt = useTt()
  const price = amount.toLocaleString()
  return (
    <View>
      <View className="px-[32rpx] pt-[24rpx]">
        <Text className="block text-[length:40rpx] font-bold text-foreground">
          {tt('vipTrader.title', 'VIP 操盘手')}
        </Text>
        <Text className="block mt-[8rpx] text-[length:26rpx] text-muted-foreground">
          {tt('vipTrader.subtitle', '尊享操盘手专属权益')}
        </Text>
      </View>

      <View className="trader-section">
        <View className="flex flex-row items-center">
          <View className="px-[20rpx] py-[8rpx] rounded-md bg-[var(--color-vip-gold-tint)]">
            <Text className="text-[length:22rpx] font-semibold text-[var(--color-warning)]">
              {tt('vipTrader.badge', '操盘手专属')}
            </Text>
          </View>
        </View>
        <Text className="block mt-[16rpx] text-[length:26rpx] leading-[40rpx] text-muted-foreground">
          {tt(
            'vipTrader.heroDesc',
            '限时 ¥{price} 开通,赠送 {power} 算力,尊享大额分销与专属定制权益',
            { price, power: TRADER_POWER },
          )}
        </Text>
        <Text className="block mt-[12rpx] text-[length:24rpx] text-muted-foreground">
          {tt('vipTrader.lifetime', '终身有效')}
        </Text>
      </View>
    </View>
  )
}

/** 共享屏三入口:我的团队 / 收益统计 / 去提现 */
export function TraderEntries() {
  const tt = useTt()
  const entries: Array<{ icon: IconName; label: string; url: string }> = [
    {
      icon: 'users',
      label: tt('vipTrader.entryTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: 'bar-chart-3',
      label: tt('vipTrader.entryStats', '收益统计'),
      url: '/pages/distribution/commission',
    },
    {
      icon: 'wallet',
      label: tt('vipTrader.entryWithdraw', '去提现'),
      url: '/pages/distribution/withdraw',
    },
  ]
  return (
    <View className="flex flex-row gap-[16rpx] mx-[32rpx] mt-[24rpx]">
      {entries.map((e) => (
        <View
          key={e.url}
          className="flex-1 flex flex-col items-center py-[24rpx] rounded-md bg-muted"
          hoverClass="opacity-60"
          onClick={() => Taro.navigateTo({ url: e.url })}
        >
          <LineIcon name={e.icon} size={40} color="var(--color-text-medium)" />
          <Text className="mt-[8rpx] text-[length:26rpx] text-[var(--color-text-medium)]">
            {e.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

/** 权益区头:section 标题 + 条目计数(共享屏 sectionHead 同结构) */
export function BenefitsHead({ count }: { count: number }) {
  const tt = useTt()
  return (
    <View className="flex flex-row items-center justify-between mb-[20rpx]">
      <Text className="text-[length:32rpx] font-semibold text-foreground">
        {tt('vipTrader.benefits', '专属权益')}
      </Text>
      <Text className="text-[length:22rpx] text-muted-foreground">
        {tt('vipTrader.benefitCount', '共 {count} 项', { count })}
      </Text>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
