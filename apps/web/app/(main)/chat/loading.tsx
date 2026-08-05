export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6">
      <div className="skeleton h-16 w-16 rounded-xl" />
      <div className="skeleton h-8 w-48 rounded" />
      <div className="skeleton h-4 w-64 rounded" />
      <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}