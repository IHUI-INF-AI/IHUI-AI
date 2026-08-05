export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-40 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="skeleton h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-1">
                <div className="skeleton h-5 w-28 rounded" />
                <div className="skeleton h-4 w-20 rounded" />
              </div>
            </div>
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="flex gap-3">
              <div className="skeleton h-4 w-16 rounded" />
              <div className="skeleton h-4 w-16 rounded" />
              <div className="skeleton h-4 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}