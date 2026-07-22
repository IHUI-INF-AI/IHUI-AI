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
    <View className="flex items-center px-3 py-2 bg-card border-t border-border">
      {showAttach && (
        <View
          className="flex items-center justify-center w-8 h-8 mr-2 rounded-lg bg-muted"
          onClick={onAttach}
        >
          <Text className="text-lg text-muted-foreground">+</Text>
        </View>
      )}
      <Input
        className="flex-1 px-3 py-2 text-sm bg-muted rounded-md"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onInput={(e) => onInput?.(e.detail.value)}
        onConfirm={() => onSend?.()}
      />
      {showSend && (
        <View
          className={`flex items-center justify-center w-8 h-8 ml-2 rounded-lg ${
            value ? 'bg-primary' : 'bg-muted'
          }`}
          onClick={() => value && onSend?.()}
        >
          <Text className="text-sm text-white">↑</Text>
        </View>
      )}
    </View>
  )
}
