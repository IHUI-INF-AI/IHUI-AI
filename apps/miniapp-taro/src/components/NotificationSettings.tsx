import { View, Text, Switch } from '@tarojs/components'
import { useI18n } from '@/i18n'

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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  return (
    <View className="bg-card">
      <View className="px-4 pt-3 pb-2">
        <Text className="text-xs text-muted-foreground">{tt('notification.settings', '通知设置')}</Text>
      </View>
      {items.map((item, idx) => (
        <View
          key={item.key}
          className={`flex items-center px-4 py-3 ${
            idx !== items.length - 1 ? 'border-b border-border' : ''
          }`}
        >
          <View className="flex-1 min-w-0">
            <Text className="text-sm text-foreground">{item.label}</Text>
            {item.desc && <Text className="block text-xs text-muted-foreground mt-0.5">{item.desc}</Text>}
          </View>
          <Switch
            checked={item.enabled}
            color="#00f2ff"
            onChange={(e) => onToggle(item.key, e.detail.value)}
          />
        </View>
      ))}
    </View>
  )
}
