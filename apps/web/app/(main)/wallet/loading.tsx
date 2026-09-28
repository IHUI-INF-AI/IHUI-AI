// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export default function Loading() {
  return (
    <div className="space-y-4 p-3">
      <div className="space-y-2">
        <div className="skeleton h-8 w-36 rounded" />
        <div className="skeleton h-4 w-64 rounded-xs" />
      </div>
      <div className="rounded-xl border p-3 space-y-4">
        <div className="space-y-2">
          <div className="skeleton h-4 w-20 rounded-xs" />
          <div className="skeleton h-10 w-40 rounded" />
          <div className="skeleton h-4 w-32 rounded-xs" />
        </div>
        <div className="flex gap-4">
          <div className="skeleton h-10 flex-1 rounded" />
          <div className="skeleton h-10 w-32 rounded" />
        </div>
      </div>
      <div className="rounded-xl border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-3 last:border-b-0">
            <div className="skeleton h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-1">
              <div className="skeleton h-5 w-32 rounded" />
              <div className="skeleton h-4 w-20 rounded-xs" />
            </div>
            <div className="skeleton h-5 w-20 rounded" />
            <div className="skeleton h-5 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
