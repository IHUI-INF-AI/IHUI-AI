import { Text, View } from 'react-native'

interface VipBadgeProps {
  size?: 'sm' | 'md'
  label?: string
}

export function VipBadge({ size = 'sm', label = 'VIP' }: VipBadgeProps) {
  const sizing = size === 'md' ? 'px-2.5 py-1 text-xs gap-1' : 'px-2 py-0.5 text-xs gap-0.5'
  return (
    <View className={`flex-row items-center rounded-md bg-amber-500/10 ${sizing}`}>
      <Text className="text-xs font-medium text-amber-600">{label}</Text>
    </View>
  )
}
