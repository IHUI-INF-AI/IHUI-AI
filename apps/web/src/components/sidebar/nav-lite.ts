// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Bell, FolderOpen, ListChecks, Play, User } from 'lucide-react'

import type { NavItem } from './types'

/**
 * 五项主导航(2026-11-28 立,入口收敛第二批)
 *
 * 立因:侧栏挂着 100+ 项,175 个一级页面平铺,用户找不着"从哪开始"。
 * 这里把入口收到五件事:开始 → 任务 → 资产 → 消息 → 我的,
 * 其余全部沉到 /all(可搜索的全量目录)。
 *
 * 开关:`NEXT_PUBLIC_IHUI_NAV_LITE=0` 回退。默认开(2026-11-28 用户确认"继续"后翻默认),
 * 置 0 时旧导航逐像素不变,用于线上出问题时的一键回滚。
 * 历史:2026-11-26 曾拍板另一套五项(商店/广场/社区/动态/我的)并与小程序 tabBar 对齐;
 * 本套是 11-28 入口收敛清单里重新定的五项,旧页全部沉到 /all,不丢入口。
 */
export const NAV_LITE_ENABLED = process.env.NEXT_PUBLIC_IHUI_NAV_LITE !== '0'

/** 五项主导航。顺序即渲染顺序;labelKey 走 nav 命名空间(五语言词库已补齐)。 */
export const NAV_LITE_PRIMARY: NavItem[] = [
  { href: '/start', labelKey: 'start', icon: Play },
  { href: '/publish/history', labelKey: 'tasks', icon: ListChecks },
  { href: '/assets', labelKey: 'assets', icon: FolderOpen },
  { href: '/messages', labelKey: 'messagesShort', icon: Bell },
  { href: '/user/profile', labelKey: 'mine', icon: User },
]

/** 「全部功能」全量目录页。五项之外的旧页从这里进,不再挂侧栏。 */
export const NAV_LITE_ALL_HREF = '/all'
