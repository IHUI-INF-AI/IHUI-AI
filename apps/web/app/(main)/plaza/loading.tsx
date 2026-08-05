export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-4 w-72 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-1">
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton h-3 w-16 rounded" />
              </div>
            </div>
            <div className="skeleton h-5 w-3/4 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="flex gap-4">
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