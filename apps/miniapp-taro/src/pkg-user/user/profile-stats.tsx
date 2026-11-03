// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'

/**
 * 个人中心统计网格 — 对齐共享屏 packages/app/src/features/profile/ProfileScreen.tsx 的 statsGrid:
 * 六格(课程 / 收藏 / 关注 / 粉丝 / 订单 / 智汇值),顺序与 buildStatsCells 一致。
 * 读数缺失渲染 '--' 而不是 0:共享屏的 `?? 0` 把「请求失败/没这格」和「确实是 0」压成同一个数,
 * 小程序这侧不跟 —— 取不到就说取不到(标签照常渲染,六格信息层级不变)。
 */
export interface ProfileStats {
  courseCount: number
  favoriteCount: number
  followingCount: number
  fansCount: number
  points: number
}

/** 一格读数:null = 未取到(渲染 '--'),数字 = 后端真值 */
function cellValue(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '--' : String(v)
}

export default function ProfileStatsGrid({
  stats,
  orderCount,
}: {
  stats: ProfileStats | null
  orderCount: number | null
}) {
  const { t } = useI18n()
  const cells = [
    { key: 'courses', label: t('profile.myCourses'), value: cellValue(stats?.courseCount) },
    { key: 'favorites', label: t('profile.myFavorites'), value: cellValue(stats?.favoriteCount) },
    { key: 'following', label: t('community.follow'), value: cellValue(stats?.followingCount) },
    { key: 'fans', label: t('community.follower'), value: cellValue(stats?.fansCount) },
    { key: 'orders', label: t('profile.myOrders'), value: cellValue(orderCount) },
    { key: 'points', label: t('wallet.points'), value: cellValue(stats?.points) },
  ]
  return (
    <View className="flex flex-wrap gap-[16rpx] mb-[32rpx]">
      {cells.map((cell) => (
        <View
          key={cell.key}
          className="flex flex-1 flex-col items-center justify-center min-w-[200rpx] py-[24rpx] bg-muted rounded-lg"
        >
          <Text className="text-subtitle font-semibold text-foreground">{cell.value}</Text>
          <Text className="mt-[8rpx] text-label text-muted-foreground">{cell.label}</Text>
        </View>
      ))}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
