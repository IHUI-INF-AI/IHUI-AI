import { View, Text, Switch } from '@tarojs/components'

export interface NotificationSettingItem {
  key: string
  label: string
  desc?: string
  enabled: boolean
}

export interface NotificationSettingsProps {
  items: NotificationSettingItem[]
  onToggle: (key: string, enabled: boolean) => void
}

export default function NotificationSettings({ items = [], onToggle }: NotificationSettingsProps) {
  return (
    <View className="bg-white">
      <View className="px-4 pt-3 pb-2">
        <Text className="text-xs text-gray-400">通知设置</Text>
      </View>
      {items.map((item, idx) => (
        <View
          key={item.key}
          className={`flex items-center px-4 py-3 ${
            idx !== items.length - 1 ? 'border-b border-gray-50' : ''
          }`}
        >
          <View className="flex-1 min-w-0">
            <Text className="text-sm text-gray-800">{item.label}</Text>
            {item.desc && <Text className="block text-xs text-gray-400 mt-0.5">{item.desc}</Text>}
          </View>
          <Switch
            checked={item.enabled}
            color="#10b981"
            onChange={(e) => onToggle(item.key, e.detail.value)}
          />
        </View>
      ))}
    </View>
  )
}
