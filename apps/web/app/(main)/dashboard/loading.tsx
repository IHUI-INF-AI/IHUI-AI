// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export default function Loading() {
  return (
    <div className="space-y-4 p-3">
      <div className="space-y-2">
        <div className="skeleton h-8 w-40 rounded" />
        <div className="skeleton h-4 w-64 rounded-xs" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-3 space-y-2">
            <div className="skeleton h-4 w-16 rounded-xs" />
            <div className="skeleton h-8 w-24 rounded" />
            <div className="skeleton h-3 w-20 rounded-xs" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-3 space-y-3">
          <div className="skeleton h-5 w-24 rounded" />
          <div className="skeleton h-40 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border p-3 space-y-3">
          <div className="skeleton h-5 w-24 rounded" />
          <div className="skeleton h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
