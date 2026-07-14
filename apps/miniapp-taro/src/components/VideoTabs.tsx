import { View, Text } from '@tarojs/components'

export type VideoTabKey = 'catalog' | 'intro' | 'comment'

export interface VideoTabItem {
  key: VideoTabKey
  label: string
  count?: number
}

export interface VideoTabsProps {
  tabs?: VideoTabItem[]
  active?: VideoTabKey
  onChange?: (key: VideoTabKey) => void
}

const DEFAULT_TABS: VideoTabItem[] = [
  { key: 'catalog', label: '目录' },
  { key: 'intro', label: '简介' },
  { key: 'comment', label: '评论' },
]

export default function VideoTabs({
  tabs = DEFAULT_TABS,
  active = 'catalog',
  onChange,
}: VideoTabsProps) {
  return (
    <View className="flex bg-white border-b border-gray-100">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <View
            key={tab.key}
            className="flex-1 flex items-center justify-center py-3"
            onClick={() => onChange?.(tab.key)}
          >
            <Text
              className={`text-sm ${isActive ? 'text-indigo-600 font-medium' : 'text-gray-500'}`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <Text className="text-xs ml-1 text-gray-400">{tab.count}</Text>
              )}
            </Text>
            {isActive && (
              <View
                className="absolute bottom-0"
                style={{ width: '24px', height: '2px', backgroundColor: '#6366f1' }}
              />
            )}
          </View>
        )
      })}
    </View>
  )
}
