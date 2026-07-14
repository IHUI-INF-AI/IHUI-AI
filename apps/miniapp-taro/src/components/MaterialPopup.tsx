import { View, Text, ScrollView, Image } from '@tarojs/components'
import EmptyState from './EmptyState'

export type MaterialTab = 1 | 2 | 3 | 4

export interface MaterialItem {
  id: string
  title: string
  thumbnail?: string
  createdAt?: string
}

export interface MaterialPopupProps {
  visible?: boolean
  tab?: MaterialTab
  items?: MaterialItem[]
  loading?: boolean
  onTabChange?: (tab: MaterialTab) => void
  onSelect?: (item: MaterialItem) => void
  onClose?: () => void
}

const TABS: { key: MaterialTab; label: string }[] = [
  { key: 1, label: '文本' },
  { key: 2, label: '图片' },
  { key: 3, label: '视频' },
  { key: 4, label: '音频' },
]

export default function MaterialPopup({
  visible = false,
  tab = 1,
  items = [],
  loading = false,
  onTabChange,
  onSelect,
  onClose,
}: MaterialPopupProps) {
  if (!visible) return null

  return (
    <View
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg"
      style={{ maxHeight: '60vh' }}
    >
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <Text className="text-sm font-medium text-gray-800">我的素材</Text>
        <Text className="text-sm text-gray-400" onClick={onClose}>
          关闭
        </Text>
      </View>
      <View className="flex px-3 py-2 border-b border-gray-50">
        {TABS.map((t) => (
          <Text
            key={t.key}
            className={`flex-1 text-center text-xs py-2 mr-1 rounded ${
              tab === t.key ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'
            }`}
            onClick={() => onTabChange?.(t.key)}
          >
            {t.label}
          </Text>
        ))}
      </View>
      <ScrollView scrollY className="px-3 py-2" style={{ maxHeight: '45vh' }}>
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-gray-400">加载中...</Text>
          </View>
        ) : items.length === 0 ? (
          <EmptyState text="暂无素材" />
        ) : (
          <View className="flex flex-wrap">
            {items.map((item) => (
              <View key={item.id} className="w-1/3 p-1.5" onClick={() => onSelect?.(item)}>
                <View className="bg-gray-50 rounded-lg overflow-hidden">
                  {item.thumbnail ? (
                    <Image
                      className="w-full"
                      style={{ height: '80px' }}
                      src={item.thumbnail}
                      mode="aspectFill"
                    />
                  ) : (
                    <View
                      className="flex items-center justify-center w-full"
                      style={{ height: '80px' }}
                    >
                      <Text className="text-xs text-gray-300">无预览</Text>
                    </View>
                  )}
                  <Text className="block text-[11px] text-gray-600 truncate px-1 py-1">
                    {item.title}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
