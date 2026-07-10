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

const colsMap: Record<Cols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
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
        smCols && `sm:${colsMap[smCols]}`,
        mdCols && `md:${colsMap[mdCols]}`,
        lgCols && `lg:${colsMap[lgCols]}`,
        gapMap[gap],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
