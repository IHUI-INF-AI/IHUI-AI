export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-40 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="flex gap-4">
        <div className="skeleton h-10 flex-1 rounded" />
        <div className="skeleton h-10 w-32 rounded" />
        <div className="skeleton h-10 w-32 rounded" />
      </div>
      <div className="rounded-xl border">
        <div className="border-b p-4">
          <div className="flex gap-4">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-4 w-24 rounded" />
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-4 last:border-b-0">
            <div className="skeleton h-8 w-8 rounded-lg" />
            <div className="skeleton h-4 w-32 flex-1 rounded" />
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-4 w-20 rounded" />
            <div className="skeleton h-4 w-28 rounded" />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-2">
        <div className="skeleton h-9 w-24 rounded" />
        <div className="skeleton h-9 w-24 rounded" />
      </div>
    </div>
  )
}