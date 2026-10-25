// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import { Text, View } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'

/**
 * 标签栏组件 —— 与 `packages/ui-native/src/tabs.tsx` 逐类对齐(「一模一样」契约)。
 *
 * 两端共用同一份 `@ihui/design-tokens` Tailwind preset(颜色/间距/圆角档位),
 * 故同一组类名在 RN(NativeWind)与小程序(Taro)渲染出完全一致的视觉:
 * - 容器:`flex-row rounded-lg bg-muted p-1`(分段控件式标签栏)
 * - 项:   `flex-1 items-center justify-center rounded-md py-1.5`,激活态 `bg-background`
 * - 文案: `text-sm font-medium`,激活 `text-foreground` / 未激活 `text-muted-foreground`
 *
 * API 与 RN 完全一致(受控):`tabs` / `value` / `onChange`。为兼容非受控用法,
 * 内部以 `useState` 维护激活项,并在 `value` 受控变化时同步;点击切换行为与 RN 一致。
 *
 * 无障碍:RN 用 `accessibilityRole="tablist"/"tab"`,Taro 的 View 无该属性,
 * 改用类型安全的 `role="tablist"/"tab"` 等价映射(差异见回报)。
 */

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
  const [internal, setInternal] = useState<string | undefined>(value)
  // 受控时以外部 value 为准,非受控时回退内部状态。
  useEffect(() => {
    if (value !== undefined) setInternal(value)
  }, [value])
  const active = value ?? internal

  const handleSelect = (tabValue: string) => {
    setInternal(tabValue)
    onChange?.(tabValue)
  }

  return (
    <View className={cn('flex-row rounded-lg bg-muted p-1', className)} role="tablist" {...props}>
      {tabs.map((tab) => {
        const isActive = tab.value === active
        return (
          <View
            key={tab.value}
            onClick={() => handleSelect(tab.value)}
            hoverClass="opacity-80"
            role="tab"
            className={cn(
              'flex-1 items-center justify-center rounded-md py-1.5',
              isActive && 'bg-background',
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export default Tabs
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
