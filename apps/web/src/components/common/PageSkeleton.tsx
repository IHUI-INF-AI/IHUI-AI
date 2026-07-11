import { cn } from '@/lib/utils'

interface PageSkeletonProps {
  hasHeader?: boolean
  hasSidebar?: boolean
  className?: string
}

export function PageSkeleton({ hasHeader = true, className }: PageSkeletonProps) {
  return (
    <div className={cn('w-full space-y-4 p-4', className)}>
      {hasHeader && (
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-20 animate-pulse rounded bg-muted" />
            <div className="h-9 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`skel-${i}`} className="rounded-xl border p-4 shadow">
            <div className="mb-3 h-10 w-10 animate-pulse rounded-lg bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-4 shadow">
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`skel-${i}`} className="flex items-center gap-3">
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
