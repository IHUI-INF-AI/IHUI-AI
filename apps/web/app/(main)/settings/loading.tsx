/**
 * settings 页面加载骨架屏(2026-08-05 立)
 *
 * settings page.tsx 是 'use client' 组件,导入 10+ 个子组件
 * (DeviceManager/IpWhitelist/LoginHistory/SecurityScore/SessionManager
 * /TwoFactorAuth/ThemeBackupSync/ThemeCard/LanguageCard/SidebarCard
 * /MiniappQrCard/DesktopSettingsCard),JS 包体积较大。
 * 骨架屏提供即时视觉反馈。
 */
export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <div className="skeleton h-7 w-32 rounded" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>

      {/* Tabs 骨架 */}
      <div className="flex gap-2">
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
        <div className="skeleton h-9 w-24 rounded" />
        <div className="skeleton h-9 w-20 rounded" />
      </div>

      {/* 内容卡片骨架 */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <div className="mb-4 space-y-2">
              <div className="skeleton h-5 w-40 rounded" />
              <div className="skeleton h-3 w-64 rounded" />
            </div>
            <div className="space-y-3">
              <div className="skeleton h-9 w-full rounded" />
              <div className="skeleton h-9 w-3/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
