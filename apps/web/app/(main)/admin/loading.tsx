/**
 * admin 路由组加载骨架屏(2026-08-05 立)
 *
 * 作为 admin 所有子页面的 fallback loading。当 admin 子页面
 * (users/roles/members/settings 等)没有独立 loading.tsx 时，
 * Next.js 会向上冒泡到此文件。
 *
 * 轻量化设计:纯 CSS 骨架,无 JS 依赖,浏览器可立即渲染。
 * 50ms 渐入延迟,导航快(<50ms)时完全不显示,防止"闪一下"。
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-6 opacity-0 transition-opacity duration-200 delay-50">
      {/* 标题骨架 */}
      <div className="space-y-2">
        <div className="skeleton h-7 w-40 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>

      {/* 内容卡片骨架 */}
      <div className="rounded-lg border border-border">
        {/* 表头 */}
        <div className="grid grid-cols-4 gap-4 border-b border-border px-4 py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-4 rounded" />
          ))}
        </div>
        {/* 数据行 */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-4 gap-4 border-b border-border px-4 py-3 last:border-b-0"
          >
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="skeleton h-4 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}