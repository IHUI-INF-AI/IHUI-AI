// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="skeleton h-8 w-36 rounded" />
        <div className="skeleton h-4 w-56 rounded-xs" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-24 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border p-3">
            <div className="skeleton h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="skeleton h-4 w-24 rounded-xs" />
                <div className="skeleton h-3 w-16 rounded-xs" />
              </div>
              <div className="skeleton h-4 w-full rounded-xs" />
              <div className="skeleton h-4 w-4/5 rounded-xs" />
            </div>
            <div className="skeleton h-4 w-12 rounded-xs" />
          </div>
        ))}
      </div>
    </div>
  )
}
