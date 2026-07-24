import { View, Text, Image } from '@tarojs/components'
import { useI18n } from '@/i18n'

export interface SystemNoticeItem {
  id: string
  title: string
  content: string
  type?: 'system' | 'activity' | 'upgrade'
  createdAt: string
  read: boolean
  cover?: string
}

export interface SystemNoticeProps {
  list: SystemNoticeItem[]
  onClick?: (item: SystemNoticeItem) => void
}

const TYPE_LABEL: Record<string, string> = {
  system: '系统',
  activity: '活动',
  upgrade: '升级',
}

const TYPE_STYLE: Record<string, string> = {
  system: 'bg-primary/10 text-primary',
  activity: 'bg-[#f59e0b]/10 text-[#f59e0b]',
  upgrade: 'bg-primary/10 text-primary',
}

export default function SystemNotice({ list, onClick }: SystemNoticeProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  if (!list.length) {
    return (
      <View className="flex items-center justify-center py-16">
        <Text className="text-sm text-muted-foreground">{tt('message.noSystem', '暂无系统通知')}</Text>
      </View>
    )
  }

  return (
    <View className="px-3 py-2">
      {list.map((item) => (
        <View
          key={item.id}
          className="flex bg-card rounded-xl p-3 mb-2"
          onClick={() => onClick?.(item)}
        >
          {item.cover && (
            <Image
              src={item.cover}
              className="w-12 h-12 rounded-lg mr-3 bg-muted"
              mode="aspectFill"
            />
          )}
          <View className="flex-1 min-w-0">
            <View className="flex items-center">
              {item.type && (
                <Text
                  className={`text-[10px] px-1.5 py-0.5 rounded mr-2 ${
                    TYPE_STYLE[item.type] || TYPE_STYLE.system
                  }`}
                >
                  {TYPE_LABEL[item.type] || '系统'}
                </Text>
              )}
              <Text className="text-sm font-medium text-foreground truncate flex-1">
                {item.title}
              </Text>
              {!item.read && <View className="w-2 h-2 rounded-full bg-destructive ml-2" />}
            </View>
            <Text className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.content}</Text>
            <Text className="text-[10px] text-muted-foreground mt-1">{item.createdAt}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
