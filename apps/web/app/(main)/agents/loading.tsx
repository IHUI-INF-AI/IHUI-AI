export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <div className="skeleton h-5 w-20 rounded" />
      <div className="space-y-2">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-4 w-72 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
      </div>
      <div className="flex gap-4">
        <div className="skeleton h-10 w-48 rounded" />
        <div className="skeleton h-10 w-32 rounded" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <div className="skeleton h-32 w-full rounded-lg" />
            <div className="skeleton h-5 w-3/4 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}