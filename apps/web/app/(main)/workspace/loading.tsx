/**
 * workspace 页面加载骨架屏(2026-08-05 立)
 *
 * workspace page.tsx 是 'use client' 组件,导入 Dialog/ProjectCard 等组件,
 * 骨架屏提供即时视觉反馈。
 */
export default function WorkspaceLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="skeleton h-7 w-40 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>

      {/* 项目卡片网格骨架 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <div className="mb-3 space-y-2">
              <div className="skeleton h-5 w-3/4 rounded" />
              <div className="skeleton h-3 w-full rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
