import { View, Text, Input } from '@tarojs/components'

export interface BottomActionBarProps {
  value?: string
  placeholder?: string
  disabled?: boolean
  showAttach?: boolean
  showSend?: boolean
  onInput?: (value: string) => void
  onSend?: () => void
  onAttach?: () => void
}

export default function BottomActionBar({
  value = '',
  placeholder = '输入消息...',
  disabled = false,
  showAttach = true,
  showSend = true,
  onInput,
  onSend,
  onAttach,
}: BottomActionBarProps) {
  return (
    <View className="flex items-center px-3 py-2 bg-white border-t border-gray-100">
      {showAttach && (
        <View
          className="flex items-center justify-center w-8 h-8 mr-2 rounded-lg bg-gray-50"
          onClick={onAttach}
        >
          <Text className="text-lg text-gray-400">+</Text>
        </View>
      )}
      <Input
        className="flex-1 px-3 py-2 text-sm bg-gray-50 rounded-md"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onInput={(e) => onInput?.(e.detail.value)}
        onConfirm={() => onSend?.()}
      />
      {showSend && (
        <View
          className={`flex items-center justify-center w-8 h-8 ml-2 rounded-lg ${
            value ? 'bg-indigo-500' : 'bg-gray-200'
          }`}
          onClick={() => value && onSend?.()}
        >
          <Text className="text-sm text-white">↑</Text>
        </View>
      )}
    </View>
  )
}
