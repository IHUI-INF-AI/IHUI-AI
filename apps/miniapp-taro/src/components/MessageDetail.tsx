import { View, Text, Image, Textarea } from '@tarojs/components'

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
  return (
    <View className="flex flex-col h-full bg-gray-50">
      <View className="flex-1 px-3 py-3 overflow-y-auto">
        {messages.length === 0 && (
          <View className="flex items-center justify-center py-12">
            <Text className="text-sm text-gray-400">开始你们的对话</Text>
          </View>
        )}
        {messages.map((msg) => (
          <View key={msg.id} className={`flex mb-3 ${msg.self ? 'flex-row-reverse' : 'flex-row'}`}>
            {!msg.self &&
              (userAvatar ? (
                <Image
                  src={userAvatar}
                  className="w-8 h-8 rounded-lg mr-2 bg-gray-100"
                  mode="aspectFill"
                />
              ) : (
                <View className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center mr-2">
                  <Text className="text-xs text-gray-500">{userName.charAt(0)}</Text>
                </View>
              ))}
            <View className={`max-w-[70%] ${msg.self ? 'items-end' : 'items-start'}`}>
              <View
                className={`px-3 py-2 rounded-2xl ${
                  msg.self
                    ? 'bg-green-600 text-white rounded-tr-sm'
                    : 'bg-white text-gray-800 rounded-tl-sm'
                }`}
              >
                <Text className="text-sm">{msg.content}</Text>
              </View>
              <Text className="text-[10px] text-gray-400 mt-1">{msg.createdAt}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="flex items-center px-3 py-2 bg-white border-t border-gray-100">
        <Textarea
          value={inputValue}
          onInput={(e) => onInput(e.detail.value)}
          placeholder="输入消息..."
          className="flex-1 bg-gray-50 rounded-md px-4 py-2 text-sm"
          maxlength={500}
          autoHeight
        />
        <View
          className={`ml-2 px-4 py-2 rounded-md text-sm ${
            inputValue.trim() ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
          }`}
          onClick={() => inputValue.trim() && onSend()}
        >
          发送
        </View>
      </View>
    </View>
  )
}
