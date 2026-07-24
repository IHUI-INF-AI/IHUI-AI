import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'

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
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  return (
    <View className="bg-card rounded-xl px-4 py-4">
      <View className="flex items-center justify-between mb-3">
        <View className="flex items-center">
          <Text className="text-base font-semibold text-foreground">{tt('streak.title', '学习连签')}</Text>
          <Text className="ml-2 text-xs text-[#f59e0b]">🔥 {tt('streak.continuousDays', '连续 {{n}} 天').replace('{{n}}', String(streakDays))}</Text>
        </View>
        <Text className="text-xs text-muted-foreground">{t('streak.totalDays', { n: totalSigned })}</Text>
      </View>

      <View className="flex justify-between mb-4">
        {weekDays.map((day, idx) => (
          <View
            key={idx}
            className={`flex flex-col items-center justify-center w-9 h-12 rounded-lg ${
              day.signed
                ? 'bg-[#f59e0b]/10'
                : day.isToday
                  ? 'bg-muted border border-dashed border-border'
                  : 'bg-muted'
            }`}
          >
            <Text className={`text-[10px] ${day.signed ? 'text-[#f59e0b]' : 'text-muted-foreground'}`}>
              {day.date}
            </Text>
            <Text className={`text-sm mt-0.5 ${day.signed ? 'text-[#f59e0b]' : 'text-muted-foreground'}`}>
              {day.signed ? '✓' : '·'}
            </Text>
          </View>
        ))}
      </View>

      <View
        className={`w-full py-2 rounded-md text-center text-sm ${
          signedToday
            ? 'bg-muted text-muted-foreground'
            : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
        }`}
        onClick={() => !signedToday && onSign?.()}
      >
        {signedToday ? tt('streak.signedToday', '今日已签到') : tt('streak.signNow', '立即签到 +5 积分')}
      </View>
    </View>
  )
}
