import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import type { ChatMessage } from '@/api'
import { useI18n } from '@/i18n'

export interface ChatMessageItemProps {
  msg: ChatMessage
}

export default function ChatMessageItem({ msg }: ChatMessageItemProps) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  return (
    <View className={`msg-item ${msg.role}`}>
      <View className={`avatar ${msg.role}`}>
        {msg.role === 'user' ? t('ai.chatMessageItem.me') : t('ai.chatMessageItem.ai')}
      </View>
      <View className="bubble">
        {msg.reasoning ? (
          <View className="reasoning-wrap" onClick={() => setExpanded((v) => !v)}>
            <Text className="reasoning-toggle">
              {expanded ? '▾' : '▸'} {t('ai.chatMessageItem.thinkingProcess')}
            </Text>
            {expanded ? <Text className="reasoning-content">{msg.reasoning}</Text> : null}
          </View>
        ) : null}
        <Text className="bubble-text">{msg.content}</Text>
      </View>
    </View>
  )
}
