// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type * as React from 'react'

/**
 * 高级/运维功能分档(2026-10-20 立,G-?? 侧边栏简洁模式)
 *
 * 立因:侧边栏对普通用户可见的 101 项里,有 60 项属于「开发者/中转站运营/Agent 框架内部/
 * 实验性」四类 —— 职能错配或对普通用户完全不可理解(如 /spec、/plan、/registry 仍是英文原词),
 * 用户点开不是空白就是别人的数据(models/users、models/logs 是中转站全站运营数据,
 * 用户会误以为自己数据泄露)。此前唯一的降噪手段是 roleId/permission 硬过滤,
 * 但这些东西**用户在 Hackaday 权限上是合法可见的**,只是不该出现在他的菜单里 ——
 * 权限能判"能不能进",判不了"该不该看见"。
 *
 * 故引入第四类可见性:**用户自选**。服务端 Cs-137 不动,只在前端加一层「偏好隐藏」。
 *
 * 四档取值即用户侧那四个开关,改名必须同时改 STORAGE_KEY/preferences 页/AGENTS.md 三处
 * (单一真相源,AGENTS.md §0.6)。
 */
export type NavAdvancedTier = 'developer' | 'relayOps' | 'advancedAi' | 'experimental'

export interface NavItem {
  href: string
  /** i18n key,通过 useTranslations('nav') 解析。改为 string 类型以支持 admin 等动态命名空间。 */
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  /**
   * RBAC 权限点(2026-08-30 教师角色接入):持有任一权限点的用户可见(如教师持 'edu:manage' 可见教务管理)。
   * admin 因下发通配符 '*:*:*' 自动放行。与 adminOnly 互斥使用:adminOnly 仅 admin,permission 按权限码放行。
   * 支持数组(2026-08-30 权限粒度细化):如 ['edu:manage', 'edu:view'],任一命中即可见,
   * 适配"只读教师(仅 edu:view)也可进入教务页"的场景。
   */
  permission?: string | string[]
  /**
   * 高级/运维功能分档(2026-10-20 立):该项属于「普通用户不该默认看见」的哪一档。
   *
   * **继承规则**:子项未标注时继承最近祖先的档位(见 `filterNavItemsByTier`)。
   * 例如给开发者域入口父项(/developer,2026-10-23 P2 收敛后)标 developer,
   * 其 20 个子项无需逐个标注。
   * 反过来,若父项本身要保留(如 /models、/knowledge-base 用户需要进),
   * 就只能给**具体子项**标注 —— 这是 nav-data 里 MODELS_CHILDREN 逐项标注的原因。
   *
   * 与 adminOnly/permission 的区别:后两者是**能不能看**(越权即漏洞),
   * 本字段是**要不要给普通人看**(属于产品降噪,不构成任何鉴权)。
   * 三者互不替代,不要合并成一个字段。
   */
  advancedOnly?: NavAdvancedTier
  children?: NavItem[]
  /** 动态标签,优先级高于 labelKey。用于 admin 后端动态加载的路由名(如 'Operation Log')。 */
  dynamicLabel?: string
  /** 未读数 badge 来源:'messages' 私信未读 / 'notification' 通知未读。 */
  badge?: 'messages' | 'notification'
}
/** 导航项 ref 注册回调:把 href -> DOM 元素 映射存入 Sidebar 的 itemRefs。 */
export type RegisterRef = (href: string, el: HTMLElement | null) => void

export interface SidebarProps {
  // 2026-09-04:collapsed/onToggleCollapse 已下沉到 Sidebar 内部(性能优化),不再从外部传入。
  id?: string
  mobileOpen: boolean
  onCloseMobile: () => void
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
