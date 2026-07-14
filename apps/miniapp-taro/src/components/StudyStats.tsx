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
    <View className="bg-white mx-3 my-3 rounded-xl p-4">
      <Text className="block text-sm font-medium text-gray-800 mb-3">学习数据</Text>

      <View className="flex items-center mb-4">
        <ProgressCircle percent={weekPercent} size={70} showText text={`${weekMinutes}m`} />
        <View className="ml-4 flex-1">
          <Text className="block text-xs text-gray-400">本周学习</Text>
          <Text className="text-base font-medium text-gray-800">
            {Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m
          </Text>
          <Text className="block text-xs text-gray-400 mt-1">
            目标 {Math.floor(weekTarget / 60)}h,已完成 {Math.floor(weekPercent)}%
          </Text>
        </View>
      </View>

      <View className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
        <View className="text-center">
          <Text className="block text-base font-medium text-indigo-600">{totalLessons}</Text>
          <Text className="block text-xs text-gray-400">完成课时</Text>
        </View>
        <View className="text-center">
          <Text className="block text-base font-medium text-orange-500">
            {Math.floor(totalMinutes / 60)}h
          </Text>
          <Text className="block text-xs text-gray-400">累计时长</Text>
        </View>
        <View className="text-center">
          <Text className="block text-base font-medium text-red-500">{streakDays}</Text>
          <Text className="block text-xs text-gray-400">连续天数</Text>
        </View>
      </View>
    </View>
  )
}
