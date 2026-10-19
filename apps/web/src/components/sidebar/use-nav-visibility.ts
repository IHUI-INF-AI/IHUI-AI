// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 导航可见性过滤(2026-10-19 立,P2 域入口页落地页复用)
 *
 * 立因:权限过滤原先是 `Sidebar.tsx` 私有的 `filterByRole` 回调。P2 要新增
 * 域入口页(/edu、/content、/trade 三个 CategoryShell 落地页),它们同样要把
 * `EDU_ITEMS` 之类**带权限点的导航项**渲染成列表 —— 若各写一份过滤,必然漂移,
 * 且漏写就是权限漏洞:普通用户会看到「教务管理 / 成绩管理 / 食堂采购」这类
 * `permission: 'edu:manage'` 的入口,点进去只剩 403/404(AGENTS.md §5 鉴权面
 * 公开化禁令针对的 fail-open 表现)。
 *
 * 故把判据抽到本模块,Sidebar 与落地页共用同一实现(单一真相源,AGENTS.md §0.6)。
 * 任何一方改规则,两边同时生效。
 *
 * 判定规则(与原 Sidebar 实现逐字一致,迁移时未改语义):
 *  - `adminOnly` → 仅 roleId ≥ 1
 *  - `permission` → admin 直接放行;其余须持有任一权限码或通配符 `*:*:*` / `*`
 *    (与后端 `HasPermi.checkPermission` 的匹配规则一致)
 *  - `permission` 支持数组:任一命中即可见(如只读教师持 'edu:view')
 *  - 递归:父项 children 同样过滤
 *
 * 注意:本 hook 只过滤**可见性**,不做鉴权。真正的准入在后端路由层
 * (admin 路由 preHandler 统一校验 roleId ≥ 1),前端过滤只为不给无权用户
 * 渲染入口。
 */

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import type { NavItem } from './types'

/**
 * 递归过滤导航项树,移除当前用户无权看到的条目。
 *
 * @param items  导航项数组
 * @param isAdmin       roleId ≥ 1
 * @param userPermissions 用户权限码数组(可能为 undefined / 空)
 * @returns 过滤后的新数组(输入不被修改);父项若无可见子项则仍保留父项本身,
 *          因为父项本身可能是合法入口(如「我的学习」)
 */
export function filterNavItemsByRole(
  items: NavItem[],
  isAdmin: boolean,
  userPermissions: readonly string[] | undefined,
): NavItem[] {
  return items
    .filter((item) => {
      if (item.adminOnly) return isAdmin
      if (item.permission) {
        if (isAdmin) return true
        if (!userPermissions || userPermissions.length === 0) return false
        if (userPermissions.includes('*:*:*') || userPermissions.includes('*')) return true
        const required = Array.isArray(item.permission) ? item.permission : [item.permission]
        return required.some((p) => userPermissions.includes(p))
      }
      return true
    })
    .map((item) =>
      item.children
        ? { ...item, children: filterNavItemsByRole(item.children, isAdmin, userPermissions) }
        : item,
    )
}

/**
 * 返回一个按当前登录用户权限过滤导航树的回调。
 *
 * 引用稳定(依赖数组只含两个标量/稳定引用),可直接放进 `useMemo` 依赖。
 *
 * @example
 * const filterByRole = useNavVisibilityFilter()
 * const visible = React.useMemo(() => filterByRole(NAV_GROUPS), [filterByRole])
 */
export function useNavVisibilityFilter(): (items: NavItem[]) => NavItem[] {
  const userRoleId = useAuthStore((s) => s.user?.roleId)
  // 仅订阅 permissions 单字段(而非整个 user 对象),避免 setUser 触发全量重渲染
  const userPermissions = useAuthStore((s) => s.user?.permissions)

  const isAdmin = (userRoleId ?? 0) >= 1

  return React.useCallback(
    (items: NavItem[]): NavItem[] => filterNavItemsByRole(items, isAdmin, userPermissions),
    [isAdmin, userPermissions],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
