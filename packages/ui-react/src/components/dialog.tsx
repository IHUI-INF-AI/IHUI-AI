'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** 隐藏右上角内置 Close 按钮(2026-08-01 立)
     *  用于 LoginDialog 等场景:外部用 AuthShell 自管关闭按钮,
     *  避免 DOM 中出现两个 Close 按钮(CSS 隐藏不算,影响 E2E 断言 / a11y)。
     *  true → 不渲染 DialogPrimitive.Close,DOM 中只有外部一个按钮。
     */
    hideCloseButton?: boolean
  }
>(({ className, children, hideCloseButton, ...props }, ref) => (
  // 强制 container=document.body(2026-07-28 立):
  //   修复嵌套 Dialog(LoginDialog → LoginForm → AgreementNoticeDialog)时内层 Portal
  //   被合并到外层 Portal 容器的问题;内层 Dialog 一旦渲染到外层容器,fixed 定位的包含块
  //   就被外层 DialogContent 接管,叠加外层的 transform 残留 → 内层弹窗相对外层定位,
  //   视觉上"飘到外层外面"(2026-07-28 用户反馈:协议弹窗出现在视口底部)。
  //   显式传 document.body 强制内层独立到 body 末尾,fixed 始终相对 viewport 居中。
  // 移除 zoom-in-95/zoom-out-95 动画(2026-07-28 立):
  //   原 data-[state=open]:zoom-in-95 关键帧 to { transform: scale(1) } 在动画期间
  //   覆盖了居中用的 translate-x-[-50%] translate-y-[-50%],动画结束后 transform 回到
  //   translate(...) 居中正确——但 React 重渲染/嵌套 Context 等场景下 transform
  //   偶尔残留 scale(1),导致弹窗跑到视口左上 50% 处(= 100% left+top 减去 0% translate),
  //   LoginDialog 顶部 WELCOME 标题被推到视口顶部、协议弹窗被推到视口底部。
  //   改为只保留 fade-in-0/fade-out-0(opacity 动画不影响 transform,居中永远稳)。
  <DialogPrimitive.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
    {/* Overlay 无 fade-in 动画(2026-07-24 立):
        原 fade-in-0 让遮罩从 opacity:0 渐显,在 150ms 动画期间 AI 面板(z-sticky=990)
        以全亮度暴露在遮罩之下,用户视觉感知为"AI 面板跟着登录窗一起发亮"。
        移除 open 态 animate-in + fade-in-0,遮罩瞬间出现,AI 面板从第一帧就被暗化。
        保留 closed 态 fade-out-0,关闭时仍有平滑淡出过渡。 */}
    <DialogPrimitive.Overlay className="fixed inset-0 z-modal bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // 2026-07-31 移动端适配:padding/gap 按断点渐进放大
        //   - 默认(移动端):p-4 gap-3,sm(≥375px)及以上:p-6 gap-4
        //   - max-w-lg + w-full 在小屏会撑满视口减去边距,避免内容溢出
        'fixed left-[50%] top-[50%] z-modal grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-3 border bg-background p-4 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 min-[640px]:rounded-lg min-[640px]:gap-4 min-[640px]:p-6',
        className,
      )}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none">
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
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center min-[640px]:text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse min-[640px]:flex-row min-[640px]:justify-end min-[640px]:space-x-2', className)}
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
