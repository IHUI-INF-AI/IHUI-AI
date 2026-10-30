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
 *
 * 取证@2026-10-30(可达性复核,三选一逐键结论见交付报告):
 * - 三入口 url 全部在册且页面存在:app.config.ts:255-260(root pages/distribution +
 *   team/commission/withdraw)⇒ pages/distribution/team.tsx:40 / commission.tsx:23 /
 *   withdraw.tsx:16,同 url 已有既成用法(pages/distribution/index.tsx:142、
 *   company/company-constants.ts:39-41)⇒ 非死按钮。
 * - `benefitCount` 的 N 绑的是**本页正在渲染的那张列表**(index.tsx 的 TRADER_FEATURES),
 *   区头与行数列恒自洽;而该列表是端内常量 8 项,与后端权益集不同集合
 *   (后端 10 项:0037_vip_captcha.sql:60,端内缺 allVipRights/secondaryDistribution/
 *   offlineLearning 三档文案键;端内多一项「赠送算力」后端无对应 key)。
 *   ⇒ 计数不冒充后端真值,集合差另归后端/词包席,不在此处改数冒充。
 */
import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import LineIcon, { type IconName } from '@/components/LineIcon'

/**
 * 共享屏 heroDesc 的 {power} 占位值:与 RN 常量逐字同值
 * (packages/app/src/features/vip-trader/VipTraderScreen.tsx:70,消费点 :88 与 :147)。
 *
 * ⚠️ 取证@2026-10-30(可达性复核):这个数**不来自任何后端权益配置**,只是跨端同一份营销常量——
 * 后端权益目录 apps/api/src/routes/landing.ts:376-392 共 15 个 benefit key,没有任何算力项;
 * 操盘手档的 benefits 实值 packages/database/drizzle/0037_vip_captcha.sql:60 共 10 项,同样没有;
 * 档位配额列只有 aiBudgetDefaults/apiQps/maxConcurrency/modelWhitelist
 * (packages/database/drizzle/20260728120000_vip_levels_quota_fields.sql:25-34)。
 * ⇒ 不得把 1600W 当服务端权益真值消费(要接真值须先由后端立 benefit key);
 *   值本身保持与共享屏同常量,以免镜像对齐面反向漂移。
 */
const TRADER_POWER = '1600W'

/**
 * 「终身」在后端是**时长档**,不是布尔列:vip_levels 只有 duration_days
 * (终身档 永久会员 = 36500 天,packages/database/drizzle/0037_vip_captcha.sql:59),
 * 购买时按该列算到期时间 endTime(apps/api/src/db/vip-queries.ts:109)。
 * 故判终身只能按时长档,不能照抄文案。
 */
export const LIFETIME_DURATION_DAYS = 36500

/**
 * 有效期一行(2026-10-30 可达性取证施工):
 * 「终身有效 / 终身使用」原先无条件渲染,而库内操盘手档 duration_days=30
 * (0037_vip_captcha.sql:60)⇒ 对这一档那句话与后端权益配置不符,属错文案。
 * 现按真值出话:终身档显式 lifetime,其余档一律用服务端天数(vip.duration,五语言齐备、
 * 同族页 pkg-shop/vip/levels-section.tsx:63 同一用法)。
 * 判据只这一处(两消费方各写自己的 tt(...) 调用形,键名不许藏进参数 ——
 * 还原度门按调用形认键,包一层传键名即读成缺失)。
 */
export function isLifetimeDuration(days: number): boolean {
  return days >= LIFETIME_DURATION_DAYS
}

/** 页头 + hero 卡:title / subtitle / badge / heroDesc / lifetime */
export function TraderHero({ amount, durationDays }: { amount: number; durationDays: number }) {
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
          {isLifetimeDuration(durationDays)
            ? tt('vipTrader.lifetime', '终身有效')
            : tt('vip.duration', '{days} 天', { days: durationDays })}
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
  // `count` 由调用方按**本页实际渲染的列表长度**传入(TRADER_FEATURES.length),
  // 区头与下方行数同批同源;不拿后端 benefits 长度来填,那样数字会大于可见行数。
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
