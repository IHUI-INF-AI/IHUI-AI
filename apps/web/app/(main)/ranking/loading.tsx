export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-36 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-24 rounded" />
        <div className="skeleton h-9 w-24 rounded" />
        <div className="skeleton h-9 w-24 rounded" />
      </div>
      <div className="rounded-xl border">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-4 last:border-b-0">
            <div className="skeleton h-6 w-6 rounded" />
            <div className="skeleton h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-1">
              <div className="skeleton h-5 w-32 rounded" />
              <div className="skeleton h-4 w-20 rounded" />
            </div>
            <div className="skeleton h-5 w-16 rounded" />
            <div className="skeleton h-5 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}