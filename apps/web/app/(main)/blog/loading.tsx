// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export default function Loading() {
  return (
    <div className="space-y-4 p-3">
      <div className="space-y-2">
        <div className="skeleton h-8 w-36 rounded" />
        <div className="skeleton h-4 w-64 rounded-xs" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-3">
              <div className="skeleton h-40 w-full rounded-lg" />
              <div className="mt-3 space-y-2">
                <div className="skeleton h-6 w-3/4 rounded" />
                <div className="skeleton h-4 w-full rounded-xs" />
                <div className="skeleton h-4 w-2/3 rounded-xs" />
                <div className="flex gap-3">
                  <div className="skeleton h-4 w-20 rounded-xs" />
                  <div className="skeleton h-4 w-24 rounded-xs" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border p-3 space-y-3">
            <div className="skeleton h-6 w-24 rounded" />
            <div className="skeleton h-4 w-full rounded-xs" />
            <div className="skeleton h-4 w-full rounded-xs" />
            <div className="skeleton h-4 w-3/4 rounded-xs" />
          </div>
          <div className="rounded-xl border p-3 space-y-3">
            <div className="skeleton h-6 w-24 rounded" />
            <div className="skeleton h-4 w-32 rounded-xs" />
            <div className="skeleton h-4 w-32 rounded-xs" />
            <div className="skeleton h-4 w-32 rounded-xs" />
            <div className="skeleton h-4 w-32 rounded-xs" />
          </div>
        </div>
      </div>
    </div>
  )
}
