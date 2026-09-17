// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * IconButton — 全项目统一图标按钮(2026-09-17 立)
 *
 * 样式 token 单一来源 = @ihui/design-tokens 的 icon-button.ts
 * (ICON_BUTTON_SIZE / ICON_BUTTON_ICON_SIZE / ICON_BUTTON_BASE_CLASS)。
 *
 * 用途:标题栏、工具栏、面板控制等一切"图标按钮"场景(非关闭,关闭用 CloseButton)。
 * 业务代码禁止手写 h-8 w-8 / h-7 w-7 等散装图标按钮尺寸,一律用本组件;
 * 尺寸档位与 @ihui/design-tokens icon-button.ts 对齐(两档: sm=28 / md=32)。
 *
 * 默认渲染 <button type="button">,无背景,hover 高亮 bg-accent。
 * 尺寸: size='md'(默认 32×32)/ size='sm'(28×28,与 CloseButton 对齐)。
 */
import * as React from 'react'
import { cn } from '../lib/utils'
import { iconButtonClasses, iconButtonIconClasses, type IconButtonSize } from '@ihui/design-tokens'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 尺寸档位(默认 md=32×32,sm=28×28) */
  size?: IconButtonSize
  /** 自定义图标类(覆盖默认图标尺寸类) */
  iconClassName?: string
  /** 图标替代插槽(默认 children;children 传图标节点,本组件自动套图标尺寸类) */
  onDark?: boolean
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { size = 'md', iconClassName, onDark = false, className, children, type = 'button', ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        iconButtonClasses(size),
        onDark && 'text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-white/50',
        className,
      )}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement<{ className?: string }>(child)) {
          const cls = child.props.className
          return React.cloneElement(child as React.ReactElement<{ className?: string }>, {
            className: cn(iconButtonIconClasses(size), iconClassName, cls),
          })
        }
        return child
      }) ?? null}
    </button>
  ),
)
IconButton.displayName = 'IconButton'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
