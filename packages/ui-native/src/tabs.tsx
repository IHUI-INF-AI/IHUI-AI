import type { ComponentProps } from 'react'
import { Pressable, Text, View } from 'react-native'
import { cn } from '@ihui/ui-primitives'

export interface TabItem {
  value: string
  label: string
}

export interface TabsProps extends Omit<ComponentProps<typeof View>, 'children'> {
  tabs: TabItem[]
  value?: string
  onChange?: (value: string) => void
}

export function Tabs({ tabs, value, onChange, className, ...props }: TabsProps) {
  return (
    <View className={cn('flex-row rounded-lg bg-muted p-1', className)} accessibilityRole="tablist" {...props}>
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange?.(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={cn(
              'flex-1 items-center justify-center rounded-md py-1.5',
              active && 'bg-background',
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
