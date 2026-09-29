// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'

export interface StreakDay {
  date: string
  signed: boolean
  isToday: boolean
}

export interface LearningStreakProps {
  streakDays: number
  totalSigned: number
  weekDays: StreakDay[]
  signedToday: boolean
  onSign?: () => void
}

export default function LearningStreak({
  streakDays,
  totalSigned,
  weekDays = [],
  signedToday,
  onSign,
}: LearningStreakProps) {
  const { t } = useI18n()
  const tt = useTt()
  return (
    <View className="bg-card rounded-lg px-4 py-4">
      <View className="flex items-center justify-between mb-3">
        <View className="flex items-center">
          <Text className="text-base font-semibold text-foreground">
            {tt('streak.title', '学习连签')}
          </Text>
          <View className="ml-2 flex items-center gap-1 text-xs text-warning">
            <LineIcon name="flame" size={24} color="var(--color-warning)" />
            <Text>{t('streak.continuousDays', { n: streakDays })}</Text>
          </View>
        </View>
        <Text className="text-xs text-muted-foreground">
          {t('streak.totalDays', { n: totalSigned })}
        </Text>
      </View>

      <View className="flex justify-between mb-4">
        {weekDays.map((day, idx) => (
          <View
            key={idx}
            className={`flex flex-col items-center justify-center w-9 h-12 rounded-lg ${
              day.signed
                ? 'bg-warning/10'
                : day.isToday
                  ? 'bg-muted border border-dashed border-border'
                  : 'bg-muted'
            }`}
          >
            <Text
              className={`text-[length:20rpx] ${day.signed ? 'text-warning' : 'text-muted-foreground'}`}
            >
              {day.date}
            </Text>
            {/* 已签到勾改为矢量图标(原载体是 U+2713 勾字符,当图标用);中点 U+00B7 是
                未签到的占位符、不是图标,按 §4 保留字符形态。size 28rpx = 原 text-sm(14px)
                同档,color 取原类名三元里 signed 分支的 text-warning。 */}
            {day.signed ? (
              <LineIcon name="check" size={28} color="var(--color-warning)" className="mt-[4rpx]" />
            ) : (
              <Text className="text-sm mt-[4rpx] text-muted-foreground">·</Text>
            )}
          </View>
        ))}
      </View>

      <View
        className={`w-full py-2 rounded-md text-center text-sm ${
          signedToday
            ? 'bg-muted text-muted-foreground'
            : 'bg-gradient-to-r from-[var(--color-brand-accent)] to-[var(--color-danger)] text-[var(--color-brand-accent-foreground)]'
        }`}
        onClick={() => !signedToday && onSign?.()}
        hoverClass="opacity-60"
      >
        {signedToday
          ? tt('streak.signedToday', '今日已签到')
          : tt('streak.signNow', '立即签到 +5 积分')}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
