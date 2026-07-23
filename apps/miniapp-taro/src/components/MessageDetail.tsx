import { View, Text, Image, Textarea } from '@tarojs/components'
import { useI18n } from '@/i18n'

export interface MessageDetailItem {
  id: string
  content: string
  createdAt: string
  self: boolean
}

export interface MessageDetailProps {
  userName: string
  userAvatar?: string
  messages: MessageDetailItem[]
  inputValue: string
  onInput: (v: string) => void
  onSend: () => void
}

export default function MessageDetail({
  userName,
  userAvatar,
  messages = [],
  inputValue,
  onInput,
  onSend,
}: MessageDetailProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  return (
    <View className="flex flex-col h-full bg-muted">
      <View className="flex-1 px-3 py-3 overflow-y-auto">
        {messages.length === 0 && (
          <View className="flex items-center justify-center py-12">
            <Text className="text-sm text-muted-foreground">{tt('message.startConversation', '开始你们的对话')}</Text>
          </View>
        )}
        {messages.map((msg) => (
          <View key={msg.id} className={`flex mb-3 ${msg.self ? 'flex-row-reverse' : 'flex-row'}`}>
            {!msg.self &&
              (userAvatar ? (
                <Image
                  src={userAvatar}
                  className="w-8 h-8 rounded-lg mr-2 bg-muted"
                  mode="aspectFill"
                />
              ) : (
                <View className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mr-2">
                  <Text className="text-xs text-muted-foreground">{userName.charAt(0)}</Text>
                </View>
              ))}
            <View className={`max-w-[70%] ${msg.self ? 'items-end' : 'items-start'}`}>
              <View
                className={`px-3 py-2 rounded-2xl ${
                  msg.self
                    ? 'bg-primary text-white rounded-tr-sm'
                    : 'bg-card text-foreground rounded-tl-sm'
                }`}
              >
                <Text className="text-sm">{msg.content}</Text>
              </View>
              <Text className="text-[10px] text-muted-foreground mt-1">{msg.createdAt}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="flex items-center px-3 py-2 bg-card border-t border-border">
        <Textarea
          value={inputValue}
          onInput={(e) => onInput(e.detail.value)}
          placeholder={tt('message.inputPlaceholder', '输入消息...')}
          className="flex-1 bg-muted rounded-md px-4 py-2 text-sm"
          maxlength={500}
          autoHeight
        />
        <View
          className={`ml-2 px-4 py-2 rounded-md text-sm ${
            inputValue.trim() ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
          }`}
          onClick={() => inputValue.trim() && onSend()}
        >
          {tt('message.sendBtn', '发送')}
        </View>
      </View>
    </View>
  )
}
