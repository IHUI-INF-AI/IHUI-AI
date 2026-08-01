import * as React from 'react'
import { cn } from '@/lib/utils'

type Cols = 1 | 2 | 3 | 4 | 5 | 6 | 12

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: Cols
  smCols?: Cols
  mdCols?: Cols
  lgCols?: Cols
  gap?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
}

// 静态类名映射:Tailwind JIT 必须看到完整类名字符串才能生成响应式样式
// 动态拼接 `sm:${colsMap[x]}` 会导致响应式断点失效
const colsMap: Record<Cols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
}

const smColsMap: Record<Cols, string> = {
  1: 'min-[640px]:grid-cols-1',
  2: 'min-[640px]:grid-cols-2',
  3: 'min-[640px]:grid-cols-3',
  4: 'min-[640px]:grid-cols-4',
  5: 'min-[640px]:grid-cols-5',
  6: 'min-[640px]:grid-cols-6',
  12: 'min-[640px]:grid-cols-12',
}

const mdColsMap: Record<Cols, string> = {
  1: 'min-[768px]:grid-cols-1',
  2: 'min-[768px]:grid-cols-2',
  3: 'min-[768px]:grid-cols-3',
  4: 'min-[768px]:grid-cols-4',
  5: 'min-[768px]:grid-cols-5',
  6: 'min-[768px]:grid-cols-6',
  12: 'min-[768px]:grid-cols-12',
}

const lgColsMap: Record<Cols, string> = {
  1: 'min-[1024px]:grid-cols-1',
  2: 'min-[1024px]:grid-cols-2',
  3: 'min-[1024px]:grid-cols-3',
  4: 'min-[1024px]:grid-cols-4',
  5: 'min-[1024px]:grid-cols-5',
  6: 'min-[1024px]:grid-cols-6',
  12: 'min-[1024px]:grid-cols-12',
}

const gapMap = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
}

export function Grid({
  cols = 3,
  smCols,
  mdCols,
  lgCols,
  gap = 'md',
  className,
  children,
  ...props
}: GridProps) {
  return (
    <div
      className={cn(
        'grid',
        colsMap[cols],
        smCols && smColsMap[smCols],
        mdCols && mdColsMap[mdCols],
        lgCols && lgColsMap[lgCols],
        gapMap[gap],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
