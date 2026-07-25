'use client'

/**
 * NativeTopBar — Tauri 桌面端自定义顶栏(2026-07-25 紧急桩)
 *
 * 设计目的(摘自 GlobalShell.tsx 138-141 行注释):
 * - 仅 isDesktop=true(Tauri 客户端)时渲染,内部守卫保证 web 端不显示
 * - 横跨 Sidebar + 内容区,统一处理拖拽 + 窗口控制 + 菜单 dropdown
 * - 40px 高,半透明毛玻璃背景 + 底边 1px,与 sidebar 视觉融为一体
 *
 * 当前状态(2026-07-25 立):本文件作为桩存在,因 GlobalShell.tsx 第 7 行
 * 已 import 但实体文件从未提交,导致整个 web 端 dev server 编译失败,
 * 阻塞所有页面(/settings/llm 等返回 Next.js 500)。
 *
 * 桩策略:
 * - web 端 SSR/CSR 一律返回 null(不影响 web UI)
 * - 桌面端渲染基础占位 div(40px 半透明 + 底边 1px)
 * - 不 import tauri-bridge(避免 @tauri-apps/api/core 解析失败,做减法)
 * - 完整窗口拖拽 / 最小化 / 最大化 / 关闭 / 菜单 dropdown 等桌面端功能
 *   由桌面端 agent 接管(本文件预留位置,不越权实现)
 */
import * as React from 'react'

/** inline 桌面端检测,避免 import tauri-bridge 触发 @tauri-apps 解析。 */
function isTauriClient(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function NativeTopBar(): React.ReactElement | null {
  // SSR 阶段无 window,直接返回 null,避免 hydration mismatch
  if (typeof window === 'undefined') return null
  // 浏览器/web 端:完全不渲染,符合"仅桌面端显示"的设计要求
  if (!isTauriClient()) return null

  // 桌面端:渲染基础占位 div(40px 高,半透明背景 + 底边 1px)
  // TODO(desktop-agent):补充窗口拖拽 data-tauri-drag-region、minimize/maximize/close 按钮、菜单 dropdown
  return (
    <div
      data-tauri-drag-region
      className="relative h-10 shrink-0 border-b bg-background/60 backdrop-blur"
    />
  )
}

export default NativeTopBar
