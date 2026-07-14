import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import type { ChatMessage } from '@/api'

export interface ChatMessageItemProps {
  msg: ChatMessage
}

export default function ChatMessageItem({ msg }: ChatMessageItemProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <View className={`msg-item ${msg.role}`}>
      <View className={`avatar ${msg.role}`}>{msg.role === 'user' ? '我' : 'AI'}</View>
      <View className="bubble">
        {msg.reasoning ? (
          <View className="reasoning-wrap" onClick={() => setExpanded((v) => !v)}>
            <Text className="reasoning-toggle">{expanded ? '▾' : '▸'} 思考过程</Text>
            {expanded ? <Text className="reasoning-content">{msg.reasoning}</Text> : null}
          </View>
        ) : null}
        <Text className="bubble-text">{msg.content}</Text>
      </View>
    </View>
  )
}
