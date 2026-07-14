import { View, Text, Input } from '@tarojs/components'
import { useState } from 'react'

export interface TagInputProps {
  value?: string[]
  placeholder?: string
  max?: number
  onChange?: (tags: string[]) => void
}

export default function TagInput({
  value = [],
  placeholder = '输入后回车添加',
  max = 10,
  onChange,
}: TagInputProps) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const v = input.trim()
    if (v && !value.includes(v) && value.length < max) {
      onChange?.([...value, v])
      setInput('')
    }
  }

  const removeTag = (idx: number) => {
    onChange?.(value.filter((_, i) => i !== idx))
  }

  return (
    <View className="flex flex-wrap items-center px-3 py-2 bg-gray-50 rounded-lg">
      {value.map((tag, idx) => (
        <View
          key={idx}
          className="flex items-center mr-2 mb-1.5 px-2.5 py-1 rounded-full bg-indigo-50"
        >
          <Text className="text-xs text-indigo-600 mr-1">{tag}</Text>
          <Text className="text-xs text-indigo-400" onClick={() => removeTag(idx)}>
            ×
          </Text>
        </View>
      ))}
      <Input
        className="flex-1 min-w-20 text-sm"
        placeholder={value.length >= max ? '已达上限' : placeholder}
        value={input}
        onInput={(e) => setInput(e.detail.value)}
        onConfirm={addTag}
      />
    </View>
  )
}
