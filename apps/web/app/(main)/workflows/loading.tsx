export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-40 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 flex-1 rounded" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-1">
                <div className="skeleton h-5 w-32 rounded" />
                <div className="skeleton h-4 w-20 rounded" />
              </div>
              <div className="skeleton h-6 w-16 rounded" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <div className="skeleton h-2 flex-1 rounded" />
                <div className="skeleton h-2 w-12 rounded" />
              </div>
              <div className="skeleton h-4 w-24 rounded" />
            </div>
            <div className="mt-3 flex gap-2">
              <div className="skeleton h-7 w-16 rounded" />
              <div className="skeleton h-7 w-16 rounded" />
              <div className="skeleton h-7 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
