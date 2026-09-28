// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export default function Loading() {
  return (
    <div className="flex gap-6 p-3">
      <div className="hidden w-56 space-y-2 lg:block">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-5 w-full rounded" />
        ))}
      </div>
      <div className="flex-1 space-y-4">
        <div className="skeleton h-8 w-64 rounded" />
        <div className="skeleton h-4 w-96 rounded-xs" />
        <div className="skeleton h-48 w-full rounded-xl" />
        <div className="space-y-2">
          <div className="skeleton h-4 w-full rounded-xs" />
          <div className="skeleton h-4 w-full rounded-xs" />
          <div className="skeleton h-4 w-5/6 rounded-xs" />
          <div className="skeleton h-4 w-4/6 rounded-xs" />
        </div>
      </div>
    </div>
  )
}
