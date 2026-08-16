/**
 * user/profile 页面加载骨架屏(2026-08-05 立)
 *
 * user/profile page.tsx 是 'use client' 组件,导入 ProfileAvatar/ProfileStatsCards
 * /ProfileAccountInfo/ProfileEditForm/TokenUsagePanel/RoutinesPanel/VoiceRecord 等组件。
 */
export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      {/* 标题 + 返回按钮 */}
      <div className="flex items-center gap-3">
        <div className="skeleton h-8 w-8 rounded" />
        <div className="space-y-1">
          <div className="skeleton h-6 w-24 rounded" />
          <div className="skeleton h-3 w-40 rounded" />
        </div>
      </div>

      {/* 头像 + 统计卡片 */}
      <div className="flex items-center gap-6">
        <div className="skeleton h-20 w-20 rounded-full" />
        <div className="flex flex-1 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col gap-2 rounded-lg border border-border p-4">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-7 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 表单骨架 */}
      <div className="rounded-lg border border-border p-4">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-9 w-full rounded" />
            </div>
          ))}
          <div className="skeleton h-9 w-24 rounded" />
        </div>
      </div>
    </div>
  )
}
