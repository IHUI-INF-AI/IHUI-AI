import { View, Text } from '@tarojs/components'
import ProgressCircle from './ProgressCircle'

export interface StudyStatsData {
  totalMinutes?: number
  totalLessons?: number
  streakDays?: number
  weekMinutes?: number
  weekTarget?: number
}

export interface StudyStatsProps {
  data?: StudyStatsData
}

export default function StudyStats({ data = {} }: StudyStatsProps) {
  const {
    totalMinutes = 0,
    totalLessons = 0,
    streakDays = 0,
    weekMinutes = 0,
    weekTarget = 300,
  } = data

  const weekPercent = weekTarget > 0 ? (weekMinutes / weekTarget) * 100 : 0

  return (
    <View className="bg-card mx-3 my-3 rounded-xl p-4">
      <Text className="block text-sm font-medium text-foreground mb-3">学习数据</Text>

      <View className="flex items-center mb-4">
        <ProgressCircle percent={weekPercent} size={70} showText text={`${weekMinutes}m`} />
        <View className="ml-4 flex-1">
          <Text className="block text-xs text-muted-foreground">本周学习</Text>
          <Text className="text-base font-medium text-foreground">
            {Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m
          </Text>
          <Text className="block text-xs text-muted-foreground mt-1">
            目标 {Math.floor(weekTarget / 60)}h,已完成 {Math.floor(weekPercent)}%
          </Text>
        </View>
      </View>

      <View className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
        <View className="text-center">
          <Text className="block text-base font-medium text-primary">{totalLessons}</Text>
          <Text className="block text-xs text-muted-foreground">完成课时</Text>
        </View>
        <View className="text-center">
          <Text className="block text-base font-medium text-[#f59e0b]">
            {Math.floor(totalMinutes / 60)}h
          </Text>
          <Text className="block text-xs text-muted-foreground">累计时长</Text>
        </View>
        <View className="text-center">
          <Text className="block text-base font-medium text-destructive">{streakDays}</Text>
          <Text className="block text-xs text-muted-foreground">连续天数</Text>
        </View>
      </View>
    </View>
  )
}
