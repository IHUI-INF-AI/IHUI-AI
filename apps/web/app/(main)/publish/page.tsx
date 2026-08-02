import { redirect } from 'next/navigation'

// 2026-08-02 fix:publish 段无 page.tsx,sidebar 入口 /publish 直接访问 404。
// 默认落在发布历史(总览:总任务/成功/失败/成功率),5 个 tab 均可从 layout 导航切换。
export default function PublishPage() {
  redirect('/publish/history')
}
