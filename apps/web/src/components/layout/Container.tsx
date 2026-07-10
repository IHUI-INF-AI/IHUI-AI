import * as React from 'react'
import { cn } from '@/lib/utils'

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: MaxWidth
  padding?: boolean
  centered?: boolean
}

const widthMap: Record<MaxWidth, string> = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
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
        padding && 'px-4 sm:px-6 lg:px-8',
        'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
