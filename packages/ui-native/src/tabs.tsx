// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentProps } from 'react'
import { Pressable, Text, View } from 'react-native'
import { cn } from '@ihui/design-tokens'
import {
  TABS_LIST_HEIGHT_PX,
  TABS_LIST_PADDING_PX,
  TABS_LIST_RADIUS_TIER,
  TABS_TRIGGER_FONT_SIZE_PX,
  TABS_TRIGGER_PADDING_Y_PX,
  TABS_TRIGGER_RADIUS_TIER,
} from '@ihui/shared/ui/tabs-spec'

const LIST_RADIUS_CLASS: Record<typeof TABS_LIST_RADIUS_TIER, string> = { lg: 'rounded-lg' }
const LIST_PADDING_CLASS: Record<number, string> = { 4: 'p-1' }
const LIST_HEIGHT_CLASS: Record<number, string> = { 36: 'h-9' }
const TRIGGER_RADIUS_CLASS: Record<typeof TABS_TRIGGER_RADIUS_TIER, string> = { md: 'rounded-md' }
const TRIGGER_FONT_CLASS: Record<number, string> = { 14: 'text-sm' }
const TRIGGER_PADDING_Y_CLASS: Record<number, string> = { 4: 'py-1' }

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
    <View
      className={cn(
        'flex-row bg-muted',
        LIST_RADIUS_CLASS[TABS_LIST_RADIUS_TIER],
        LIST_HEIGHT_CLASS[TABS_LIST_HEIGHT_PX],
        LIST_PADDING_CLASS[TABS_LIST_PADDING_PX],
        className,
      )}
      accessibilityRole="tablist"
      {...props}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange?.(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={cn(
              'flex-1 items-center justify-center',
              TRIGGER_RADIUS_CLASS[TABS_TRIGGER_RADIUS_TIER],
              TRIGGER_PADDING_Y_CLASS[TABS_TRIGGER_PADDING_Y_PX],
              active && 'bg-background',
            )}
          >
            <Text
              className={cn(
                'font-medium',
                TRIGGER_FONT_CLASS[TABS_TRIGGER_FONT_SIZE_PX],
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
