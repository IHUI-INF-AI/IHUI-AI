import { View, Text } from '@tarojs/components'
import { useState } from 'react'

export interface MessageActionsProps {
  onMarkRead?: () => void
  onPin?: () => void
  onDelete?: () => void
  pinned?: boolean
}

export default function MessageActions({
  onMarkRead,
  onPin,
  onDelete,
  pinned = false,
}: MessageActionsProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <View className="relative">
      <View
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100"
        onClick={() => setExpanded(!expanded)}
      >
        <Text className="text-gray-500 text-sm">⋯</Text>
      </View>

      {expanded && (
        <View className="absolute right-0 top-9 z-10 bg-white rounded-lg shadow-lg py-1 min-w-[120px]">
          <View
            className="flex items-center px-3 py-2 hover:bg-gray-50"
            onClick={() => {
              onMarkRead?.()
              setExpanded(false)
            }}
          >
            <Text className="text-sm text-gray-700">标记已读</Text>
          </View>
          <View
            className="flex items-center px-3 py-2 hover:bg-gray-50"
            onClick={() => {
              onPin?.()
              setExpanded(false)
            }}
          >
            <Text className="text-sm text-gray-700">{pinned ? '取消置顶' : '置顶会话'}</Text>
          </View>
          <View
            className="flex items-center px-3 py-2 hover:bg-gray-50"
            onClick={() => {
              onDelete?.()
              setExpanded(false)
            }}
          >
            <Text className="text-sm text-red-500">删除会话</Text>
          </View>
        </View>
      )}
    </View>
  )
}
