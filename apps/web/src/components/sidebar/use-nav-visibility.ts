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
 * 2026-10-20 第二层:在 role 之上叠加**用户自选层**(`filterNavItemsByTier`,见下方)。
 * role 判"能不能看",tier 判"要不要给普通人看" —— 后者是产品降噪,不是鉴权,
 * 两层严格分开,`useNavVisibilityFilter` 是唯一的组合出口。
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
import { useNavVisibilityStore } from '@/stores/nav-visibility'
import type { NavAdvancedTier, NavItem } from './types'

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
 * 用户自选可见性过滤(2026-10-20 立,简洁模式)
 *
 * 与上面那层**必须分开**,两者判的是完全不同的事:
 *  - `filterNavItemsByRole` 判 **能不能看** —— 越权即权限漏洞,必须服务器端对齐;
 *  - `filterNavItemsByTier` 判 **要不要给普通人看** —— 用户完全有权访问 /models/logs
 *    和 /developer,只是这些东西摆在他菜单里是纯噪声(甚至会让他误以为看到的是自己的数据)。
 *
 * 二者顺序不可换:先 role 后 tier。反过来先剔除 tier 项会让某些 role 分支输入集变小,
 * 而漏过滤的下危险一倍 —— role 是安全边界,必须最后落下时仍是完整集。
 *
 * @param items        导航项
 * @param hiddenTiers  用户选择隐藏的档位
 * @param inherited    祖先继承下来的档位;子项未自标时用它(见 types.ts 的继承规则)
 */
export function filterNavItemsByTier(
  items: NavItem[],
  hiddenTiers: readonly NavAdvancedTier[],
  inherited?: NavAdvancedTier,
): NavItem[] {
  if (hiddenTiers.length === 0 && inherited === undefined) return items
  return items
    .filter((item) => {
      const tier = item.advancedOnly ?? inherited
      return tier === undefined || !hiddenTiers.includes(tier)
    })
    .map((item) => {
      const tier = item.advancedOnly ?? inherited
      return item.children
        ? { ...item, children: filterNavItemsByTier(item.children, hiddenTiers, tier) }
        : item
    })
}
/**
 * 返回按「当前用户权限」+「用户自选档位」两层过滤导航树的回调。
 *
 * 2026-10-20 起本回调是**两层**,但调用方一行都不用改 —— Sidebar 与三个域入口页
 * (DomainHub)共用此处,改判据两边同时生效(单一真相源,AGENTS.md §0.6)。
 * 这正是当初把 role 判据从 Sidebar 抽出来时定下的形状,今天第二次收益。
 *
 * 水合也挂在这里(`hydrate` 幂等):遵循"谁消费导航谁负责让它可用",
 * 将来新增第四个消费页不必记得补 hydrate 调用。
 *
 * @example
 * const filterNav = useNavVisibilityFilter()
 * const visible = React.useMemo(() => filterNav(NAV_GROUPS), [filterNav])
 */
export function useNavVisibilityFilter(): (items: NavItem[]) => NavItem[] {
  const userRoleId = useAuthStore((s) => s.user?.roleId)
  // 仅订阅 permissions 单字段(而非整个 user 对象),避免 setUser 触发全量重渲染
  const userPermissions = useAuthStore((s) => s.user?.permissions)
  const userId = useAuthStore((s) => s.user?.id ?? null)

  // 用**内容签名**而不是数组引用当依赖(AGENTS.md 前端铁律):store 每次写入都换新数组引用,
  // 直接当依赖会在每次 unrel set 后重算过滤;签名只在内容真变时才重算。
  const tiersKey = useNavVisibilityStore((s) => s.hiddenTiers.join('|'))
  const hydrated = useNavVisibilityStore((s) => s.hydrated)

  React.useEffect(() => {
    void useNavVisibilityStore.getState().hydrate(userId)
  }, [userId, hydrated])

  const isAdmin = (userRoleId ?? 0) >= 1

  return React.useCallback(
    (items: NavItem[]): NavItem[] =>
      filterNavItemsByTier(
        filterNavItemsByRole(items, isAdmin, userPermissions),
        useNavVisibilityStore.getState().hiddenTiers,
      ),
    // 回调体里读 getState() 而非闭包捕获的数组:嵌入数组会让闭包随每次 store 写入重建,
    // 落到 Sidebar 的 useMemo 依赖上就是每次都重算 97 个导航项的过滤。
    [isAdmin, userPermissions, tiersKey],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
