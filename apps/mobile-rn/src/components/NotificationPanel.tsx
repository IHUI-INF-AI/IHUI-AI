import { Modal, View, Text, TouchableOpacity, FlatList } from 'react-native'
import { useNotificationStore } from '../stores/notification'

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export default function NotificationPanel() {
  const { notifications, visible, markAllRead, setVisible, clearAll } = useNotificationStore()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => setVisible(false)}
    >
      <TouchableOpacity
        className="flex-1 bg-black/20 justify-end"
        activeOpacity={1}
        onPress={() => setVisible(false)}
      >
        <TouchableOpacity
          className="bg-white rounded-tl-2xl rounded-tr-2xl max-h-[70%] min-h-[40%]"
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
            <Text className="text-[15px] font-semibold text-gray-900">通知</Text>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                className="px-2.5 py-1 rounded-md border border-gray-200"
                onPress={markAllRead}
              >
                <Text className="text-xs text-gray-700">全部已读</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="px-2.5 py-1 rounded-md border border-gray-200"
                onPress={clearAll}
              >
                <Text className="text-xs text-gray-700">清空</Text>
              </TouchableOpacity>
              <TouchableOpacity className="px-2 py-0.5" onPress={() => setVisible(false)}>
                <Text className="text-[20px] text-gray-500 leading-[22px]">×</Text>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className={`px-3 py-2.5 rounded-lg mb-1 ${!item.isRead ? 'bg-gray-100' : ''}`}>
                <Text className="text-[13px] font-medium text-gray-900 mb-0.5">{item.title}</Text>
                {item.content ? (
                  <Text className="text-xs text-gray-500 mb-1">{item.content}</Text>
                ) : null}
                <Text className="text-[11px] text-gray-400">{formatTime(item.createdAt)}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text className="py-10 text-center text-gray-400 text-[13px]">暂无通知</Text>
            }
            contentContainerStyle={{ padding: 8 }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
