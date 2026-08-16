export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-36 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6 space-y-4">
            <div className="space-y-2">
              <div className="skeleton h-6 w-24 rounded" />
              <div className="skeleton h-10 w-32 rounded" />
              <div className="skeleton h-4 w-20 rounded" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="skeleton h-4 w-4 rounded" />
                  <div className="skeleton h-4 flex-1 rounded" />
                </div>
              ))}
            </div>
            <div className="skeleton h-10 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
