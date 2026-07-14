import { View, Text } from '@tarojs/components'
import { useState } from 'react'

export interface FilterDropdownProps {
  label?: string
  options: { label: string; value: string }[]
  value?: string
  onChange?: (value: string) => void
}

export default function FilterDropdown({
  label = '筛选',
  options,
  value = '',
  onChange,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <View className="relative">
      <View
        className="flex items-center px-3 py-2 bg-gray-50 rounded-lg"
        onClick={() => setOpen(!open)}
      >
        <Text className="text-xs text-gray-500 mr-1">{label}:</Text>
        <Text className={`text-xs ${selected ? 'text-indigo-600' : 'text-gray-400'}`}>
          {selected?.label || '全部'}
        </Text>
        <Text className="text-xs text-gray-400 ml-1">{open ? '▲' : '▼'}</Text>
      </View>
      {open && (
        <View className="absolute z-10 mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-100 min-w-32">
          <View
            className={`px-3 py-2 ${!value ? 'bg-indigo-50' : ''}`}
            onClick={() => {
              onChange?.('')
              setOpen(false)
            }}
          >
            <Text className="text-xs text-gray-600">全部</Text>
          </View>
          {options.map((opt) => (
            <View
              key={opt.value}
              className={`px-3 py-2 ${value === opt.value ? 'bg-indigo-50' : ''}`}
              onClick={() => {
                onChange?.(opt.value)
                setOpen(false)
              }}
            >
              <Text
                className={`text-xs ${value === opt.value ? 'text-indigo-600' : 'text-gray-600'}`}
              >
                {opt.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
