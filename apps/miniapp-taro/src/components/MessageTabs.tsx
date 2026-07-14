import { View, Text, ScrollView } from '@tarojs/components'

export interface MessageTabItem {
  key: string
  label: string
  unread?: number
}

export interface MessageTabsProps {
  tabs: MessageTabItem[]
  active: string
  onChange: (key: string) => void
}

export default function MessageTabs({ tabs, active, onChange }: MessageTabsProps) {
  return (
    <ScrollView
      scrollX
      className="bg-white border-b border-gray-100"
      enhanced
      showScrollbar={false}
    >
      <View className="flex">
        {tabs.map((tab) => {
          const isActive = tab.key === active
          const showUnread = (tab.unread ?? 0) > 0
          return (
            <View
              key={tab.key}
              className={`relative flex flex-col items-center px-5 py-3 ${isActive ? '' : ''}`}
              onClick={() => onChange(tab.key)}
            >
              <View className="flex items-center">
                <Text
                  className={`text-sm ${
                    isActive ? 'text-gray-800 font-semibold' : 'text-gray-500'
                  }`}
                >
                  {tab.label}
                </Text>
                {showUnread && (
                  <View className="ml-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 flex items-center justify-center">
                    <Text className="text-[10px] text-white">
                      {tab.unread! > 99 ? '99+' : tab.unread}
                    </Text>
                  </View>
                )}
              </View>
              <View
                className={`mt-1.5 h-0.5 rounded-full transition-all ${
                  isActive ? 'w-6 bg-green-600' : 'w-0'
                }`}
              />
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}
