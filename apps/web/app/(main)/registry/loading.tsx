import { Skeleton } from '@/components/ui/skeleton'

export default function RegistryLoading() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Skeleton className="h-6 w-40" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} variant="card" className="h-48" />
        ))}
      </div>
    </div>
  )
}
