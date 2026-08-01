import { Skeleton } from '@/components/ui/skeleton'

export default function RegistryLoading() {
  return (
    <div className="space-y-4 p-4 min-[768px]:p-6">
      <Skeleton className="h-6 w-40" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} variant="card" className="h-48" />
        ))}
      </div>
    </div>
  )
}
