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
        className="flex items-center px-3 py-2 bg-muted rounded-lg"
        onClick={() => setOpen(!open)}
      >
        <Text className="text-xs text-muted-foreground mr-1">{label}:</Text>
        <Text className={`text-xs ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
          {selected?.label || '全部'}
        </Text>
        <Text className="text-xs text-muted-foreground ml-1">{open ? '▲' : '▼'}</Text>
      </View>
      {open && (
        <View className="absolute z-10 mt-1 py-1 bg-card rounded-lg shadow-lg border border-border min-w-32">
          <View
            className={`px-3 py-2 ${!value ? 'bg-primary/10' : ''}`}
            onClick={() => {
              onChange?.('')
              setOpen(false)
            }}
          >
            <Text className="text-xs text-muted-foreground">全部</Text>
          </View>
          {options.map((opt) => (
            <View
              key={opt.value}
              className={`px-3 py-2 ${value === opt.value ? 'bg-primary/10' : ''}`}
              onClick={() => {
                onChange?.(opt.value)
                setOpen(false)
              }}
            >
              <Text
                className={`text-xs ${value === opt.value ? 'text-primary' : 'text-muted-foreground'}`}
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
