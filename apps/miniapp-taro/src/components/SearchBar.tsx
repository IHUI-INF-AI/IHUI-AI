import { View, Text, Input } from '@tarojs/components'

export interface SearchBarProps {
  value?: string
  placeholder?: string
  onInput?: (value: string) => void
  onSearch?: () => void
  onClear?: () => void
}

export default function SearchBar({
  value = '',
  placeholder = '搜索',
  onInput,
  onSearch,
  onClear,
}: SearchBarProps) {
  return (
    <View className="flex items-center px-3 py-2 mx-3 my-2 bg-muted rounded-md">
      <Text className="text-sm text-muted-foreground mr-2">🔍</Text>
      <Input
        className="flex-1 text-sm"
        placeholder={placeholder}
        value={value}
        onInput={(e) => onInput?.(e.detail.value)}
        onConfirm={() => onSearch?.()}
      />
      {value && (
        <Text className="text-sm text-muted-foreground ml-2" onClick={onClear}>
          ×
        </Text>
      )}
    </View>
  )
}
