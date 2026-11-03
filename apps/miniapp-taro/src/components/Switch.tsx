// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View } from '@tarojs/components'
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
 * 开关组件 —— 与 `packages/ui-native/src/switch.tsx` 逐类对齐(「一模一样」契约)。
 *
 * **本端已从 Taro 原生 `<Switch>` 薄包改为自绘**(对齐 RN 2026-10-27 阶段1 的 Neo-Brutalist 自绘):
 * 原生开关的外观由微信实现,不吃任何类名/token ⇒ 同屏必然与 RN/web 长出不一样的一颗开关,
 * 那是承载机制选错,不是档位差异。现在几何全部由 `@ihui/shared/ui/switch-spec` 驱动,
 * 下面的「档 → 本端承载类」映射与 RN 壳**逐字相等**(由 `scripts/gen-ui-mirror.mjs` 派生复核)。
 *
 * 与 RN 的分歧(规则6 承载差异,逐条登记):
 * - 位移动画:RN 用 `Animated.timing` + `useNativeDriver`;本端只有 CSS transition 通道,
 *   时长同值 200ms(见 `SWITCH_ANIM_MS`),位移距离同取 `SWITCH_THUMB_TRANSLATE_X_PX[size]`;
 * - 硬投影:RN 走 `style.shadowColor/Offset/Opacity`,web 走 `shadow-[3px_3px_0_var(--color-foreground)]`
 *   类;本端 `boxShadow` 内联(同 3px 档、同 `--color-foreground` 色),rpx 化走端内 `toRpx`;
 * - 按下反馈:web 的 `active:` 伪类本端无通道,与 RN 一样省略;
 * - `flex`:weapp 无「默认 flex 容器」语义,须显式给 display 档(`flex flex-row`),RN 侧 `flex-row` 即够;
 * - 无障碍:RN 用 `accessibilityRole/accessibilityState`,本端走 `role` + `aria-*` 等价映射。
 */

const TRACK_W_CLASS: Record<number, string> = { 36: 'w-9', 44: 'w-11', 52: 'w-[52px]' }
const TRACK_H_CLASS: Record<number, string> = { 20: 'h-5', 24: 'h-6', 28: 'h-7' }
const THUMB_SIZE_CLASS: Record<number, string> = { 12: 'h-3 w-3', 16: 'h-4 w-4', 20: 'h-5 w-5' }
const TRACK_RADIUS_CLASS: Record<typeof SWITCH_TRACK_RADIUS_TIER, string> = { md: 'rounded-md' }
const THUMB_RADIUS_CLASS: Record<typeof SWITCH_THUMB_RADIUS_TIER, string> = { sm: 'rounded-sm' }
const BORDER_CLASS: Record<number, string> = { 1.5: 'border-[1.5px]' }
const PADDING_CLASS: Record<number, string> = { 3: 'p-[3px]' }

/** 本端承载数值(不属几何契约,端内定档):动画时长与硬投影厚度,与 RN/web 同值。 */
const SWITCH_ANIM_MS = 200
const SWITCH_SHADOW_PX = 3

/** 端内 px→rpx 换算(小程序 1px→2rpx),与 ScreenStates/SectionHeader 同一写法。 */
const toRpx = (px: number): string => `${px * 2}rpx`

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
  const w = SWITCH_TRACK_W_PX[size]
  const h = SWITCH_TRACK_H_PX[size]
  const thumb = SWITCH_THUMB_SIZE_PX[size]

  return (
    <View
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={() => {
        if (disabled) return
        onCheckedChange?.(!checked)
      }}
      className={cn(
        'flex flex-row items-center border-foreground', // border-ink-exempt: Switch 新拟态定稿 —— 框与 3px 硬投影同色才成立体感,与 web/RN 同一处定稿 until 2027-09-26
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
        boxShadow: `${toRpx(SWITCH_SHADOW_PX)} ${toRpx(SWITCH_SHADOW_PX)} 0 var(--color-foreground)`,
      }}
    >
      <View
        className={cn(
          'bg-foreground',
          THUMB_SIZE_CLASS[thumb],
          THUMB_RADIUS_CLASS[SWITCH_THUMB_RADIUS_TIER],
          checked && 'bg-background',
        )}
        style={{
          transform: `translateX(${toRpx(checked ? SWITCH_THUMB_TRANSLATE_X_PX[size] : 0)})`,
          transition: `transform ${SWITCH_ANIM_MS}ms ease`,
        }}
      />
    </View>
  )
}

export default Switch
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
