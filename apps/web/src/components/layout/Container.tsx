import * as React from 'react'
import { cn } from '@/lib/utils'

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: MaxWidth
  padding?: boolean
  centered?: boolean
}

// 2026-08-01 修复:max-w-screen-* 依赖 --breakpoint-* 变量,但项目自定义断点
// (--breakpoint-lg:576px 等)导致 max-w-screen-lg=576px/max-w-screen-xl=1920px 全部错位。
// 改为固定 px 任意值,不依赖断点变量,语义明确。
//   sm  = 420px  (窄表单/对话框内容)
//   md  = 672px  (标准设置页,20 个 settings 页面默认值)
//   lg  = 896px  (宽设置页,如 import)
//   xl  = 1152px (超宽,如 LLM 配置/gateway)
//   2xl = 1280px (最宽)
const widthMap: Record<MaxWidth, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[672px]',
  lg: 'max-w-[896px]',
  xl: 'max-w-[1152px]',
  '2xl': 'max-w-[1280px]',
  full: 'max-w-full',
}

export function Container({
  maxWidth = 'lg',
  padding = true,
  centered = true,
  className,
  children,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        widthMap[maxWidth],
        centered && 'mx-auto',
        // 2026-08-01 padding 断点对齐:原 min-[640px]:px-6/min-[1024px]:px-8 依赖自定义断点
        // (--breakpoint-sm:375px/--breakpoint-lg:576px),min-[1024px]:px-8 在 576px 就触发过早。
        // 改为 min-[640px]/min-[1024px] 任意值,与移动端适配断点体系一致。
        padding && 'px-4 min-[640px]:px-6 min-[1024px]:px-8',
        'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
