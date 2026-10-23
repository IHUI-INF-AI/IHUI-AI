// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Text, View } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'

/**
 * 折叠/展开组件 —— 与 `packages/ui-native/src/collapsible.tsx` 逐契约对齐(「一模一样」契约)。
 *
 * 对齐点(API / 结构 / 视觉):
 * - `CollapsibleProps` 同 RN:`open?: boolean`(默认 false)、`children?: ReactNode`、`className?: string`。
 * - 容器 `View className="w-full ${className}"`,与 RN `<View className={cn('w-full', className)}>` 一致。
 * - 箭头 `›`(`\u203A`)用 `text-base text-foreground`,与 RN `<Text className="text-base text-foreground">›</Text>` 同字形同色。
 * - 展开态箭头旋转 90deg(对应 RN Animated 的 `rotate: 0deg → 90deg`)。
 *
 * 与 RN 的分歧(刻意、gate-clean 优先):
 * - RN 用 `Animated` + `onLayout` 测量真实内容高度做 height 动画;小程序(Taro)不强行复刻 Animated,
 *   改用 CSS `max-height` + `overflow:hidden` 过渡模拟高度展开/收起,并用内联 `transform: rotate()`
 *   做箭头旋转(配 `transition`)。等价行为、可编译、零运行时测量依赖。
 * - RN 的 `open` 为纯受控外部 prop(组件内无点击切换);本端按任务要求把箭头做成**可点击触发区**,
 *   `open` 仅作为初始值,点击在内部 `expanded` 状态上切换(open 与内部状态二选一生效,默认 false)。
 *   若需完全受控,父级可自行接管初始值(本组件不回写)。
 */
export interface CollapsibleProps {
  open?: boolean
  children?: ReactNode
  className?: string
}

const ANIM_DURATION = 200

export function Collapsible({ open = false, children, className }: CollapsibleProps) {
  // open 仅作初始值;触发区点击在内部状态上切换(对齐任务要求的「点击切换 open」)。
  const [expanded, setExpanded] = useState(open)

  const arrowRotation = expanded ? '90deg' : '0deg'
  // max-height 大值兜底常见内容高度;overflow:hidden 收起即隐藏(对应 RN absolute + height 动画的隐藏语义)。
  const contentMaxHeight = expanded ? '1000px' : '0px'

  return (
    <View className={cn('w-full', className)}>
      <View
        className="flex flex-row items-center"
        onClick={() => setExpanded((v) => !v)}
        hoverClass="opacity-60"
      >
        <Text
          className="text-base text-foreground"
          style={{ transform: `rotate(${arrowRotation})`, transition: `transform ${ANIM_DURATION}ms ease` }}
        >
          {'›'}
        </Text>
      </View>
      <View
        style={{
          maxHeight: contentMaxHeight,
          overflow: 'hidden',
          transition: `max-height ${ANIM_DURATION}ms ease`,
        }}
      >
        {children}
      </View>
    </View>
  )
}

export default Collapsible
