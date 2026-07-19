'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * CenteredText — 中文 + 图标垂直对齐助手组件
 *
 * 用法:把任意需要"视觉居中"的文字 span 替换为 `<CenteredText>...</CenteredText>`
 * 内部自动应用 `translateY(var(--text-vcenter-offset))` 抵消中文字体 ink 中心偏差。
 * 默认偏移值 0.3px(globals.css `--text-vcenter-offset`),跨 11 个侧边栏 nav 验证 delta=0.000。
 *
 * 适用场景:
 *  - flex h-* items-center 行内布局(父级有固定高度才有视觉中心)
 *  - icon(任意 SVG) + 中文文字
 *  - 避免反复写 `translate-y-[0.3px]` arbitrary value
 *
 * 不适用场景:
 *  - text-xs 字号(12px)— globals.css 有专用 0.7px 规则,无需手动包组件
 *  - 父级无 h-* 固定高度(没有视觉中心)
 *  - 纯文字 + 纯文字(偏差相互抵消)
 *
 * 实际上 globals.css 第 170 行已建立
 * `:where(button, a, [role=button], [role=menuitem]):has(>svg):has(>span) > span`
 * 全局规则,所有 button/a/[role=button]/[role=menuitem] 子 span 自动应用 translateY。
 * 此组件作为: (a) 非语义元素(如 div、li)场景使用 (b) explicit opt-in 文档化
 *
 * @example
 *   <div className="flex h-9 items-center gap-2">
 *     <Icon className="h-4 w-4" />
 *     <CenteredText>我的学习</CenteredText>
 *   </div>
 */
export interface CenteredTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 是否应用 translateY 偏移(默认 true)。
   *  设为 false 用于: (1) 显式覆盖全局规则 (2) 父级无 h-* */
  enabled?: boolean
}

export const CenteredText = React.forwardRef<HTMLSpanElement, CenteredTextProps>(
  function CenteredText({ enabled = true, className, style, children, ...props }, ref) {
    if (!enabled) {
      return (
        <span ref={ref} className={className} style={style} {...props}>
          {children}
        </span>
      )
    }
    return (
      <span
        ref={ref}
        className={cn('inline-block', className)}
        style={{ transform: 'translateY(var(--text-vcenter-offset))', ...style }}
        {...props}
      >
        {children}
      </span>
    )
  },
)
