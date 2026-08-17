'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useNavigationStore } from '@/stores/navigation'

/**
 * NavigationProgress — 全局导航进度条
 *
 * 覆盖层已迁移到 GlobalShell 直接渲染(2026-08-05 根治方案):
 * 根因:条件渲染(if (!pending) return null)依赖 React 渲染周期,在 Next.js 16 导航中
 * 点击 Link 后客户端路由立即开始,React 渲染可能滞后,导致覆盖层显示延迟甚至不显示。
 * 用户点击后看不到任何视觉反馈,误以为"没有响应"。
 *
 * 根治:覆盖层直接在 GlobalShell 中渲染,始终在 DOM 中,
 * 通过 CSS transition 控制显示/隐藏(https://react.dev/reference/react-dom/components/common#conditional-rendering),
 * 不依赖条件渲染,保证点击后立即显示。
 *
 * 本组件只保留顶部进度条。
 */
export function NavigationProgress() {
  const pending = useNavigationStore((s) => s.pending)
  const end = useNavigationStore((s) => s.end)
  const pathname = usePathname()
  const prevPathname = React.useRef(pathname)
  // 兜底定时器:防止 pending 永久卡住(点击相同页面/导航失败后 pending 无法结束)
  const fallbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // 每次 start() 被调用(点击链接)时,设置 10s 兜底定时器
  React.useEffect(() => {
    if (pending && !fallbackTimerRef.current) {
      fallbackTimerRef.current = setTimeout(() => {
        end()
        fallbackTimerRef.current = null
      }, 10_000)
    }
    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    }
  }, [pending, end])

  // 检测 pathname 变化 → 导航完成
  React.useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      // 最小显示 200ms，避免"闪一下"的糟糕体验
      const timer = setTimeout(() => end(), 200)
      return () => clearTimeout(timer)
    }
  }, [pathname, end])

  if (!pending) return null

  return (
    <>
      {/* 顶部进度条 */}
      <div
        className="fixed left-0 right-0 top-0 z-[9999] h-0.5 overflow-hidden bg-primary/10"
        role="progressbar"
        aria-label="页面加载中"
      >
        <div className="h-full w-1/2 origin-left animate-[nav-progress_1s_ease-in-out_infinite] bg-primary" />
      </div>
    </>
  )
}
