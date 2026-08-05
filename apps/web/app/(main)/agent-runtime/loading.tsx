export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-40 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="flex gap-4">
        <div className="flex-1 space-y-4">
          <div className="rounded-xl border p-4 space-y-3">
            <div className="skeleton h-6 w-48 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="flex gap-2">
              <div className="skeleton h-8 w-20 rounded" />
              <div className="skeleton h-8 w-20 rounded" />
            </div>
          </div>
          <div className="rounded-xl border p-4 space-y-2">
            <div className="skeleton h-5 w-32 rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="skeleton h-8 w-8 rounded" />
                <div className="flex-1 space-y-1">
                  <div className="skeleton h-4 w-32 rounded" />
                  <div className="skeleton h-3 w-24 rounded" />
                </div>
                <div className="skeleton h-5 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden w-64 space-y-4 lg:block">
          <div className="rounded-xl border p-4 space-y-3">
            <div className="skeleton h-5 w-24 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
          </div>
          <div className="rounded-xl border p-4 space-y-3">
            <div className="skeleton h-5 w-24 rounded" />
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-4 w-32 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}