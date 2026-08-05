/**
 * (main) 路由组加载骨架屏 — 路由切换时立刻显示，无需等待 layout 渲染完成。
 * 在用户点击侧边栏导航后，浏览器立即替换为 skeleton 占位，消除"无响应"空白期。
 *
 * 使用 PageSkeleton 组件渲染全页骨架屏，填充整个工作区内容区域，
 * 提供"已响应点击"的即时视觉反馈。
 */
import { PageSkeleton } from '@/components/common/PageSkeleton'

export default function MainLoading() {
  return (
    <div className="h-full w-full" role="status" aria-label="页面加载中">
      <PageSkeleton />
    </div>
  )
}