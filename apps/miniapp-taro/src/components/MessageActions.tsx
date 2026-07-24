import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { useI18n } from '@/i18n'

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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  return (
    <View className="relative">
      <View
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted"
        onClick={() => setExpanded(!expanded)}
      >
        <Text className="text-muted-foreground text-sm">⋯</Text>
      </View>

      {expanded && (
        <View className="absolute right-0 top-9 z-10 bg-card rounded-lg shadow-lg py-1 min-w-[120px]">
          <View
            className="flex items-center px-3 py-2 hover:bg-muted"
            onClick={() => {
              onMarkRead?.()
              setExpanded(false)
            }}
          >
            <Text className="text-sm text-foreground">{tt('message.markRead', '标记已读')}</Text>
          </View>
          <View
            className="flex items-center px-3 py-2 hover:bg-muted"
            onClick={() => {
              onPin?.()
              setExpanded(false)
            }}
          >
            <Text className="text-sm text-foreground">{pinned ? tt('message.unpin', '取消置顶') : tt('message.pin', '置顶会话')}</Text>
          </View>
          <View
            className="flex items-center px-3 py-2 hover:bg-muted"
            onClick={() => {
              onDelete?.()
              setExpanded(false)
            }}
          >
            <Text className="text-sm text-destructive">{tt('message.deleteConv', '删除会话')}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
