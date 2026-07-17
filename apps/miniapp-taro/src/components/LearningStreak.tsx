import { View, Text } from '@tarojs/components'

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
  return (
    <View className="bg-white rounded-xl px-4 py-4">
      <View className="flex items-center justify-between mb-3">
        <View className="flex items-center">
          <Text className="text-base font-semibold text-gray-800">学习连签</Text>
          <Text className="ml-2 text-xs text-orange-500">🔥 连续 {streakDays} 天</Text>
        </View>
        <Text className="text-xs text-gray-400">累计 {totalSigned} 天</Text>
      </View>

      <View className="flex justify-between mb-4">
        {weekDays.map((day, idx) => (
          <View
            key={idx}
            className={`flex flex-col items-center justify-center w-9 h-12 rounded-lg ${
              day.signed
                ? 'bg-orange-50'
                : day.isToday
                  ? 'bg-gray-100 border border-dashed border-gray-300'
                  : 'bg-gray-50'
            }`}
          >
            <Text className={`text-[10px] ${day.signed ? 'text-orange-500' : 'text-gray-400'}`}>
              {day.date}
            </Text>
            <Text className={`text-sm mt-0.5 ${day.signed ? 'text-orange-500' : 'text-gray-300'}`}>
              {day.signed ? '✓' : '·'}
            </Text>
          </View>
        ))}
      </View>

      <View
        className={`w-full py-2 rounded-md text-center text-sm ${
          signedToday
            ? 'bg-gray-100 text-gray-400'
            : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
        }`}
        onClick={() => !signedToday && onSign?.()}
      >
        {signedToday ? '今日已签到' : '立即签到 +5 积分'}
      </View>
    </View>
  )
}
