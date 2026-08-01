export default function Loading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-3 px-4 py-20">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 animate-pulse rounded-md bg-primary" />
        <span className="h-2.5 w-2.5 animate-pulse rounded-md bg-primary [animation-delay:150ms]" />
        <span className="h-2.5 w-2.5 animate-pulse rounded-md bg-primary [animation-delay:300ms]" />
      </div>
      <p className="animate-pulse text-sm text-muted-foreground">正在获取最新状态...</p>
    </div>
  )
}
