export default function Loading() {
  return (
    <div className="flex gap-6 p-6">
      <div className="hidden w-56 space-y-2 lg:block">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-5 w-full rounded" />
        ))}
      </div>
      <div className="flex-1 space-y-4">
        <div className="skeleton h-8 w-64 rounded" />
        <div className="skeleton h-4 w-96 rounded" />
        <div className="skeleton h-48 w-full rounded-xl" />
        <div className="space-y-2">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-5/6 rounded" />
          <div className="skeleton h-4 w-4/6 rounded" />
        </div>
      </div>
    </div>
  )
}