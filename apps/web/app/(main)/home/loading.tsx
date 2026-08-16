export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-4 w-72 rounded" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-2">
            <div className="skeleton h-10 w-10 rounded-lg" />
            <div className="skeleton h-5 w-24 rounded" />
            <div className="skeleton h-4 w-16 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-4">
        <div className="skeleton h-5 w-32 rounded" />
        <div className="mt-3 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-4 w-4 rounded" />
              <div className="skeleton h-4 flex-1 rounded" />
              <div className="skeleton h-4 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
