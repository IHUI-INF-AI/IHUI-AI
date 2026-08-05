export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="skeleton h-5 w-20 rounded" />
      <div className="space-y-2">
        <div className="skeleton h-8 w-56 rounded" />
        <div className="skeleton h-4 w-96 rounded" />
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-24 rounded" />
        ))}
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-10 w-32 rounded" />
        <div className="skeleton h-10 w-40 rounded" />
        <div className="skeleton h-10 w-36 rounded" />
        <div className="skeleton h-10 w-28 rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
            <div className="skeleton h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-5 w-48 rounded" />
              <div className="skeleton h-4 w-64 rounded" />
            </div>
            <div className="skeleton h-6 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}