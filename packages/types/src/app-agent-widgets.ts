// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 端内「智能体卡片段」props 单一源 —— 自 packages/app/src/features/agent-screen 上移(2026-11-06)。
 *
 * AgentMyApps / AgentRecentUsed 由小程序 pages/community 与 mobile-rn 同源消费;
 * rn-shells 派生件据此把 props 落成 ComponentType<XxxProps>(不再用开放记录档)。
 */

/** 卡片数据:两端字段别名都收在这里(缺失时各端回退 name/avatar/id)。 */
export interface AgentHomeItem {
  id?: string
  name?: string
  avatar?: string
  type?: string | number
  source?: string
  /** 原 Uniapp 字段别名(缺失时回退 name/avatar/id) */
  agentAvatar?: string
  agentName?: string
  agentId?: string
}

export interface AgentRecentUsedProps {
  items: AgentHomeItem[]
  title: string
  onItemClick: (item: AgentHomeItem, index: number) => void
  colorScheme: 'light' | 'dark'
  /** 无头像时的兜底图;两端都显式传,无兜底传 null */
  defaultAvatar: string | null
}

export interface AgentMyAppsProps {
  items: AgentHomeItem[]
  title: string
  moreText: string
  onItemClick: (item: AgentHomeItem, index: number) => void
  onMore: (() => void) | undefined
  showMore: boolean
  colorScheme: 'light' | 'dark'
  defaultAvatar: string | null
  /** null = 空态不渲染(小程序现状);字符串 = 渲染空态(RN 现状) */
  emptyText: string | null
}
