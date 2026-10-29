// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import { Text, View } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import {
  TABS_LIST_HEIGHT_PX,
  TABS_LIST_PADDING_PX,
  TABS_LIST_RADIUS_TIER,
  TABS_TRIGGER_FONT_SIZE_PX,
  TABS_TRIGGER_PADDING_Y_PX,
  TABS_TRIGGER_RADIUS_TIER,
} from '@ihui/shared/ui/tabs-spec'

/**
 * 标签栏组件 —— 与 `packages/ui-native/src/tabs.tsx` 逐类对齐(「一模一样」契约)。
 *
 * **取值档一律取自 `@ihui/shared/ui/tabs-spec`**(与 web 壳、RN 壳同源):改 spec 一处,三端同时跟随。
 * 本文件只做「档 → 本端承载类」的映射;**类名字面量必须留在这里**(spec 不在 Tailwind 扫描面内)。
 * 映射表由 `scripts/gen-ui-mirror.mjs` 从 RN 壳派生,两端逐字相等 ⇒ 同一档位不可能渲染出两种尺寸。
 *
 * 两端共用同一份 `@ihui/design-tokens` Tailwind preset(颜色/间距/圆角档位),
 * 故同一组类名在 RN(NativeWind)与小程序(Taro)渲染出完全一致的视觉:
 * - 容器:`flex-row rounded-lg bg-muted h-9 p-1`(分段控件式标签栏;高度 36 档 = RN 同值)
 * - 项:   `flex-1 items-center justify-center rounded-md py-1`,激活态 `bg-background`
 * - 文案: `text-sm font-medium`,激活 `text-foreground` / 未激活 `text-muted-foreground`
 *
 * 与 RN 的分歧(规则6 承载差异,逐条登记):
 * - RN 用 `Pressable` + `accessibilityRole`,本端 `View` 无该属性,改用类型安全的 `role` 等价映射;
 * - 本端额外保留非受控用法(`useState`),受控时以外部 `value` 为准 —— RN 只有受控形。
 */

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
    <View
      className={cn(
        'flex-row bg-muted',
        LIST_RADIUS_CLASS[TABS_LIST_RADIUS_TIER],
        LIST_HEIGHT_CLASS[TABS_LIST_HEIGHT_PX],
        LIST_PADDING_CLASS[TABS_LIST_PADDING_PX],
        className,
      )}
      role="tablist"
      {...props}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active
        return (
          <View
            key={tab.value}
            onClick={() => handleSelect(tab.value)}
            hoverClass="opacity-80"
            role="tab"
            className={cn(
              'flex-1 items-center justify-center',
              TRIGGER_RADIUS_CLASS[TABS_TRIGGER_RADIUS_TIER],
              TRIGGER_PADDING_Y_CLASS[TABS_TRIGGER_PADDING_Y_PX],
              isActive && 'bg-background',
            )}
          >
            <Text
              className={cn(
                'font-medium',
                TRIGGER_FONT_CLASS[TABS_TRIGGER_FONT_SIZE_PX],
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
