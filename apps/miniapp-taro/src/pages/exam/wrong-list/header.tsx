// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { Text, View } from '@tarojs/components'

export interface WrongStats {
  total: number
  unresolved: number
  resolved: number
}

export type WrongFilter = 'all' | 'unresolved' | 'resolved'

export const WRONG_FILTERS: WrongFilter[] = ['all', 'unresolved', 'resolved']

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export function StatsBar({ stats }: { stats: WrongStats | null }) {
  const { t } = useI18n()
  return (
    <View className="px-[20rpx] flex flex-row gap-[16rpx]">
      <View className="flex-1 bg-card rounded-lg p-[20rpx] border border-solid border-border">
        <Text className="block text-[length:36rpx] font-semibold text-foreground">
          {stats?.total ?? 0}
        </Text>
        <Text className="block text-[length:24rpx] text-muted-foreground mt-[6rpx]">
          {t('wrongQuestions.statsTotal')}
        </Text>
      </View>
      <View className="flex-1 bg-card rounded-lg p-[20rpx] border border-solid border-border">
        <Text className="block text-[length:36rpx] font-semibold text-foreground">
          {stats?.unresolved ?? 0}
        </Text>
        <Text className="block text-[length:24rpx] text-muted-foreground mt-[6rpx]">
          {t('wrongQuestions.statsUnresolved')}
        </Text>
      </View>
      <View className="flex-1 bg-card rounded-lg p-[20rpx] border border-solid border-border">
        <Text className="block text-[length:36rpx] font-semibold text-foreground">
          {stats?.resolved ?? 0}
        </Text>
        <Text className="block text-[length:24rpx] text-muted-foreground mt-[6rpx]">
          {t('wrongQuestions.statsResolved')}
        </Text>
      </View>
    </View>
  )
}

export function FilterChips({
  filter,
  onChange,
}: {
  filter: WrongFilter
  onChange: (next: WrongFilter) => void
}) {
  const { t } = useI18n()
  return (
    <View className="flex flex-row gap-[12rpx] px-[20rpx] mt-[20rpx]">
      {WRONG_FILTERS.map((f) => (
        <View
          key={f}
          className={`px-[24rpx] py-[10rpx] rounded-md ${
            filter === f ? 'bg-primary' : 'bg-card border border-solid border-border'
          }`}
          hoverClass="opacity-60"
          onClick={() => onChange(f)}
        >
          <Text
            className={`text-[length:26rpx] ${
              filter === f ? 'text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            {f === 'all'
              ? t('wrongQuestions.filterAll')
              : f === 'unresolved'
                ? t('wrongQuestions.filterUnresolved')
                : t('wrongQuestions.filterResolved')}
          </Text>
        </View>
      ))}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
