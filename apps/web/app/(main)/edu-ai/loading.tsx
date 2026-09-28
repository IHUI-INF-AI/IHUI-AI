// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="skeleton h-8 w-40 rounded" />
        <div className="skeleton h-4 w-56 rounded-xs" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-3">
            <div className="flex items-center gap-3">
              <div className="skeleton h-9 w-9 rounded" />
              <div className="skeleton h-4 w-32 rounded-xs" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="skeleton h-3 w-full rounded-xs" />
              <div className="skeleton h-3 w-4/5 rounded-xs" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
