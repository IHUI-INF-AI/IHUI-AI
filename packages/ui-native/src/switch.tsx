// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useRef } from 'react'
import { Animated, Pressable, useColorScheme } from 'react-native'
import { cn } from '@ihui/design-tokens'
import {
  SWITCH_DEFAULT_SIZE,
  SWITCH_THUMB_RADIUS_TIER,
  SWITCH_THUMB_SIZE_PX,
  SWITCH_THUMB_TRANSLATE_X_PX,
  SWITCH_TRACK_BORDER_W_PX,
  SWITCH_TRACK_H_PX,
  SWITCH_TRACK_PADDING_PX,
  SWITCH_TRACK_RADIUS_TIER,
  SWITCH_TRACK_W_PX,
  type SwitchSizeTier,
} from '@ihui/shared/ui/switch-spec'

/**
 * RN Switch —— 对齐 web 的 Neo-Brutalist 开关(2026-10-27 阶段1:从 RN 原生 Switch 薄包改为自绘,
 * 几何/尺寸/圆角/位移全部取自 @ihui/shared/ui/switch-spec,与 web 逐像素对齐)。
 * 平台承载差异(规则6,逐条登记):
 *  - 硬投影:web 走 `shadow-[3px_3px_0_var(--color-foreground)]` 类;本端走 style.shadowColor/Offset/Opacity
 *    (RN 无 box-shadow 类通道),色取 foreground(明暗自适应);
 *  - ON 底色:web `bg-[var(--color-brand-accent)]`;本端 `bg-brand-accent`(nativewind 主题色);
 *  - 位移:web `data-[state=checked]:translate-x-[Npx]`;本端 Animated translateX(spec 同值驱动);
 *  - 按下位移:web `active:` 伪类;本端无伪类通道,本实现省略(仅保留 ON 位移动画)。
 */

const TRACK_W_CLASS: Record<number, string> = { 36: 'w-9', 44: 'w-11', 52: 'w-[52px]' }
const TRACK_H_CLASS: Record<number, string> = { 20: 'h-5', 24: 'h-6', 28: 'h-7' }
const THUMB_SIZE_CLASS: Record<number, string> = { 12: 'h-3 w-3', 16: 'h-4 w-4', 20: 'h-5 w-5' }
const TRACK_RADIUS_CLASS: Record<typeof SWITCH_TRACK_RADIUS_TIER, string> = { md: 'rounded-md' }
const THUMB_RADIUS_CLASS: Record<typeof SWITCH_THUMB_RADIUS_TIER, string> = { sm: 'rounded-sm' }
const BORDER_CLASS: Record<number, string> = { 1.5: 'border-[1.5px]' }
const PADDING_CLASS: Record<number, string> = { 3: 'p-[3px]' }

export interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (value: boolean) => void
  disabled?: boolean
  size?: SwitchSizeTier
  className?: string
}

export function Switch({
  checked = false,
  onCheckedChange,
  disabled,
  size = SWITCH_DEFAULT_SIZE,
  className,
}: SwitchProps) {
  const colorScheme = useColorScheme()
  const foreground = colorScheme === 'dark' ? '#ffffff' : '#000000'
  const translate = useRef(
    new Animated.Value(checked ? SWITCH_THUMB_TRANSLATE_X_PX[size] : 0),
  ).current
  useEffect(() => {
    Animated.timing(translate, {
      toValue: checked ? SWITCH_THUMB_TRANSLATE_X_PX[size] : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [checked, size, translate])

  const w = SWITCH_TRACK_W_PX[size]
  const h = SWITCH_TRACK_H_PX[size]
  const thumb = SWITCH_THUMB_SIZE_PX[size]

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onCheckedChange?.(!checked)}
      className={cn(
        'flex-row items-center border-border',
        TRACK_W_CLASS[w],
        TRACK_H_CLASS[h],
        TRACK_RADIUS_CLASS[SWITCH_TRACK_RADIUS_TIER],
        PADDING_CLASS[SWITCH_TRACK_PADDING_PX],
        BORDER_CLASS[SWITCH_TRACK_BORDER_W_PX],
        checked ? 'bg-brand-accent' : 'bg-background',
        disabled && 'opacity-50',
        className,
      )}
      style={{
        shadowColor: foreground,
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
      }}
    >
      <Animated.View
        className={cn(
          'bg-foreground',
          THUMB_SIZE_CLASS[thumb],
          THUMB_RADIUS_CLASS[SWITCH_THUMB_RADIUS_TIER],
          checked && 'bg-background',
        )}
        style={{ transform: [{ translateX: translate }] }}
      />
    </Pressable>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
