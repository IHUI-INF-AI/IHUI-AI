'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  // 彻底根除嵌套 Dialog 定位错乱(2026-07-28 立,简化上次的 container hack):
  //   上次为了"修复嵌套 Dialog fixed 定位参考系错误"显式传 container={document.body},
  //   但 Radix 1.x 在嵌套 Dialog 场景下默认就能正确处理 Portal 容器,显式传 document.body
  //   在某些 React 重渲染时机反而引入新歧义。回归 Radix 默认行为,让内层 Dialog Portal
  //   自动追加到 body 末尾,fixed 始终相对 viewport 居中。
  // 移除所有 zoom-in-95/zoom-out-95 关键帧动画(2026-07-28 立):
  //   原 data-[state=open]:zoom-in-95 关键帧 to { transform: scale(1) } 在动画期间
  //   覆盖了居中用的 translate-x-[-50%] translate-y-[-50%],动画结束后 transform 回到
  //   translate(...) 居中正确——但 React 重渲染/嵌套 Context 等场景下 transform
  //   偶尔残留 scale(1),导致弹窗跑到视口左上 50% 处(= 100% left+top 减去 0% translate)。
  //   同样保留 fade-in-0/fade-out-0(opacity 动画不影响 transform,居中永远稳)。
  <DialogPrimitive.Portal>
    {/* Overlay 无 fade-in 动画(2026-07-24 立):
        原 fade-in-0 让遮罩从 opacity:0 渐显,在 150ms 动画期间 AI 面板(z-sticky=990)
        以全亮度暴露在遮罩之下,用户视觉感知为"AI 面板跟着登录窗一起发亮"。
        移除 open 态 animate-in + fade-in-0,遮罩瞬间出现,AI 面板从第一帧就被暗化。
        保留 closed 态 fade-out-0,关闭时仍有平滑淡出过渡。 */}
    <DialogPrimitive.Overlay className="fixed inset-0 z-modal bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-modal grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 sm:rounded-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
}
