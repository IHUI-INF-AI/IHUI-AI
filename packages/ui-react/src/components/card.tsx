// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { cn } from '../lib/utils'
import {
  CARD_CONTENT_PADDING_PX,
  CARD_FOOTER_GAP_PX,
  CARD_HEADER_GAP_PX,
  CARD_PADDING_PX,
  CARD_RADIUS_TIER,
} from '@ihui/shared/ui/card-spec'

/**
 * 平台专属项(不下沉 card-spec,两端允许不同形,逐条登记):
 *  - `ui-lift`(hover 抬升影):依赖 CSS :hover 通道,RN 端无此通道;
 *  - `min-[640px]:` 断点修饰:web 响应式栅格专属,RN 不按断点排版;
 *  - 类名字面量:必须留在本文件 —— Tailwind 只扫本仓 ui-react 源,spec 文件不在扫描面内,
 *    拼串产不出规则;且必须是标准类,调用方的 `p-0` / `pt-6` 才能经 cn 正常覆盖。
 *  ⇒ 取值档一律取自 card-spec,本文件只做"档 → 本端承载类"的映射。
 */
const RADIUS_CLASS: Record<typeof CARD_RADIUS_TIER, string> = { lg: 'rounded-lg' }
const PADDING_CLASS: Record<number, string> = { 12: 'p-3' }
const CONTENT_PADDING_CLASS: Record<number, string> = { 12: 'p-3' }
const HEADER_GAP_CLASS: Record<number, string> = { 6: 'space-y-1.5' }
const FOOTER_GAP_CLASS: Record<number, string> = { 8: 'gap-2' }

// 静止不带 shadow(机主 2026-10-23 定档:全站容器"静止无影、hover 才有影"):
// 原先这里的 Tailwind `shadow` 与 hover 的三层浮起影叠在一起,静止与悬停差值读不出来。
// 边界感由 border 承担。控件(button/input 的 shadow-sm)与浮层(dialog 的 shadow-lg)不在此列。
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'ui-lift border bg-card text-card-foreground',
        RADIUS_CLASS[CARD_RADIUS_TIER],
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    // pb-0 防止与 CardContent 默认 p-3/p-3 形成双 padding,保持 Header→Content 间距与原版一致
    <div
      ref={ref}
      className={cn(
        'flex flex-col',
        PADDING_CLASS[CARD_PADDING_PX],
        'pb-0 min-[640px]:pb-0',
        HEADER_GAP_CLASS[CARD_HEADER_GAP_PX],
        className,
      )}
      {...props}
    />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
)
CardDescription.displayName = 'CardDescription'

// CardContent 默认上下 padding 对称 p-3
// 修复前 让所有没自定义 className 的 CardContent 在宽屏下 pb 24px（与 "上半部分"不对称的"空间浪费"）
// 自定义调用方须加 min-[640px]:p-X 限定响应式 padding,否则会被此默认值一致化
// 与 CardHeader 配合时由 CardHeader 的 pb-0 对冲,Header→Content 间距恒定 22px
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(CONTENT_PADDING_CLASS[CARD_CONTENT_PADDING_PX], className)}
      {...props}
    />
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    // 配合 CardContent 默认对称 padding:CardFooter pt-0,Footer→Content 顶部不重复
    // 但 Footer 自己也需要 pb 对称,所以用 p-3 pb-0 / min-[640px]:pb-0
    <div
      ref={ref}
      className={cn(
        'flex items-center',
        PADDING_CLASS[CARD_PADDING_PX],
        'pt-0 min-[640px]:pt-0',
        FOOTER_GAP_CLASS[CARD_FOOTER_GAP_PX],
        className,
      )}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
