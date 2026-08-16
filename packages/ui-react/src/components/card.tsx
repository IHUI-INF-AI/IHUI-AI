import * as React from 'react'
import { cn } from '../lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border bg-card text-card-foreground shadow', className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    // pb-0 防止与 CardContent 默认 p-4/p-6 形成双 padding,保持 Header→Content 间距与原版一致
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-1.5 p-4 pb-0 min-[640px]:p-6 min-[640px]:pb-0',
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

// CardContent 默认上下 padding 对称 p-4
// 修复前 min-[640px]:p-6 让所有没自定义 className 的 CardContent 在宽屏下 pb 24px（与 "上半部分"不对称的"空间浪费"）
// 自定义调用方须加 min-[640px]:p-X 限定响应式 padding,否则会被此默认值一致化
// 与 CardHeader 配合时由 CardHeader 的 pb-0 对冲,Header→Content 间距恒定 22px
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-4', className)} {...props} />,
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    // 配合 CardContent 默认对称 padding:CardFooter pt-0,Footer→Content 顶部不重复
    // 但 Footer 自己也需要 pb 对称,所以用 p-4 pb-0 / min-[640px]:p-6 min-[640px]:pb-0
    <div
      ref={ref}
      className={cn('flex items-center p-4 pt-0 min-[640px]:p-6 min-[640px]:pt-0', className)}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
