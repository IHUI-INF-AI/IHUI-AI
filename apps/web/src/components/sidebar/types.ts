import type * as React from 'react'

export interface NavItem {
  href: string
  /** i18n key,通过 useTranslations('nav') 解析。改为 string 类型以支持 admin 等动态命名空间。 */
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  children?: NavItem[]
  /** 动态标签,优先级高于 labelKey。用于 admin 后端动态加载的路由名(如 'Operation Log')。 */
  dynamicLabel?: string
  /** 未读数 badge 来源:'messages' 私信未读 / 'notification' 通知未读。 */
  badge?: 'messages' | 'notification'
}

/** 导航项 ref 注册回调:把 href -> DOM 元素 映射存入 Sidebar 的 itemRefs。 */
export type RegisterRef = (href: string, el: HTMLElement | null) => void

export interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  id?: string
  mobileOpen: boolean
  onCloseMobile: () => void
}
