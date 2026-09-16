// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

/**
 * CloseButton — 全项目统一关闭按钮(2026-09-16 立)
 *
 * 样式 token 单一来源 = @ihui/design-tokens 的 close-button.ts
 * (CLOSE_BUTTON_BASE / CLOSE_BUTTON_ON_DARK / CLOSE_BUTTON_POSITION / CLOSE_BUTTON_ICON)。
 *
 * 用途:弹窗、抽屉、侧滑面板、全屏浮层等一切"关闭"入口。
 * 业务代码禁止手写散装关闭按钮样式,一律用本组件;
 * 若必须用 Radix DialogPrimitive.Close(要 stopPropagation 等),
 * 也必须引用 design-tokens 的类名常量拼装,不许自造尺寸/定位。
 *
 * 默认渲染 <button type="button"> + lucide X 图标。
 * 需要作为 Radix 关闭器时: <DialogPrimitive.Close asChild><CloseButton …/></DialogPrimitive.Close>
 */
import * as React from 'react'
import { X } from 'lucide-react'
import {
  CLOSE_BUTTON_BASE,
  CLOSE_BUTTON_ICON,
  CLOSE_BUTTON_ON_DARK,
  CLOSE_BUTTON_POSITION,
} from '@ihui/design-tokens'
import { cn } from '../lib/utils'

export interface CloseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 深底/全屏遮罩场景(图片查看器等),切换为白色系 token */
  onDark?: boolean
  /** 浮层右上角定位模式(追加 absolute right-3 top-3);标题栏行内场景不加 */
  floating?: boolean
  /** 自定义图标类(一般不需要) */
  iconClassName?: string
  /** 图标替代插槽(默认 lucide X);传 sr-only 文案走 children/aria-label */
}

export const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(
  (
    {
      onDark = false,
      floating = false,
      iconClassName,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      aria-label={props['aria-label'] ?? 'Close'}
      className={cn(
        onDark ? CLOSE_BUTTON_ON_DARK : CLOSE_BUTTON_BASE,
        floating && CLOSE_BUTTON_POSITION,
        className,
      )}
      {...props}
    >
      {children ?? <X className={cn(CLOSE_BUTTON_ICON, iconClassName)} />}
    </button>
  ),
)
CloseButton.displayName = 'CloseButton'
