// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { CLOSE_BUTTON_BASE, CLOSE_BUTTON_ICON, CLOSE_BUTTON_POSITION } from '@ihui/design-tokens'
import { guardEscKeyDown, mergeEscStackRef, useEscStackId } from '../lib/use-esc-stack'
import { cn } from '../lib/utils'

// 2026-09-16:与 dialog.tsx 同款安全降级——SheetTrigger 即 DialogPrimitive.Trigger,
// 游离(无 Root)时预渲染会抛 "`DialogTrigger` must be used within `Dialog`" 导致整页导出失败,
// 降级为纯 children 渲染(HTML 一致,不 hydration mismatch)。
import { InDialogContext } from './dialog'

const Sheet = ({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) => (
  <InDialogContext.Provider value={true}>
    <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>
  </InDialogContext.Provider>
)
const SheetTrigger = ({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>) => {
  const inDialog = React.useContext(InDialogContext)
  if (!inDialog) return <>{children}</>
  return <DialogPrimitive.Trigger {...props}>{children}</DialogPrimitive.Trigger>
}
const SheetClose = DialogPrimitive.Close

const sheetSideVariants = cva(
  // 2026-07-31 移动端适配:padding/gap 按断点渐进放大
  //   - 默认(移动端):p-3 gap-3,sm(≥375px)及以上:p-3 gap-4
  //   - left/right 在 < sm 时占 w-[90vw] 充分利用移动端视口,sm 起恢复 w-3/4 + max-w-sm
  'fixed z-modal flex flex-col gap-3 bg-background p-3 shadow-lg transition data-[state=closed]:duration-(--duration-unified) data-[state=open]:duration-(--duration-unified) ease-unified data-[state=open]:animate-in data-[state=closed]:animate-out min-[640px]:gap-4',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 w-full border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 w-full border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-[90vw] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left min-[640px]:w-3/4 min-[640px]:max-w-sm',
        right:
          'inset-y-0 right-0 h-full w-[90vw] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right min-[640px]:w-3/4 min-[640px]:max-w-sm',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
)

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetSideVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ side = 'right', className, children, onEscapeKeyDown, ...props }, ref) => {
  // 2026-09-16:无 Root 时渲染 null(同 dialog.tsx Content 降级,防 prerender 抛错)。
  const inDialog = React.useContext(InDialogContext)
  // 2026-09-26 Esc 层栈接入(同 dialog.tsx):Content ref callback 同步注册/注销,
  // Esc 非栈顶 → preventDefault 拦下 Radix dismiss。
  const escStackId = useEscStackId()
  const escStackRef = React.useCallback(
    mergeEscStackRef(escStackId, ref),
    [escStackId, ref],
  )
  if (!inDialog) return null
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-modal bg-white/80 dark:bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-(--duration-unified) ease-unified" />
      <DialogPrimitive.Content
        ref={escStackRef}
        onEscapeKeyDown={guardEscKeyDown(escStackId, onEscapeKeyDown)}
        className={cn(sheetSideVariants({ side }), 'rounded-lg', className)}
        {...props}
      >
        {children}
        {/* 2026-09-16:样式 token 化,单一来源 @ihui/design-tokens close-button.ts */}
        <DialogPrimitive.Close className={cn(CLOSE_BUTTON_BASE, CLOSE_BUTTON_POSITION)}>
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
            className={cn(CLOSE_BUTTON_ICON)}
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
SheetContent.displayName = DialogPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-1.5 text-center min-[640px]:text-left', className)}
    {...props}
  />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-2 min-[640px]:flex-row min-[640px]:flex-nowrap min-[640px]:justify-end min-[640px]:gap-2',
      className,
    )}
    {...props}
  />
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
SheetDescription.displayName = DialogPrimitive.Description.displayName

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
