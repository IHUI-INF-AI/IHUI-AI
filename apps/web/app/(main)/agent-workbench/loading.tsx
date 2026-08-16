export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 flex-1 rounded" />
      </div>
      <div className="rounded-xl border p-4">
        <div className="flex gap-4">
          <div className="hidden w-48 space-y-2 lg:block">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-8 w-full rounded" />
            ))}
          </div>
          <div className="flex-1 space-y-4">
            <div className="skeleton h-48 w-full rounded-xl" />
            <div className="space-y-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
              <div className="skeleton h-4 w-4/6 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
